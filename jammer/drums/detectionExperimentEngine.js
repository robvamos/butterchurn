import { computePitchClassProfile, profileDistance } from "./audioPreprocessing.js";

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function toAlpha(cutoffHz, sampleRate, min, max) {
  return clamp((2 * Math.PI * cutoffHz) / sampleRate, min, max);
}

function meanAbsolute(buffer) {
  let sum = 0;
  for (let index = 0; index < buffer.length; index += 1) {
    sum += Math.abs(buffer[index]);
  }
  return sum / Math.max(1, buffer.length);
}

function normalizeFrame(frame, targetPeak = 0.94) {
  let peak = 0;
  for (let index = 0; index < frame.length; index += 1) {
    peak = Math.max(peak, Math.abs(frame[index]));
  }

  if (peak <= 0.000001) {
    return { frame, gain: 1, peak: 0 };
  }

  const gain = clamp(targetPeak / peak, 0.4, 8);
  const normalized = new Float32Array(frame.length);
  for (let index = 0; index < frame.length; index += 1) {
    normalized[index] = frame[index] * gain;
  }
  return { frame: normalized, gain, peak };
}

function appendSeries(series, value, maxLength) {
  series.push(value);
  if (series.length > maxLength) {
    series.splice(0, series.length - maxLength);
  }
}

function formatTempoLabel(tempo, confidence) {
  if (tempo <= 0) {
    return "Listening";
  }
  return `${Math.round(tempo)} BPM - ${Math.round(confidence)}% lock`;
}

function averageWindow(values, start, end) {
  if (!Array.isArray(values) || values.length === 0) {
    return 0;
  }
  const safeStart = Math.max(0, start);
  const safeEnd = Math.max(safeStart + 1, Math.min(values.length, end));
  let sum = 0;
  for (let index = safeStart; index < safeEnd; index += 1) {
    sum += Number(values[index] || 0);
  }
  return sum / Math.max(1, safeEnd - safeStart);
}

function estimateTempoFromPulse({
  pulseSeries,
  frameSeconds,
  minTempo,
  maxTempo,
  preferredMin = 90,
  preferredMax = 130,
  pluginMode = "aubio",
  tonalSeries = [],
}) {
  if (!Array.isArray(pulseSeries) || pulseSeries.length < 32 || frameSeconds <= 0) {
    return { tempo: 0, confidence: 0, lag: 0, score: 0 };
  }

  const minLag = Math.max(2, Math.floor(60 / (maxTempo * frameSeconds)));
  const maxLag = Math.min(pulseSeries.length - 2, Math.ceil(60 / (minTempo * frameSeconds)));
  let bestLag = 0;
  let bestScore = 0;
  let runnerScore = 0;

  for (let lag = minLag; lag <= maxLag; lag += 1) {
    let sum = 0;
    let tonalBonus = 0;
    let count = 0;
    for (let index = lag; index < pulseSeries.length; index += 1) {
      sum += pulseSeries[index] * pulseSeries[index - lag];
      if (tonalSeries[index] > 0.06 || tonalSeries[index - lag] > 0.06) {
        tonalBonus += 0.015;
      }
      count += 1;
    }

    if (!count) {
      continue;
    }

    const tempo = 60 / (lag * frameSeconds);
    const centralBias = tempo >= preferredMin && tempo <= preferredMax ? 1.2 : 0.72;
    const pluginBias = pluginMode === "essentia"
      ? clamp(1 + tonalBonus + (tempo >= 90 && tempo <= 130 ? 0.08 : -0.04), 0.5, 1.4)
      : clamp(1 + (tonalBonus * 0.5) + (tempo >= 90 && tempo <= 130 ? 0.04 : -0.02), 0.5, 1.25);
    const score = (sum / count) * centralBias * pluginBias;

    if (score > bestScore) {
      runnerScore = bestScore;
      bestScore = score;
      bestLag = lag;
    } else if (score > runnerScore) {
      runnerScore = score;
    }
  }

  if (!bestLag || bestScore <= 0) {
    return { tempo: 0, confidence: 0, lag: 0, score: 0 };
  }

  const tempo = 60 / (bestLag * frameSeconds);
  const scoreSpread = bestScore > 0 ? clamp((bestScore - runnerScore) / bestScore, 0, 1) : 0;
  const confidence = clamp((scoreSpread * 62) + Math.min(28, bestScore * 180), 0, 100);
  return {
    tempo,
    confidence,
    lag: bestLag,
    score: bestScore,
  };
}

function estimateBarPhase({
  pulseSeries,
  tonalSeries,
  lag,
}) {
  if (!Array.isArray(pulseSeries) || !lag || pulseSeries.length < (lag * 5)) {
    return {
      beatInBar: 0,
      barIndex: 0,
      phaseConfidence: 0,
      loopConfidence: 0,
    };
  }

  const recentStart = Math.max(0, pulseSeries.length - (lag * 16));
  let bestOffset = 0;
  let bestScore = 0;
  let runnerScore = 0;

  for (let offset = 0; offset < lag; offset += 1) {
    let score = 0;
    for (let index = recentStart + offset; index < pulseSeries.length; index += lag) {
      const pulse = Number(pulseSeries[index] || 0);
      const tonal = Number(tonalSeries[index] || 0);
      score += (pulse * 0.82) + (tonal * 0.45);
    }
    if (score > bestScore) {
      runnerScore = bestScore;
      bestScore = score;
      bestOffset = offset;
    } else if (score > runnerScore) {
      runnerScore = score;
    }
  }

  const sinceAnchor = Math.max(0, pulseSeries.length - 1 - (recentStart + bestOffset));
  const beatsSinceAnchor = Math.round(sinceAnchor / Math.max(1, lag));
  const beatInBar = ((beatsSinceAnchor % 4) + 1);
  const barIndex = ((Math.floor(beatsSinceAnchor / 4) % 4) + 1);
  const scoreSpread = bestScore > 0 ? clamp((bestScore - runnerScore) / bestScore, 0, 1) : 0;
  return {
    beatInBar,
    barIndex,
    phaseConfidence: clamp((scoreSpread * 72) + Math.min(24, bestScore * 12), 0, 100),
    loopConfidence: clamp((scoreSpread * 56) + Math.min(32, bestScore * 8), 0, 100),
  };
}

function createDefaultDetectionExperimentConfig() {
  return {
    pluginMode: "essentia",
    chartWindowSeconds: 8,
    soloEnabled: false,
    normalizeEnabled: true,
    normalizeTargetPeak: 0.94,
    lowBandMinHz: 35,
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
    bpmMin: 70,
    bpmMax: 180,
    aubioSettings: {
      transientBias: 0.64,
      lowPulseBias: 0.42,
      highPulseBias: 0.24,
      silenceGate: -70,
    },
    essentiaSettings: {
      stableTickBias: 0.46,
      mixedEnvelopeBias: 0.28,
      harmonicAnchorWeight: 0.26,
      sectionBias: 0.18,
    },
  };
}

class DetectionExperimentEngine {
  constructor() {
    this.config = createDefaultDetectionExperimentConfig();
    this.frameBuffer = new Float32Array(1024);
    this.frequencyBuffer = new Uint8Array(512);
    this.lowState = 0;
    this.midState = 0;
    this.highState = 0;
    this.previousLow = 0;
    this.previousMid = 0;
    this.previousHigh = 0;
    this.previousRaw = 0;
    this.previousProfile = new Float32Array(12);
    this.hasProfile = false;
    this.maxChartPoints = 1200;
    this.frameSeconds = 1024 / 44100;
    this.series = {
      raw: [],
      low: [],
      mid: [],
      high: [],
      tonal: [],
      weighted: [],
    };
    this.snapshot = {
      active: false,
      sourceMode: "none",
      pluginMode: this.config.pluginMode,
      bpm: 0,
      fastBpm: 0,
      mediumBpm: 0,
      longBpm: 0,
      confidence: 0,
      beatInBar: 0,
      loopBar: 0,
      phaseConfidence: 0,
      loopConfidence: 0,
      frameSeconds: this.frameSeconds,
      gain: 1,
      rawLevel: 0,
      lowLevel: 0,
      midLevel: 0,
      highLevel: 0,
      tonalChange: 0,
      weightedPulse: 0,
      summary: "Waiting for a live source.",
      charts: {
        raw: [],
        low: [],
        mid: [],
        high: [],
        tonal: [],
        weighted: [],
      },
    };
  }

  getDefaultConfig() {
    return createDefaultDetectionExperimentConfig();
  }

  getConfig() {
    return JSON.parse(JSON.stringify(this.config));
  }

  setConfig(nextConfig = {}) {
    const current = this.getConfig();
    this.config = {
      ...current,
      ...nextConfig,
      aubioSettings: {
        ...current.aubioSettings,
        ...(nextConfig.aubioSettings || {}),
      },
      essentiaSettings: {
        ...current.essentiaSettings,
        ...(nextConfig.essentiaSettings || {}),
      },
    };
    return this.getConfig();
  }

  getSnapshot() {
    return JSON.parse(JSON.stringify(this.snapshot));
  }

  clear() {
    Object.keys(this.series).forEach((key) => {
      this.series[key] = [];
    });
    this.lowState = 0;
    this.midState = 0;
    this.highState = 0;
    this.previousLow = 0;
    this.previousMid = 0;
    this.previousHigh = 0;
    this.previousRaw = 0;
    this.previousProfile = new Float32Array(12);
    this.hasProfile = false;
    this.snapshot = {
      ...this.snapshot,
      active: false,
      bpm: 0,
      fastBpm: 0,
      mediumBpm: 0,
      longBpm: 0,
      confidence: 0,
      beatInBar: 0,
      loopBar: 0,
      phaseConfidence: 0,
      loopConfidence: 0,
      frameSeconds: this.frameSeconds,
      gain: 1,
      rawLevel: 0,
      lowLevel: 0,
      midLevel: 0,
      highLevel: 0,
      tonalChange: 0,
      weightedPulse: 0,
      summary: "Waiting for a live source.",
      charts: {
        raw: [],
        low: [],
        mid: [],
        high: [],
        tonal: [],
        weighted: [],
      },
    };
    return this.getSnapshot();
  }

  analyzeFrame({ analyser = null, sampleRate = 44100, sourceMode = "none" } = {}) {
    if (!analyser || sourceMode === "none") {
      return this.clear();
    }

    if (analyser.fftSize && analyser.fftSize !== this.frameBuffer.length) {
      this.frameBuffer = new Float32Array(analyser.fftSize);
    }
    if (analyser.frequencyBinCount && analyser.frequencyBinCount !== this.frequencyBuffer.length) {
      this.frequencyBuffer = new Uint8Array(analyser.frequencyBinCount);
    }

    if (analyser.getFloatTimeDomainData) {
      analyser.getFloatTimeDomainData(this.frameBuffer);
    } else {
      const byteBuffer = new Uint8Array(this.frameBuffer.length);
      analyser.getByteTimeDomainData(byteBuffer);
      for (let index = 0; index < byteBuffer.length; index += 1) {
        this.frameBuffer[index] = (byteBuffer[index] - 128) / 128;
      }
    }
    if (analyser.getByteFrequencyData) {
      analyser.getByteFrequencyData(this.frequencyBuffer);
    }

    const config = this.config;
    const sampleRateValue = Number(sampleRate || 44100);
    this.frameSeconds = this.frameBuffer.length / sampleRateValue;
    const sourceRawLevel = meanAbsolute(this.frameBuffer);
    const prepared = config.normalizeEnabled
      ? normalizeFrame(this.frameBuffer, config.normalizeTargetPeak)
      : { frame: this.frameBuffer, gain: 1, peak: meanAbsolute(this.frameBuffer) };
    const frame = prepared.frame;
    const lowBandMinHz = Math.max(20, Math.min(Number(config.lowBandMinHz || 35), Number(config.lowCutoffHz || 140) - 5));
    const lowAlpha = toAlpha(config.lowCutoffHz, sampleRateValue, 0.0005, 0.25);
    const lowBandMinAlpha = toAlpha(lowBandMinHz, sampleRateValue, 0.0005, 0.25);
    const highAlpha = toAlpha(config.midCutoffHz, sampleRateValue, 0.004, 0.62);
    const lowFrame = new Float32Array(frame.length);
    const midFrame = new Float32Array(frame.length);
    const highFrame = new Float32Array(frame.length);
    let lowBandMinState = 0;

    for (let index = 0; index < frame.length; index += 1) {
      const sample = frame[index];
      this.lowState += lowAlpha * (sample - this.lowState);
      lowBandMinState += lowBandMinAlpha * (sample - lowBandMinState);
      this.highState += highAlpha * (sample - this.highState);
      const lowSample = this.lowState - lowBandMinState;
      const highSample = sample - this.highState;
      const midSample = sample - lowSample - highSample;
      lowFrame[index] = lowSample;
      midFrame[index] = midSample;
      highFrame[index] = highSample;
    }

    const rawLevel = sourceRawLevel;
    const lowLevel = meanAbsolute(lowFrame);
    const midLevel = meanAbsolute(midFrame);
    const highLevel = meanAbsolute(highFrame);
    const rawOnset = Math.max(0, rawLevel - this.previousRaw);
    const lowOnset = Math.max(0, lowLevel - this.previousLow);
    const midOnset = Math.max(0, midLevel - this.previousMid);
    const highOnset = Math.max(0, highLevel - this.previousHigh);
    this.previousRaw = rawLevel;
    this.previousLow = lowLevel;
    this.previousMid = midLevel;
    this.previousHigh = highLevel;

    const harmonicSnapshot = computePitchClassProfile(this.frequencyBuffer, sampleRateValue, { scaleMode: "byte" });
    const tonalChange = this.hasProfile
      ? profileDistance(harmonicSnapshot.profile, this.previousProfile)
      : 0;
    this.previousProfile = Float32Array.from(harmonicSnapshot.profile);
    this.hasProfile = true;

    const lowInput = config.lowEnabled ? lowOnset : 0;
    const midInput = config.midEnabled ? midOnset : 0;
    const highInput = config.highEnabled ? highOnset : 0;
    const tonalInput = config.tonalEnabled ? tonalChange : 0;
    const rawAmplitudeInput = config.rawEnabled !== false ? rawLevel : 0;
    const rawInput = (
      (rawAmplitudeInput * config.rawWeight)
      + (lowInput * config.lowWeight)
      + (midInput * config.midWeight)
      + (highInput * config.highWeight)
      + (tonalInput * config.tonalWeight)
    );

    const aubioBlend = (
      (rawAmplitudeInput * config.rawWeight * 0.24)
      + (lowInput * config.lowWeight * (0.65 + config.aubioSettings.lowPulseBias))
      + (midInput * config.midWeight * 0.72)
      + (highInput * config.highWeight * (0.55 + config.aubioSettings.highPulseBias))
      + (rawOnset * config.aubioSettings.transientBias * 0.28)
      + (tonalInput * config.tonalWeight * 0.18)
    );

    const essentiaBlend = (
      (rawAmplitudeInput * config.rawWeight * 0.18)
      + (lowInput * config.lowWeight * 1.08)
      + (midInput * config.midWeight * (0.75 + config.essentiaSettings.mixedEnvelopeBias))
      + (highInput * config.highWeight * 0.64)
      + (rawOnset * config.essentiaSettings.stableTickBias * 0.22)
      + (tonalInput * config.tonalWeight * (0.25 + config.essentiaSettings.harmonicAnchorWeight))
    );

    const weightedPulseBase = config.pluginMode === "aubio" ? aubioBlend : essentiaBlend;
    const weightedPulse = weightedPulseBase >= config.onsetThreshold ? weightedPulseBase : weightedPulseBase * 0.35;

    appendSeries(this.series.raw, rawLevel, this.maxChartPoints);
    appendSeries(this.series.low, lowLevel, this.maxChartPoints);
    appendSeries(this.series.mid, midLevel, this.maxChartPoints);
    appendSeries(this.series.high, highLevel, this.maxChartPoints);
    appendSeries(this.series.tonal, tonalChange, this.maxChartPoints);
    appendSeries(this.series.weighted, weightedPulse, this.maxChartPoints);

    const tempoEstimate = estimateTempoFromPulse({
      pulseSeries: this.series.weighted,
      frameSeconds: this.frameSeconds,
      minTempo: config.bpmMin,
      maxTempo: config.bpmMax,
      pluginMode: config.pluginMode,
      tonalSeries: this.series.tonal,
    });
    const fastWindow = Math.max(40, Math.round(2 / this.frameSeconds));
    const mediumWindow = Math.max(80, Math.round(8 / this.frameSeconds));
    const longWindow = Math.max(120, Math.round(16 / this.frameSeconds));
    const fastTempo = estimateTempoFromPulse({
      pulseSeries: this.series.weighted.slice(-fastWindow),
      frameSeconds: this.frameSeconds,
      minTempo: config.bpmMin,
      maxTempo: config.bpmMax,
      pluginMode: config.pluginMode,
      tonalSeries: this.series.tonal.slice(-fastWindow),
    });
    const mediumTempo = estimateTempoFromPulse({
      pulseSeries: this.series.weighted.slice(-mediumWindow),
      frameSeconds: this.frameSeconds,
      minTempo: config.bpmMin,
      maxTempo: config.bpmMax,
      pluginMode: config.pluginMode,
      tonalSeries: this.series.tonal.slice(-mediumWindow),
    });
    const longTempo = estimateTempoFromPulse({
      pulseSeries: this.series.weighted.slice(-longWindow),
      frameSeconds: this.frameSeconds,
      minTempo: config.bpmMin,
      maxTempo: config.bpmMax,
      pluginMode: config.pluginMode,
      tonalSeries: this.series.tonal.slice(-longWindow),
    });
    const phase = estimateBarPhase({
      pulseSeries: this.series.weighted,
      tonalSeries: this.series.tonal,
      lag: tempoEstimate.lag,
    });

    this.snapshot = {
      active: true,
      sourceMode,
      pluginMode: config.pluginMode,
      bpm: tempoEstimate.tempo > 0 ? Math.round(tempoEstimate.tempo) : 0,
      fastBpm: fastTempo.tempo > 0 ? Math.round(fastTempo.tempo) : 0,
      mediumBpm: mediumTempo.tempo > 0 ? Math.round(mediumTempo.tempo) : 0,
      longBpm: longTempo.tempo > 0 ? Math.round(longTempo.tempo) : 0,
      confidence: tempoEstimate.confidence,
      beatInBar: phase.beatInBar,
      loopBar: phase.barIndex,
      phaseConfidence: phase.phaseConfidence,
      loopConfidence: phase.loopConfidence,
      frameSeconds: this.frameSeconds,
      gain: prepared.gain,
      rawLevel,
      lowLevel: config.lowEnabled ? lowLevel : 0,
      midLevel: config.midEnabled ? midLevel : 0,
      highLevel: config.highEnabled ? highLevel : 0,
      tonalChange: config.tonalEnabled ? tonalChange : 0,
      weightedPulse,
      summary: `${config.pluginMode === "aubio" ? "Aubio lane" : "Essentia lane"} reading ${formatTempoLabel(tempoEstimate.tempo, tempoEstimate.confidence)} from ${sourceMode}, beat ${phase.beatInBar || 0}/4, loop bar ${phase.barIndex || 0}/4, input mix ${Math.round(rawInput * 100)}%.`,
      charts: {
        raw: [...this.series.raw],
        low: config.lowEnabled ? [...this.series.low] : this.series.low.map(() => 0),
        mid: config.midEnabled ? [...this.series.mid] : this.series.mid.map(() => 0),
        high: config.highEnabled ? [...this.series.high] : this.series.high.map(() => 0),
        tonal: config.tonalEnabled ? [...this.series.tonal] : this.series.tonal.map(() => 0),
        weighted: [...this.series.weighted],
      },
    };

    return this.getSnapshot();
  }
}

function createDetectionExperimentEngine() {
  return new DetectionExperimentEngine();
}

export { DetectionExperimentEngine, createDefaultDetectionExperimentConfig, createDetectionExperimentEngine };
