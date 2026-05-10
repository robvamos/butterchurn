function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function normalizeTempo(bpm) {
  let normalized = Number(bpm);
  if (!Number.isFinite(normalized) || normalized <= 0) {
    return 0;
  }

  while (normalized < 70) {
    normalized *= 2;
  }

  while (normalized > 180) {
    normalized /= 2;
  }

  return Math.round(normalized);
}

function getNow() {
  if (globalThis.performance?.now) {
    return globalThis.performance.now();
  }

  return Date.now();
}

function safeDelete(value) {
  if (value?.delete) {
    value.delete();
  }
}

class EssentiaListener {
  constructor() {
    this.EssentiaClass = globalThis.Essentia || null;
    this.essentiaWasmFactory = globalThis.EssentiaWASM || null;
    this.essentiaWasm = null;
    this.essentiaWasmPromise = null;
    this.installed = Boolean(this.EssentiaClass && this.essentiaWasmFactory);
    this.essentia = null;
    this.ready = false;
    this.analyser = null;
    this.sourceMode = "none";
    this.sampleRate = 44100;
    this.frameBuffer = new Float32Array(1024);
    this.analysisCadenceMs = 84;
    this.lastAnalysisAt = 0;
    this.lastStrongOnsetAt = 0;
    this.onsetBaseline = 0;
    this.onsetPeak = 0.0001;
    this.onsetTimestamps = [];
    this.snapshot = {
      installed: this.installed,
      ready: false,
      version: this.installed ? "available" : "missing",
      sourceMode: "none",
      energy: 0,
      onset: 0,
      tempo: 0,
      confidence: 0,
      zcr: 0,
      statusLabel: this.installed ? "Installed" : "Missing",
      summary: this.installed
        ? "Essentia.js is available and waiting for an audio route."
        : "Essentia.js is not available in this session.",
    };
  }

  getVersion() {
    if (!this.ready) {
      return this.snapshot.version;
    }

    return this.essentia?.version || "0.1.3";
  }

  getSnapshot() {
    return { ...this.snapshot };
  }

  async resolveWasmModule() {
    if (this.essentiaWasm) {
      return this.essentiaWasm;
    }

    if (!this.essentiaWasmFactory) {
      throw new Error("EssentiaWASM is not available");
    }

    if (!this.essentiaWasmPromise) {
      const wasmCandidate = this.essentiaWasmFactory;
      this.essentiaWasmPromise = (async () => {
        if (typeof wasmCandidate === "function") {
          const createdModule = wasmCandidate();
          return typeof createdModule?.then === "function" ? await createdModule : createdModule;
        }

        if (typeof wasmCandidate?.ready?.then === "function") {
          return await wasmCandidate.ready;
        }

        return wasmCandidate;
      })();
    }

    this.essentiaWasm = await this.essentiaWasmPromise;
    return this.essentiaWasm;
  }

  async warmup({ sampleRate = 44100 } = {}) {
    if (!this.installed) {
      throw new Error("Essentia.js globals are not available");
    }

    if (!this.ready) {
      const wasmModule = await this.resolveWasmModule();
      this.essentia = new this.EssentiaClass(wasmModule);
      this.ready = true;
    }

    this.sampleRate = Number.isFinite(Number(sampleRate)) ? Number(sampleRate) : this.sampleRate;
    this.snapshot = {
      ...this.snapshot,
      ready: true,
      version: this.getVersion(),
      statusLabel: this.analyser ? "Listening" : "Ready",
      summary: this.analyser
        ? "Essentia.js is listening to the active JamPal route."
        : "Essentia.js is warmed up and waiting for a live route.",
    };
    return this.getSnapshot();
  }

  setSource({ analyser = null, sourceMode = "none", sampleRate = 44100 } = {}) {
    this.analyser = analyser;
    this.sourceMode = sourceMode || "none";
    if (Number.isFinite(Number(sampleRate))) {
      this.sampleRate = Number(sampleRate);
    }

    if (analyser?.fftSize && analyser.fftSize !== this.frameBuffer.length) {
      this.frameBuffer = new Float32Array(analyser.fftSize);
    }

    this.snapshot = {
      ...this.snapshot,
      sourceMode: this.sourceMode,
      statusLabel: !this.ready
        ? (this.installed ? "Installed" : "Missing")
        : analyser
          ? "Listening"
          : "Ready",
      summary: !this.ready
        ? (this.installed
          ? "Essentia.js is installed and will warm up with the next live route."
          : "Essentia.js is not available in this session.")
        : analyser
          ? `Essentia.js is listening to the ${this.sourceMode} route.`
          : "Essentia.js is ready and waiting for a live route.",
    };
    return this.getSnapshot();
  }

  clearSource() {
    this.analyser = null;
    this.sourceMode = "none";
    this.onsetTimestamps = [];
    this.lastStrongOnsetAt = 0;
    this.snapshot = {
      ...this.snapshot,
      sourceMode: "none",
      energy: 0,
      onset: 0,
      tempo: 0,
      confidence: 0,
      zcr: 0,
      statusLabel: this.ready ? "Ready" : (this.installed ? "Installed" : "Missing"),
      summary: this.ready
        ? "Essentia.js is ready and waiting for a live route."
        : "Essentia.js is not available in this session.",
    };
    return this.getSnapshot();
  }

  registerOnset(now, onsetScore) {
    if (onsetScore < 0.58 || now - this.lastStrongOnsetAt < 140) {
      return;
    }

    this.lastStrongOnsetAt = now;
    this.onsetTimestamps.push(now);
    this.onsetTimestamps = this.onsetTimestamps.filter((timestamp) => now - timestamp <= 6000);
  }

  estimateTempoFromOnsets() {
    if (this.onsetTimestamps.length < 4) {
      return { tempo: 0, confidence: 0 };
    }

    const intervals = [];
    for (let index = 1; index < this.onsetTimestamps.length; index += 1) {
      const interval = this.onsetTimestamps[index] - this.onsetTimestamps[index - 1];
      if (interval >= 180 && interval <= 1600) {
        intervals.push(normalizeTempo(60000 / interval));
      }
    }

    if (intervals.length < 3) {
      return { tempo: 0, confidence: 0 };
    }

    const average = intervals.reduce((sum, value) => sum + value, 0) / intervals.length;
    const variance = intervals.reduce((sum, value) => sum + ((value - average) ** 2), 0) / intervals.length;
    const deviation = Math.sqrt(variance);
    const stability = clamp(1 - (deviation / Math.max(average, 1)), 0, 1);
    const density = clamp(intervals.length / 6, 0, 1);

    return {
      tempo: Math.round(average),
      confidence: Math.round((stability * 0.68 + density * 0.32) * 100),
    };
  }

  analyzeFrame() {
    if (!this.ready || !this.analyser) {
      return this.getSnapshot();
    }

    const now = getNow();
    if (now - this.lastAnalysisAt < this.analysisCadenceMs) {
      return this.getSnapshot();
    }
    this.lastAnalysisAt = now;

    if (this.analyser.getFloatTimeDomainData) {
      this.analyser.getFloatTimeDomainData(this.frameBuffer);
    } else {
      const byteBuffer = new Uint8Array(this.frameBuffer.length);
      this.analyser.getByteTimeDomainData(byteBuffer);
      for (let index = 0; index < byteBuffer.length; index += 1) {
        this.frameBuffer[index] = (byteBuffer[index] - 128) / 128;
      }
    }

    const frameVector = this.essentia.arrayToVector(this.frameBuffer);
    let rms = 0;
    let zcr = 0;
    let onsetScore = 0;

    try {
      rms = this.essentia.RMS(frameVector).rms || 0;
      zcr = this.essentia.ZeroCrossingRate(frameVector).zeroCrossingRate || 0;

      const windowed = this.essentia.Windowing(frameVector, true, this.frameBuffer.length, "hann", 0, true).frame;
      const spectrum = this.essentia.Spectrum(windowed, this.frameBuffer.length).spectrum;
      const onsetRaw = this.essentia.OnsetDetection(spectrum, spectrum, "hfc", this.sampleRate).onsetDetection || 0;

      this.onsetBaseline = this.onsetBaseline === 0
        ? onsetRaw
        : (this.onsetBaseline * 0.9) + (onsetRaw * 0.1);
      this.onsetPeak = Math.max(onsetRaw, this.onsetPeak * 0.97);
      const normalizedOnset = (onsetRaw - (this.onsetBaseline * 1.02))
        / Math.max(0.0001, this.onsetPeak - this.onsetBaseline);
      onsetScore = clamp(normalizedOnset, 0, 1);
      this.registerOnset(now, onsetScore);

      safeDelete(windowed);
      safeDelete(spectrum);
    } finally {
      safeDelete(frameVector);
    }

    const tempoState = this.estimateTempoFromOnsets();
    const energy = clamp(rms * 5.4, 0, 1);
    const confidence = Math.max(
      tempoState.confidence,
      Math.round(clamp((energy * 0.45) + (onsetScore * 0.55), 0, 1) * 100),
    );

    this.snapshot = {
      installed: this.installed,
      ready: this.ready,
      version: this.getVersion(),
      sourceMode: this.sourceMode,
      energy,
      onset: onsetScore,
      tempo: tempoState.tempo,
      confidence,
      zcr,
      statusLabel: "Listening",
      summary: tempoState.tempo > 0
        ? `Essentia.js hears about ${tempoState.tempo} BPM with ${confidence}% confidence on the ${this.sourceMode} route.`
        : `Essentia.js is listening to the ${this.sourceMode} route and building tempo confidence.`,
    };

    return this.getSnapshot();
  }
}

function createEssentiaListener() {
  return new EssentiaListener();
}

export { createEssentiaListener, EssentiaListener };
