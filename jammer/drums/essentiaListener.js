import {
  computeBandSnapshot,
  computePitchClassProfile,
  profileDistance,
} from "./audioPreprocessing.js";

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

function shouldSuppressReference(sourceMode) {
  return sourceMode === "microphone" || sourceMode === "player";
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
    this.referenceProvider = null;
    this.frameBuffer = new Float32Array(1024);
    this.analysisFrameBuffer = new Float32Array(1024);
    this.frequencyBuffer = new Uint8Array(512);
    this.previousSpectrum = new Float32Array(512);
    this.analysisCadenceMs = 84;
    this.longWindowSeconds = 8;
    this.longWindowCadenceMs = 4000;
    this.lastAnalysisAt = 0;
    this.lastLongWindowAt = 0;
    this.lastStrongOnsetAt = 0;
    this.onsetBaseline = 0;
    this.onsetPeak = 0.0001;
    this.onsetTimestamps = [];
    this.historyBuffer = [];
    this.lowEnvelope = 0;
    this.midEnvelope = 0;
    this.highEnvelope = 0;
    this.lowOnset = 0;
    this.midOnset = 0;
    this.highOnset = 0;
    this.spectralFlux = 0;
    this.noiseFloor = 0;
    this.normalizationGain = 1;
    this.longWindowTempo = 0;
    this.longWindowConfidence = 0;
    this.longWindowTicks = [];
    this.harmonicProfile = new Float32Array(12);
    this.harmonicCommittedProfile = new Float32Array(12);
    this.harmonicRoot = "?";
    this.harmonicChange = 0;
    this.harmonicStability = 0;
    this.harmonicAnchorHint = 0;
    this.lastHarmonicAt = 0;
    this.harmonicCadenceMs = 3200;
    this.tuningConfig = {
      normalizeEnabled: true,
      normalizeTargetPeak: 0.94,
      lowCutoffHz: 140,
      midCutoffHz: 2400,
      rawEnabled: true,
      lowEnabled: true,
      midEnabled: true,
      highEnabled: true,
      tonalEnabled: true,
      rawWeight: 0.18,
      lowWeight: 0.48,
      midWeight: 0.2,
      highWeight: 0.16,
      tonalWeight: 0.16,
      onsetThreshold: 0.085,
      essentiaSettings: {
        stableTickBias: 0.46,
        harmonicAnchorWeight: 0.26,
      },
    };
    this.snapshot = {
      installed: this.installed,
      ready: false,
      version: this.installed ? "available" : "missing",
      sourceMode: "none",
      energy: 0,
      onset: 0,
      tempo: 0,
      stableTempo: 0,
      stableConfidence: 0,
      confidence: 0,
      barAnchorConfidence: 0,
      harmonicChange: 0,
      harmonicStability: 0,
      harmonicAnchorHint: 0,
      harmonicRoot: "?",
      phraseBars: 4,
      beatPositions: [],
      zcr: 0,
      preprocess: {
        mono: 0,
        normalized: 0,
        gain: 1,
        noiseFloor: 0,
        flux: 0,
        low: 0,
        mid: 0,
        high: 0,
        lowOnset: 0,
        midOnset: 0,
        highOnset: 0,
      },
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

  setTuningConfig(nextConfig = {}) {
    const current = this.tuningConfig || {};
    this.tuningConfig = {
      ...current,
      ...nextConfig,
      essentiaSettings: {
        ...(current.essentiaSettings || {}),
        ...(nextConfig.essentiaSettings || {}),
      },
    };
    return { ...this.tuningConfig };
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

  setSource({ analyser = null, sourceMode = "none", sampleRate = 44100, referenceProvider = null } = {}) {
    this.analyser = analyser;
    this.sourceMode = sourceMode || "none";
    this.referenceProvider = typeof referenceProvider === "function" ? referenceProvider : null;
    if (Number.isFinite(Number(sampleRate))) {
      this.sampleRate = Number(sampleRate);
    }

    if (analyser?.fftSize && analyser.fftSize !== this.frameBuffer.length) {
      this.frameBuffer = new Float32Array(analyser.fftSize);
      this.analysisFrameBuffer = new Float32Array(analyser.fftSize);
    }

    if (analyser?.frequencyBinCount && analyser.frequencyBinCount !== this.frequencyBuffer.length) {
      this.frequencyBuffer = new Uint8Array(analyser.frequencyBinCount);
      this.previousSpectrum = new Float32Array(analyser.frequencyBinCount);
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
    this.referenceProvider = null;
    this.onsetTimestamps = [];
    this.lastStrongOnsetAt = 0;
    this.lowEnvelope = 0;
    this.midEnvelope = 0;
    this.highEnvelope = 0;
    this.lowOnset = 0;
    this.midOnset = 0;
    this.highOnset = 0;
    this.spectralFlux = 0;
    this.noiseFloor = 0;
    this.normalizationGain = 1;
    this.harmonicProfile = new Float32Array(12);
    this.harmonicCommittedProfile = new Float32Array(12);
    this.harmonicRoot = "?";
    this.harmonicChange = 0;
    this.harmonicStability = 0;
    this.harmonicAnchorHint = 0;
    this.lastHarmonicAt = 0;
    this.snapshot = {
      ...this.snapshot,
      sourceMode: "none",
      energy: 0,
      onset: 0,
      tempo: 0,
      stableTempo: 0,
      stableConfidence: 0,
      confidence: 0,
      barAnchorConfidence: 0,
      harmonicChange: 0,
      harmonicStability: 0,
      harmonicAnchorHint: 0,
      harmonicRoot: "?",
      phraseBars: 4,
      beatPositions: [],
      zcr: 0,
      preprocess: {
        mono: 0,
        normalized: 0,
        gain: 1,
        noiseFloor: 0,
        flux: 0,
        low: 0,
        mid: 0,
        high: 0,
        lowOnset: 0,
        midOnset: 0,
        highOnset: 0,
      },
      statusLabel: this.ready ? "Ready" : (this.installed ? "Installed" : "Missing"),
      summary: this.ready
        ? "Essentia.js is ready and waiting for a live route."
        : "Essentia.js is not available in this session.",
    };
    return this.getSnapshot();
  }

  updateHarmonicState(now, tempo = 0, phraseBars = 4, barAnchorConfidence = 0) {
    const harmonicSnapshot = computePitchClassProfile(this.frequencyBuffer, this.sampleRate, { scaleMode: "byte" });
    for (let index = 0; index < this.harmonicProfile.length; index += 1) {
      this.harmonicProfile[index] = (this.harmonicProfile[index] * 0.78) + (harmonicSnapshot.profile[index] * 0.22);
    }

    const barsMs = tempo > 0 ? (60000 / tempo) * 4 : 2200;
    const structuralSpanBars = phraseBars >= 6 ? 4 : phraseBars >= 4 ? 4 : 2;
    this.harmonicCadenceMs = clamp(barsMs * structuralSpanBars, 3200, 12000);
    const harmonicReady = barAnchorConfidence >= 42 || harmonicSnapshot.energy >= 0.14;

    if ((!this.lastHarmonicAt || (now - this.lastHarmonicAt) >= this.harmonicCadenceMs) && harmonicReady) {
      const novelty = profileDistance(this.harmonicProfile, this.harmonicCommittedProfile);
      this.harmonicChange = (this.harmonicChange * 0.5) + (novelty * 0.5);
      this.harmonicStability = clamp(1 - novelty, 0, 1);
      this.harmonicAnchorHint = clamp(
        (this.harmonicChange * 0.62)
        + ((harmonicSnapshot.energy || 0) * 0.24)
        + ((1 - this.spectralFlux) * 0.14),
        0,
        1
      );
      this.harmonicRoot = harmonicSnapshot.root;
      this.harmonicCommittedProfile = Float32Array.from(this.harmonicProfile);
      this.lastHarmonicAt = now;
    } else {
      this.harmonicChange *= 0.985;
      this.harmonicStability = clamp((this.harmonicStability * 0.92) + 0.08, 0, 1);
      this.harmonicAnchorHint *= 0.985;
      if (harmonicSnapshot.root !== "?") {
        this.harmonicRoot = harmonicSnapshot.root;
      }
    }
  }

  pushHistoryFrame() {
    const maxSamples = Math.max(this.analysisFrameBuffer.length, Math.round(this.sampleRate * this.longWindowSeconds));
    for (let index = 0; index < this.analysisFrameBuffer.length; index += 1) {
      this.historyBuffer.push(this.analysisFrameBuffer[index]);
    }
    if (this.historyBuffer.length > maxSamples) {
      this.historyBuffer.splice(0, this.historyBuffer.length - maxSamples);
    }
  }

  updatePreprocessMetrics(rms) {
    if (!this.analyser) {
      return;
    }

    this.analyser.getByteFrequencyData(this.frequencyBuffer);
    const tuning = this.tuningConfig || {};
    const bandSnapshot = computeBandSnapshot(this.frequencyBuffer, this.sampleRate, this.previousSpectrum, {
      scaleMode: "byte",
      lowCutoffHz: tuning.lowCutoffHz,
      midCutoffHz: tuning.midCutoffHz,
    });
    const reference = shouldSuppressReference(this.sourceMode) && this.referenceProvider
      ? this.referenceProvider()
      : null;
    const lowBand = tuning.lowEnabled === false ? 0 : clamp(bandSnapshot.low - ((reference?.low || 0) * 0.88), 0, 1);
    const midBand = tuning.midEnabled === false ? 0 : clamp(bandSnapshot.mid - ((reference?.mid || 0) * 0.72), 0, 1);
    const highBand = tuning.highEnabled === false ? 0 : clamp(bandSnapshot.high - ((reference?.high || 0) * 0.64), 0, 1);
    const flux = clamp(bandSnapshot.flux - ((reference?.flux || 0) * 0.72), 0, 1);
    this.spectralFlux = (this.spectralFlux * 0.66) + (flux * 0.34);

    const attack = 0.28;
    const release = 0.88;
    const nextLow = Math.max(lowBand, this.lowEnvelope * release);
    const nextMid = Math.max(midBand, this.midEnvelope * release);
    const nextHigh = Math.max(highBand, this.highEnvelope * release);
    this.lowOnset = clamp((Math.max(0, lowBand - this.lowEnvelope) * 3.2) - ((reference?.lowOnset || 0) * 0.8), 0, 1);
    this.midOnset = clamp((Math.max(0, midBand - this.midEnvelope) * 3.0) - ((reference?.midOnset || 0) * 0.65), 0, 1);
    this.highOnset = clamp((Math.max(0, highBand - this.highEnvelope) * 3.4) - ((reference?.highOnset || 0) * 0.58), 0, 1);
    this.lowEnvelope = (this.lowEnvelope * (1 - attack)) + (nextLow * attack);
    this.midEnvelope = (this.midEnvelope * (1 - attack)) + (nextMid * attack);
    this.highEnvelope = (this.highEnvelope * (1 - attack)) + (nextHigh * attack);

    this.noiseFloor = this.noiseFloor === 0
      ? rms
      : (this.noiseFloor * 0.985) + (rms * 0.015);
  }

  analyzeLongWindow(now) {
    if (
      !this.essentia
      || this.historyBuffer.length < Math.round(this.sampleRate * 4)
      || (now - this.lastLongWindowAt) < this.longWindowCadenceMs
    ) {
      return;
    }

    this.lastLongWindowAt = now;
    const historyVector = this.essentia.arrayToVector(Float32Array.from(this.historyBuffer));
    try {
      const rhythm = this.essentia.RhythmExtractor2013(historyVector, 208, "multifeature", 40);
      const stableTempo = normalizeTempo(rhythm?.bpm || 0);
      const stableConfidence = Math.round(clamp(((Number(rhythm?.confidence || 0) / 5.32) * 100), 0, 100));
      const ticks = rhythm?.ticks && typeof rhythm.ticks.size === "function"
        ? Array.from({ length: rhythm.ticks.size() }, (_, index) => rhythm.ticks.get(index))
        : [];

      this.longWindowTempo = stableTempo;
      this.longWindowConfidence = stableConfidence;
      this.longWindowTicks = ticks.slice(-16);
    } catch (error) {
      this.longWindowTempo = this.longWindowTempo || 0;
      this.longWindowConfidence = this.longWindowConfidence || 0;
    } finally {
      safeDelete(historyVector);
    }
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
      return { tempo: 0, confidence: 0, stability: 0, density: 0 };
    }

    const intervals = [];
    for (let index = 1; index < this.onsetTimestamps.length; index += 1) {
      const interval = this.onsetTimestamps[index] - this.onsetTimestamps[index - 1];
      if (interval >= 180 && interval <= 1600) {
        intervals.push(normalizeTempo(60000 / interval));
      }
    }

    if (intervals.length < 3) {
      return { tempo: 0, confidence: 0, stability: 0, density: 0 };
    }

    const average = intervals.reduce((sum, value) => sum + value, 0) / intervals.length;
    const variance = intervals.reduce((sum, value) => sum + ((value - average) ** 2), 0) / intervals.length;
    const deviation = Math.sqrt(variance);
    const stability = clamp(1 - (deviation / Math.max(average, 1)), 0, 1);
    const density = clamp(intervals.length / 6, 0, 1);

    return {
      tempo: Math.round(average),
      confidence: Math.round((stability * 0.68 + density * 0.32) * 100),
      stability,
      density,
    };
  }

  estimatePhraseBars(tempoState, onsetScore, energy) {
    const onsetCount = this.onsetTimestamps.length;
    if (energy < 0.12 && onsetScore < 0.08) {
      return 2;
    }

    if (tempoState.confidence >= 86 && tempoState.stability >= 0.82 && onsetCount >= 8) {
      return 8;
    }

    if (tempoState.confidence >= 72 && tempoState.stability >= 0.68 && onsetCount >= 6) {
      return 6;
    }

    return 4;
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
    let peak = 0;
    for (let index = 0; index < this.frameBuffer.length; index += 1) {
      peak = Math.max(peak, Math.abs(this.frameBuffer[index]));
    }

    const monoRms = Math.sqrt(
      this.frameBuffer.reduce((sum, value) => sum + (value * value), 0) / Math.max(1, this.frameBuffer.length)
    );
    const tuning = this.tuningConfig || {};
    const normalizeTargetPeak = clamp(Number(tuning.normalizeTargetPeak || 0.94), 0.4, 1);
    const targetRms = 0.08 + (normalizeTargetPeak * 0.12);
    const gain = clamp(targetRms / Math.max(0.0001, monoRms), 0.85, 4);
    this.normalizationGain = (this.normalizationGain * 0.7) + (gain * 0.3);
    const safeGain = tuning.normalizeEnabled === false
      ? 1
      : peak > 0 ? Math.min(this.normalizationGain, normalizeTargetPeak / peak) : this.normalizationGain;

    for (let index = 0; index < this.frameBuffer.length; index += 1) {
      this.analysisFrameBuffer[index] = clamp(this.frameBuffer[index] * safeGain, -1, 1);
    }

    this.pushHistoryFrame();
    this.updatePreprocessMetrics(monoRms);

    const frameVector = this.essentia.arrayToVector(this.analysisFrameBuffer);
    let rms = 0;
    let zcr = 0;
    let onsetScore = 0;

    try {
      rms = this.essentia.RMS(frameVector).rms || 0;
      zcr = this.essentia.ZeroCrossingRate(frameVector).zeroCrossingRate || 0;

      const windowed = this.essentia.Windowing(frameVector, true, this.analysisFrameBuffer.length, "hann", 0, true).frame;
      const spectrum = this.essentia.Spectrum(windowed, this.analysisFrameBuffer.length).spectrum;
      const onsetRaw = this.essentia.OnsetDetection(spectrum, spectrum, "hfc", this.sampleRate).onsetDetection || 0;

      this.onsetBaseline = this.onsetBaseline === 0
        ? onsetRaw
        : (this.onsetBaseline * 0.9) + (onsetRaw * 0.1);
      this.onsetPeak = Math.max(onsetRaw, this.onsetPeak * 0.97);
      const normalizedOnset = (onsetRaw - (this.onsetBaseline * 1.02))
        / Math.max(0.0001, this.onsetPeak - this.onsetBaseline);
      const lowWeight = clamp(Number(tuning.lowWeight || 0.48), 0, 1.5);
      const midWeight = clamp(Number(tuning.midWeight || 0.2), 0, 1.5);
      const highWeight = clamp(Number(tuning.highWeight || 0.16), 0, 1.5);
      const tonalWeight = tuning.tonalEnabled === false ? 0 : clamp(Number(tuning.tonalWeight || 0.16), 0, 1.5);
      const rawWeight = tuning.rawEnabled === false ? 0 : clamp(Number(tuning.rawWeight || 0.18), 0, 1.5);
      const laneWeightTotal = Math.max(0.0001, rawWeight + lowWeight + midWeight + highWeight + tonalWeight);
      const stableTickBias = clamp(Number(tuning.essentiaSettings?.stableTickBias || 0.46), 0, 1.5);
      const rawAmplitudeCue = tuning.rawEnabled === false ? 0 : clamp(monoRms * 4.8, 0, 1);
      onsetScore = clamp(
        (normalizedOnset * (0.28 + (stableTickBias * 0.18)))
        + (rawAmplitudeCue * (rawWeight / laneWeightTotal) * 0.18)
        + (this.spectralFlux * 0.16)
        + (this.lowOnset * (lowWeight / laneWeightTotal) * 0.34)
        + (this.midOnset * (midWeight / laneWeightTotal) * 0.12)
        + (this.highOnset * (highWeight / laneWeightTotal) * 0.1),
        0,
        1
      );
      if (onsetScore < Number(tuning.onsetThreshold || 0.085)) {
        onsetScore *= 0.45;
      }
      this.registerOnset(now, onsetScore);

      safeDelete(windowed);
      safeDelete(spectrum);
    } finally {
      safeDelete(frameVector);
    }

    this.analyzeLongWindow(now);
    const tempoState = this.estimateTempoFromOnsets();
    const energy = clamp(rms * 5.4, 0, 1);
    const reference = shouldSuppressReference(this.sourceMode) && this.referenceProvider
      ? this.referenceProvider()
      : null;
    const maskedEnergy = clamp(energy - ((reference?.energy || 0) * 0.72), 0, 1);
    const normalizedEnergy = clamp(maskedEnergy * this.normalizationGain * 0.55, 0, 1);
    const blendedTempo = this.longWindowTempo > 0 && tempoState.tempo > 0
      ? Math.round((tempoState.tempo * 0.35) + (this.longWindowTempo * 0.65))
      : (this.longWindowTempo || tempoState.tempo);
    const confidence = Math.max(
      tempoState.confidence,
      this.longWindowConfidence,
      Math.round(clamp((normalizedEnergy * 0.25) + (clamp(monoRms * 4.8, 0, 1) * 0.1) + (onsetScore * 0.38) + (this.spectralFlux * 0.27), 0, 1) * 100),
    );
    const phraseBars = this.estimatePhraseBars(tempoState, onsetScore, energy);
    const harmonicWeight = clamp(Number(tuning.essentiaSettings?.harmonicAnchorWeight || 0.26), 0, 1.5);
    const baseBarAnchorConfidence = Math.max(
      0,
      Math.min(
        100,
        Math.round(
          (tempoState.stability || 0) * 38
          + (tempoState.density || 0) * 10
          + (this.longWindowConfidence / 100) * 16
          + this.lowOnset * (12 + (clamp(Number(tuning.lowWeight || 0.48), 0, 1.5) * 10))
          + this.lowEnvelope * (8 + (clamp(Number(tuning.lowWeight || 0.48), 0, 1.5) * 6))
          + this.spectralFlux * 10
          + normalizedEnergy * 8
        ),
      ),
    );
    this.updateHarmonicState(
      now,
      blendedTempo || this.longWindowTempo || tempoState.tempo || 0,
      phraseBars,
      baseBarAnchorConfidence
    );
    const barAnchorConfidence = Math.max(
      0,
      Math.min(100, Math.round(baseBarAnchorConfidence + (this.harmonicAnchorHint * (6 + (harmonicWeight * 8))))),
    );

    this.snapshot = {
      installed: this.installed,
      ready: this.ready,
      version: this.getVersion(),
      sourceMode: this.sourceMode,
      energy: maskedEnergy,
      onset: onsetScore,
      tempo: blendedTempo,
      stableTempo: this.longWindowTempo,
      stableConfidence: this.longWindowConfidence,
      confidence,
      barAnchorConfidence,
      harmonicChange: Math.round(this.harmonicChange * 100),
      harmonicStability: Math.round(this.harmonicStability * 100),
      harmonicAnchorHint: Math.round(this.harmonicAnchorHint * 100),
      harmonicRoot: this.harmonicRoot,
      phraseBars,
      beatPositions: this.longWindowTicks,
      zcr,
      preprocess: {
        mono: monoRms,
        normalized: normalizedEnergy,
        gain: safeGain,
        noiseFloor: this.noiseFloor,
        flux: this.spectralFlux,
        low: this.lowEnvelope,
        mid: this.midEnvelope,
        high: this.highEnvelope,
        lowOnset: this.lowOnset,
        midOnset: this.midOnset,
        highOnset: this.highOnset,
      },
      statusLabel: "Listening",
      summary: blendedTempo > 0
        ? `Essentia.js hears about ${blendedTempo} BPM, anchor ${barAnchorConfidence}% and a phrase around ${phraseBars} bars on the ${this.sourceMode} route. Harmonic root ${this.harmonicRoot}, change ${Math.round(this.harmonicChange * 100)}%. Low band ${Math.round(this.lowEnvelope * 100)}%, high band ${Math.round(this.highEnvelope * 100)}%${reference ? ", with drummer reference masked out" : ""}.`
        : `Essentia.js is listening to the ${this.sourceMode} route and building tempo confidence through low, mid and high rhythm bands${reference ? " while suppressing the drummer reference" : ""}.`,
    };

    return this.getSnapshot();
  }
}

function createEssentiaListener() {
  return new EssentiaListener();
}

export { createEssentiaListener, EssentiaListener };
