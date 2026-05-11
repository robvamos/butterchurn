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

function shouldSuppressReference(sourceMode) {
  return sourceMode === "microphone" || sourceMode === "player";
}

class AubioListener {
  constructor() {
    this.factory = globalThis.aubio || null;
    this.installed = typeof this.factory === "function";
    this.api = null;
    this.ready = false;
    this.analyser = null;
    this.referenceProvider = null;
    this.sourceMode = "none";
    this.sampleRate = 44100;
    this.bufferSize = 1024;
    this.hopSize = 256;
    this.frameBuffer = new Float32Array(this.bufferSize);
    this.analysisCadenceMs = 42;
    this.lastAnalysisAt = 0;
    this.lastBeatAt = 0;
    this.lastOnsetValue = 0;
    this.tempoDetector = null;
    this.onsetDetector = null;
    this.snapshot = {
      installed: this.installed,
      ready: false,
      version: this.installed ? "0.2.1" : "missing",
      sourceMode: "none",
      tempo: 0,
      confidence: 0,
      onset: 0,
      beatPulse: false,
      lastBeatMs: 0,
      statusLabel: this.installed ? "Installed" : "Missing",
      summary: this.installed
        ? "aubio is available and waiting for an audio route."
        : "aubio is not available in this session.",
    };
  }

  getSnapshot() {
    return { ...this.snapshot };
  }

  async warmup({ sampleRate = 44100 } = {}) {
    if (!this.installed) {
      throw new Error("aubio is not available");
    }

    if (this.ready && this.sampleRate === sampleRate) {
      return this.getSnapshot();
    }

    this.api = await this.factory();
    this.sampleRate = sampleRate;
    this.tempoDetector = new this.api.Tempo(this.bufferSize, this.hopSize, this.sampleRate);
    this.onsetDetector = new this.api.Onset("default", this.bufferSize, this.hopSize, this.sampleRate);
    if (typeof this.onsetDetector.setSilence === "function") {
      this.onsetDetector.setSilence(-70);
    }
    if (typeof this.onsetDetector.setThreshold === "function") {
      this.onsetDetector.setThreshold(0.18);
    }

    this.ready = true;
    this.snapshot = {
      ...this.snapshot,
      ready: true,
      version: "0.2.1",
      statusLabel: "Ready",
      summary: `aubio is ready at ${this.sampleRate} Hz and waiting for the ${this.sourceMode} route.`,
    };
    return this.getSnapshot();
  }

  setSource({ analyser, sourceMode = "none", sampleRate = this.sampleRate, referenceProvider = null } = {}) {
    this.analyser = analyser || null;
    this.sourceMode = sourceMode;
    this.referenceProvider = typeof referenceProvider === "function" ? referenceProvider : null;
    this.sampleRate = sampleRate || this.sampleRate;
    this.lastAnalysisAt = 0;
    this.lastBeatAt = 0;
    this.lastOnsetValue = 0;
    this.snapshot = {
      ...this.snapshot,
      sourceMode: this.sourceMode,
      beatPulse: false,
      lastBeatMs: 0,
      statusLabel: this.ready ? "Listening" : this.snapshot.statusLabel,
      summary: this.ready && this.analyser
        ? `aubio is listening to the ${this.sourceMode} route.`
        : this.ready
          ? "aubio is ready and waiting for a live route."
          : this.snapshot.summary,
    };
    return this.getSnapshot();
  }

  clearSource() {
    this.analyser = null;
    this.sourceMode = "none";
    this.referenceProvider = null;
    this.lastAnalysisAt = 0;
    this.lastBeatAt = 0;
    this.lastOnsetValue = 0;
    this.snapshot = {
      ...this.snapshot,
      sourceMode: "none",
      tempo: 0,
      confidence: 0,
      onset: 0,
      beatPulse: false,
      lastBeatMs: 0,
      statusLabel: this.ready ? "Ready" : this.snapshot.statusLabel,
      summary: this.ready
        ? "aubio is ready and waiting for a live route."
        : this.snapshot.summary,
    };
    return this.getSnapshot();
  }

  analyzeFrame() {
    if (!this.ready || !this.analyser || !this.tempoDetector || !this.onsetDetector) {
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

    const onsetRaw = Number(this.onsetDetector.do(this.frameBuffer) || 0);
    const tempoRaw = Number(this.tempoDetector.do(this.frameBuffer) || 0);
    const tempo = normalizeTempo(this.tempoDetector.getBpm());
    const rawConfidence = Number(this.tempoDetector.getConfidence() || 0);
    const confidence = Math.round(
      clamp(rawConfidence <= 1 ? rawConfidence * 100 : rawConfidence, 0, 100)
    );
    const reference = shouldSuppressReference(this.sourceMode) && this.referenceProvider
      ? this.referenceProvider()
      : null;
    const referenceBias = clamp(
      ((reference?.lowOnset || 0) * 0.55)
      + ((reference?.highOnset || 0) * 0.3)
      + ((reference?.flux || 0) * 0.15),
      0,
      1
    );
    const onset = clamp(Math.max(onsetRaw - (referenceBias * 0.72), this.lastOnsetValue * 0.75), 0, 1);
    const beatPulse = (onsetRaw > 0 || tempoRaw > 0) && onset > 0.08;
    const maskedConfidence = Math.round(clamp(confidence - (referenceBias * 26), 0, 100));
    if (beatPulse) {
      this.lastBeatAt = now;
    }
    this.lastOnsetValue = onset;

    this.snapshot = {
      ...this.snapshot,
      sourceMode: this.sourceMode,
      tempo,
      confidence: maskedConfidence,
      onset,
      beatPulse,
      lastBeatMs: this.lastBeatAt,
      statusLabel: "Listening",
      summary: tempo > 0
        ? `aubio hears about ${tempo} BPM with ${maskedConfidence}% tempo confidence on the ${this.sourceMode} route${reference ? ", with drummer transients suppressed" : ""}.`
        : `aubio is listening to the ${this.sourceMode} route and collecting beat pulses${reference ? " while suppressing the drummer reference" : ""}.`,
    };
    return this.getSnapshot();
  }
}

function createAubioListener() {
  return new AubioListener();
}

export { AubioListener, createAubioListener };
