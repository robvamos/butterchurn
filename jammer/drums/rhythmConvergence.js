import { TempoKalmanModel } from "./tempoKalmanModel.js";
import { TempoParticleModel } from "./tempoParticleModel.js";

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

function nearestPhraseBars(value) {
  const options = [2, 4, 6, 8];
  const numeric = Number(value || 4);
  return options.reduce((best, current) => (
    Math.abs(current - numeric) < Math.abs(best - numeric) ? current : best
  ), 4);
}

function average(values) {
  if (!values.length) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function getNow() {
  if (globalThis.performance?.now) {
    return globalThis.performance.now();
  }

  return Date.now();
}

class RhythmConvergenceEngine {
  constructor() {
    this.mode = "kalman";
    this.reset();
  }

  setMode(mode = "kalman") {
    this.mode = mode === "particle" ? "particle" : "kalman";
    this.setupModelEngines();
    return this.mode;
  }

  reset() {
    this.smoothedTempo = 0;
    this.periodEstimateMs = 0;
    this.lastBeatAt = 0;
    this.lastBeatIntervalMs = 0;
    this.beatCounter = 0;
    this.beatHistory = [];
    this.anchorPulseCount = 0;
    this.barOffset = 0;
    this.phaseCorrectionMs = 0;
    this.predictedBeatAt = 0;
    this.lockStrength = 0;
    this.lastInnovationMs = 0;
    this.outlierCount = 0;
    this.internalPhase = 0;
    this.barPosition = 0;
    this.kalmanFilter = null;
    this.kalmanState = null;
    this.particleFilter = null;
    this.hypothesisScores = {
      normal: 0.5,
      half: 0.25,
      double: 0.25,
    };
    this.lastSourceMode = "none";
    this.setupModelEngines();
  }

  setupModelEngines() {
    this.kalmanFilter = new TempoKalmanModel();
    this.kalmanState = true;
    this.particleFilter = new TempoParticleModel(48);
  }

  applyKalmanTempo(candidateTempo) {
    if (!candidateTempo || !this.kalmanFilter || !this.kalmanState) {
      return candidateTempo;
    }

    try {
      return this.kalmanFilter.update(candidateTempo, {
        confidence: clamp((this.lockStrength * 0.45) + 0.4, 0.18, 0.96),
        lockStrength: this.lockStrength,
      });
    } catch {
      return candidateTempo;
    }
  }

  applyParticleTempo(candidateTempo) {
    if (!candidateTempo || !this.particleFilter) {
      return candidateTempo;
    }

    try {
      return this.particleFilter.update(candidateTempo, {
        confidence: clamp((this.lockStrength * 0.4) + 0.38, 0.16, 0.94),
        lockStrength: this.lockStrength,
      });
    } catch {
      return candidateTempo;
    }
  }

  computeWindowTempo(now, windowMs) {
    const entries = this.beatHistory.filter((entry) => (now - entry.time) <= windowMs && entry.interval > 0);
    if (entries.length < 2) {
      return { tempo: 0, confidence: 0, stability: 0 };
    }

    const tempos = entries.map((entry) => normalizeTempo(60000 / entry.interval)).filter(Boolean);
    if (tempos.length < 2) {
      return { tempo: 0, confidence: 0, stability: 0 };
    }

    const mean = average(tempos);
    const variance = average(tempos.map((tempo) => (tempo - mean) ** 2));
    const deviation = Math.sqrt(variance);
    const stability = clamp(1 - (deviation / Math.max(mean, 1)), 0, 1);
    const density = clamp(entries.length / Math.max(3, windowMs / 1200), 0, 1);
    return {
      tempo: normalizeTempo(mean),
      confidence: Math.round(clamp((stability * 0.72) + (density * 0.28), 0, 1) * 100),
      stability,
    };
  }

  scoreTempoHypothesis(candidateTempo, refs) {
    if (!candidateTempo) {
      return 0;
    }

    let score = 0;
    refs.forEach(({ tempo, weight }) => {
      if (!tempo) {
        return;
      }
      const distance = Math.abs(candidateTempo - tempo);
      score += clamp(1 - (distance / 18), 0, 1) * weight;
    });
    return score;
  }

  updateHypothesisScores({ normalTempo, halfTempo, doubleTempo, refs, confidenceRatio }) {
    const targetScores = {
      normal: this.scoreTempoHypothesis(normalTempo, refs),
      half: this.scoreTempoHypothesis(halfTempo, refs) * 0.86,
      double: this.scoreTempoHypothesis(doubleTempo, refs) * 0.84,
    };

    const inertia = 0.92 - (confidenceRatio * 0.18) - (this.lockStrength * 0.06);
    Object.keys(this.hypothesisScores).forEach((key) => {
      this.hypothesisScores[key] = (this.hypothesisScores[key] * inertia) + (targetScores[key] * (1 - inertia));
    });

    const total = Object.values(this.hypothesisScores).reduce((sum, value) => sum + value, 0) || 1;
    Object.keys(this.hypothesisScores).forEach((key) => {
      this.hypothesisScores[key] /= total;
    });

    return Object.entries(this.hypothesisScores).sort((a, b) => b[1] - a[1])[0]?.[0] || "normal";
  }

  scoreBarOffset() {
    if (this.beatHistory.length < 4) {
      return { offset: 0, confidence: 0 };
    }

    const scores = [0, 0, 0, 0];
    this.beatHistory.forEach((entry) => {
      scores[entry.index % 4] += entry.weight;
    });

    let bestOffset = 0;
    let bestScore = scores[0];
    let secondScore = 0;
    for (let index = 1; index < scores.length; index += 1) {
      if (scores[index] > bestScore) {
        secondScore = bestScore;
        bestScore = scores[index];
        bestOffset = index;
      } else if (scores[index] > secondScore) {
        secondScore = scores[index];
      }
    }

    const total = scores.reduce((sum, value) => sum + value, 0) || 1;
    const confidence = clamp(((bestScore - secondScore) / total) * 100 + (bestScore / total) * 42, 0, 100);
    return { offset: bestOffset, confidence };
  }

  update({
    sourceMode = "none",
    baseTempo = 104,
    eTempo = 0,
    eStableTempo = 0,
    eConfidence = 0,
    eStableConfidence = 0,
    aTempo = 0,
    aConfidence = 0,
    anchorHint = 0,
    phraseBarsHint = 4,
    rawBeatPulse = false,
    onset = 0,
    energy = 0,
    lowBand = 0,
    lowOnset = 0,
    preprocessFlux = 0,
  } = {}) {
    const now = getNow();

    if (sourceMode !== this.lastSourceMode) {
      this.reset();
      this.lastSourceMode = sourceMode;
    }

    const fastWindow = this.computeWindowTempo(now, 2000);
    const mediumWindow = this.computeWindowTempo(now, 8000);
    const longWindow = this.computeWindowTempo(now, 32000);
    const confidenceRatio = clamp(
      ((eConfidence * 0.26) + (eStableConfidence * 0.28) + (aConfidence * 0.16) + (mediumWindow.confidence * 0.18) + (longWindow.confidence * 0.12)) / 100,
      0,
      1
    );
    const modelBias = this.mode === "particle"
      ? { fastReactive: 0.9, balanced: 1.0, wideListen: 1.1 }
      : { fastReactive: 1.0, balanced: 1.0, wideListen: 1.0 };
    const windowMode = this.lockStrength >= 0.76 && confidenceRatio >= 0.68
      ? "fast-reactive"
      : this.lockStrength >= 0.46 || confidenceRatio >= 0.52
        ? "balanced"
        : "wide-listen";
    const windowWeights = windowMode === "fast-reactive"
      ? { fast: 1.2 * modelBias.fastReactive, medium: 0.9, long: 0.72 }
      : windowMode === "balanced"
        ? { fast: 0.92, medium: 1.0, long: 0.9 }
        : { fast: 0.68, medium: 1.0, long: 1.16 * modelBias.wideListen };
    const candidates = [];
    if (eStableTempo > 0) {
      candidates.push({ tempo: eStableTempo, weight: Math.max(0.1, eStableConfidence * 1.1) });
    }
    if (eTempo > 0) {
      candidates.push({ tempo: eTempo, weight: Math.max(0.1, eConfidence * 0.85) });
    }
    if (aTempo > 0) {
      candidates.push({ tempo: aTempo, weight: Math.max(0.1, aConfidence * 0.75) });
    }
    if (fastWindow.tempo > 0) {
      candidates.push({ tempo: fastWindow.tempo, weight: Math.max(6, fastWindow.confidence * 0.45) * windowWeights.fast });
    }
    if (mediumWindow.tempo > 0) {
      candidates.push({ tempo: mediumWindow.tempo, weight: Math.max(8, mediumWindow.confidence * 0.65) * windowWeights.medium });
    }
    if (longWindow.tempo > 0) {
      candidates.push({ tempo: longWindow.tempo, weight: Math.max(10, longWindow.confidence * 0.8) * windowWeights.long });
    }

    const rawCandidateTempo = candidates.length > 0
      ? candidates.reduce((sum, item) => sum + (item.tempo * item.weight), 0)
        / candidates.reduce((sum, item) => sum + item.weight, 0)
      : normalizeTempo(this.smoothedTempo || baseTempo);
    const hypothesisRefs = [
      { tempo: eStableTempo, weight: 0.32 },
      { tempo: eTempo, weight: 0.16 },
      { tempo: aTempo, weight: 0.14 },
      { tempo: fastWindow.tempo, weight: 0.12 },
      { tempo: mediumWindow.tempo, weight: 0.16 },
      { tempo: longWindow.tempo, weight: 0.1 },
    ];
    const halfTempo = normalizeTempo(rawCandidateTempo / 2);
    const doubleTempo = normalizeTempo(rawCandidateTempo * 2);
    let activeHypothesis = this.updateHypothesisScores({
      normalTempo: normalizeTempo(rawCandidateTempo),
      halfTempo,
      doubleTempo,
      refs: hypothesisRefs,
      confidenceRatio,
    });
    if (this.mode === "particle") {
      const ranked = Object.entries(this.hypothesisScores).sort((a, b) => b[1] - a[1]);
      const top = ranked[0] || ["normal", 0.5];
      const second = ranked[1] || ["half", 0.25];
      if (Math.abs(top[1] - second[1]) < 0.08 && longWindow.tempo > 0) {
        activeHypothesis = longWindow.confidence >= mediumWindow.confidence ? top[0] : second[0];
      } else {
        activeHypothesis = top[0];
      }
    }
    const candidateTempo = activeHypothesis === "half"
      ? halfTempo
      : activeHypothesis === "double"
        ? doubleTempo
        : normalizeTempo(rawCandidateTempo);

    const modelTempo = this.mode === "particle"
      ? this.applyParticleTempo(candidateTempo)
      : this.applyKalmanTempo(candidateTempo);

    if (!this.smoothedTempo) {
      this.smoothedTempo = modelTempo || candidateTempo || normalizeTempo(baseTempo);
    } else if ((modelTempo || candidateTempo) > 0) {
      const measurementTempo = modelTempo || candidateTempo;
      const distance = Math.abs(candidateTempo - this.smoothedTempo);
      const baseAlpha = sourceMode === "microphone" ? 0.018 : 0.014;
      const confidenceAlpha = confidenceRatio * (windowMode === "fast-reactive" ? 0.048 : windowMode === "balanced" ? 0.038 : 0.026);
      const modelAlpha = this.mode === "particle" ? 0.72 : 1;
      const lockPenalty = 1 - (this.lockStrength * 0.35);
      const hysteresisPenalty = distance > 8 ? 0.34 : distance > 4 ? 0.58 : 1;
      const alpha = (baseAlpha + confidenceAlpha) * lockPenalty * hysteresisPenalty * modelAlpha;
      this.smoothedTempo = this.smoothedTempo + ((measurementTempo - this.smoothedTempo) * alpha);
    }

    const tempo = normalizeTempo(this.smoothedTempo || candidateTempo || baseTempo);
    const tempoAgreement = (eTempo > 0 && aTempo > 0)
      ? clamp(1 - (Math.abs(eTempo - aTempo) / 18), 0, 1)
      : (eStableTempo > 0 || eTempo > 0 || aTempo > 0 ? 0.65 : 0.25);
    const candidatePeriodMs = tempo > 0 ? (60000 / tempo) : 0;
    const minPeriodMs = 60000 / 180;
    const maxPeriodMs = 60000 / 70;

    if (!this.periodEstimateMs && candidatePeriodMs > 0) {
      this.periodEstimateMs = candidatePeriodMs;
    } else if (candidatePeriodMs > 0) {
      const periodAlpha = 0.008 + (confidenceRatio * 0.022) + ((1 - this.lockStrength) * 0.012) + (windowMode === "wide-listen" ? 0.004 : 0);
      const periodModelAlpha = this.mode === "particle" ? 0.84 : 1;
      this.periodEstimateMs = clamp(
        this.periodEstimateMs + ((candidatePeriodMs - this.periodEstimateMs) * periodAlpha * periodModelAlpha),
        minPeriodMs,
        maxPeriodMs
      );
    }

    const beatIntervalMs = this.periodEstimateMs || candidatePeriodMs;
    let beatAccepted = false;
    let outlierRejected = false;
    let phaseErrorMs = 0;
    let innovationMs = 0;
    let skippedPredictions = 0;

    if (rawBeatPulse && beatIntervalMs > 0) {
      const sinceLastBeat = this.lastBeatAt ? now - this.lastBeatAt : Number.POSITIVE_INFINITY;
      const minimumBeatGap = Math.max(160, beatIntervalMs * 0.52);
      const resetGap = beatIntervalMs * 1.9;

      if (sinceLastBeat >= minimumBeatGap) {
        const observedInterval = this.lastBeatAt ? sinceLastBeat : beatIntervalMs;
        const provisionalInnovation = this.predictedBeatAt ? now - this.predictedBeatAt : 0;
        const normalizedInnovation = beatIntervalMs > 0 ? Math.abs(provisionalInnovation) / beatIntervalMs : 0;
        const outlierThreshold = this.mode === "particle"
          ? (this.lockStrength >= 0.7 ? 0.32 : this.lockStrength >= 0.45 ? 0.42 : 0.56)
          : (this.lockStrength >= 0.7 ? 0.38 : this.lockStrength >= 0.45 ? 0.48 : 0.62);
        const shouldRejectOutlier = this.predictedBeatAt
          && normalizedInnovation > outlierThreshold
          && confidenceRatio < 0.88
          && anchorHint < 82
          && lowOnset < 0.9;

        if (shouldRejectOutlier) {
          outlierRejected = true;
          this.outlierCount = clamp(this.outlierCount + 1, 0, 16);
          this.lockStrength = clamp(this.lockStrength - 0.045, 0, 1);
          if (this.predictedBeatAt && beatIntervalMs > 0) {
            this.predictedBeatAt += Math.sign(provisionalInnovation) * Math.min(Math.abs(provisionalInnovation) * 0.08, beatIntervalMs * 0.08);
          }
        } else {
          beatAccepted = true;
          this.outlierCount = clamp(this.outlierCount - 1, 0, 16);
        }

        if (beatAccepted) {
        if (this.predictedBeatAt) {
          innovationMs = provisionalInnovation;
          phaseErrorMs = innovationMs;
          const phaseGain = (0.045 + (confidenceRatio * 0.09) + ((1 - this.lockStrength) * 0.06) + (windowMode === "fast-reactive" ? 0.02 : 0))
            * (this.mode === "particle" ? 0.82 : 1);
          const periodGain = (0.006 + (confidenceRatio * 0.02) + ((1 - this.lockStrength) * 0.014))
            * (this.mode === "particle" ? 0.76 : 1);
          this.phaseCorrectionMs = clamp(
            this.phaseCorrectionMs + (innovationMs * phaseGain),
            -(beatIntervalMs * 0.4),
            beatIntervalMs * 0.4
          );
          this.periodEstimateMs = clamp(
            this.periodEstimateMs + ((observedInterval - this.periodEstimateMs) * periodGain) + (innovationMs * periodGain * 0.06),
            minPeriodMs,
            maxPeriodMs
          );
        } else {
          this.periodEstimateMs = clamp(observedInterval, minPeriodMs, maxPeriodMs);
        }

        this.lastBeatIntervalMs = observedInterval;
        this.lastBeatAt = now;
        this.beatCounter += 1;
        const beatWeight = clamp(
          (anchorHint * 0.38)
          + (aConfidence * 0.16)
          + (onset * 14)
          + (energy * 8)
          + (lowOnset * 16)
          + (lowBand * 10)
          + (preprocessFlux * 6)
          + ((sinceLastBeat > resetGap ? 1 : 0) * 10),
          0,
          100
        );
        this.beatHistory.push({
          index: this.beatCounter - 1,
          time: now,
          weight: beatWeight,
          interval: this.lastBeatIntervalMs,
        });
        this.beatHistory = this.beatHistory.filter((entry) => (now - entry.time) <= 24000).slice(-48);
        this.anchorPulseCount = clamp(this.anchorPulseCount + 1, 0, 16);
        const normalizedInnovation = beatIntervalMs > 0 ? Math.abs(innovationMs) / beatIntervalMs : 0;
        this.lockStrength = clamp(
          this.lockStrength + 0.08 + (confidenceRatio * 0.1) - Math.min(0.16, normalizedInnovation * 0.2),
          0,
          1
        );
        this.lastInnovationMs = innovationMs;
        this.predictedBeatAt = now + Math.max(this.periodEstimateMs - this.phaseCorrectionMs, this.periodEstimateMs * 0.58);
        }
      }
    } else if (beatIntervalMs > 0) {
      if (this.predictedBeatAt && now > this.predictedBeatAt + (beatIntervalMs * 0.2)) {
        while (this.predictedBeatAt && now > this.predictedBeatAt + (beatIntervalMs * 0.2) && skippedPredictions < 8) {
          this.predictedBeatAt += beatIntervalMs;
          skippedPredictions += 1;
        }
        if (skippedPredictions > 0) {
          this.lockStrength = clamp(this.lockStrength - (0.02 * skippedPredictions), 0, 1);
        }
      }
      if (this.lastBeatAt && (now - this.lastBeatAt) > (beatIntervalMs * 3.4)) {
        this.anchorPulseCount = clamp(this.anchorPulseCount - 1, 0, 16);
      }
    }

    const offsetState = this.scoreBarOffset();
    this.barOffset = offsetState.offset;
    const predictedBeatsAhead = (!beatAccepted && this.lastBeatAt && beatIntervalMs > 0)
      ? Math.max(0, Math.min(8, Math.floor((now - this.lastBeatAt + Math.max(0, this.phaseCorrectionMs * 0.5)) / beatIntervalMs)))
      : 0;
    const effectiveBeatCounter = this.beatCounter + predictedBeatsAhead;
    const phase = effectiveBeatCounter > 0
      ? ((((effectiveBeatCounter - 1) - this.barOffset) % 4) + 4) % 4 + 1
      : 0;
    const barStart = (beatAccepted || predictedBeatsAhead > 0) && phase === 1;
    const stability = clamp(
      (tempoAgreement * 0.24)
      + ((Math.min(this.anchorPulseCount, 8) / 8) * 0.17)
      + ((offsetState.confidence / 100) * 0.16)
      + (mediumWindow.stability * 0.16)
      + (longWindow.stability * 0.11)
      + (this.lockStrength * 0.16),
      0,
      1
    );
    const barAnchorConfidence = Math.round(clamp(
      (anchorHint * 0.28)
      + (eStableConfidence * 0.14)
      + (aConfidence * 0.1)
      + (offsetState.confidence * 0.15)
      + (stability * 100 * 0.1)
      + (this.lockStrength * 100 * 0.12)
      + (lowOnset * 7)
      + (lowBand * 4),
      0,
      100
    ));
    const grooveConvergence = Math.round(clamp(
      (tempoAgreement * 24)
      + (stability * 22)
      + (Math.min(100, this.anchorPulseCount * 8) * 0.22)
      + (this.lockStrength * 100 * 0.18),
      0,
      100
    ));
    const phraseBars = grooveConvergence >= 56 && barAnchorConfidence >= 52
      ? nearestPhraseBars(phraseBarsHint || 4)
      : 4;
    const nextBeatTime = beatIntervalMs > 0
      ? (this.predictedBeatAt || (this.lastBeatAt ? this.lastBeatAt + beatIntervalMs : 0))
      : 0;
    const nextBarTime = (nextBeatTime && phase > 0 && beatIntervalMs > 0)
      ? nextBeatTime + ((4 - phase) * beatIntervalMs)
      : 0;
    const beatProgress = this.lastBeatAt && beatIntervalMs > 0
      ? clamp((now - this.lastBeatAt) / beatIntervalMs, 0, 0.999)
      : 0;
    this.internalPhase = phase > 0 ? clamp(((phase - 1) + beatProgress) / 4, 0, 0.999) : 0;
    this.barPosition = phase > 0 ? (phase - 1) + beatProgress : 0;

    let pllState = "Searching";
    if (this.lockStrength >= 0.78 && barAnchorConfidence >= 76 && stability >= 0.72) {
      pllState = "Locked";
    } else if (this.lockStrength >= 0.52 && barAnchorConfidence >= 56 && stability >= 0.46) {
      pllState = "Converging";
    } else if (this.anchorPulseCount > 0 || tempo > 0) {
      pllState = "Acquiring";
    }

    return {
      now,
      confidenceRatio,
      tempo,
      tempoAgreement: Math.round(tempoAgreement * 100),
      beatIntervalMs,
      beatAccepted,
      beatCounter: this.beatCounter,
      beatInBar: phase,
      phase,
      barStart,
      downbeatPulse: barStart && (barAnchorConfidence >= 36 || predictedBeatsAhead > 0),
      anchorPulseCount: Math.min(this.anchorPulseCount, 8),
      nextBeatTime,
      nextBarTime,
      stability,
      barAnchorConfidence,
      grooveConvergence,
      phraseBars,
      fastTempo: fastWindow.tempo,
      mediumTempo: mediumWindow.tempo,
      longTempo: longWindow.tempo,
      activeHypothesis,
      phaseErrorMs: Math.round(phaseErrorMs),
      innovationMs: Math.round(innovationMs || this.lastInnovationMs || 0),
      pllLock: Math.round(this.lockStrength * 100),
      pllState,
      internalPhase: Math.round(this.internalPhase * 1000) / 1000,
      barPosition: Math.round(this.barPosition * 1000) / 1000,
      outlierRejected,
      outlierCount: this.outlierCount,
      windowMode,
      timingModel: this.mode,
    };
  }
}

function createRhythmConvergenceEngine() {
  return new RhythmConvergenceEngine();
}

export {
  RhythmConvergenceEngine,
  createRhythmConvergenceEngine,
};
