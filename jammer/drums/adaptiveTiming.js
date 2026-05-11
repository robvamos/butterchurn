import { createRhythmConvergenceEngine } from "./rhythmConvergence.js";

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

class AdaptiveTimingEngine {
  constructor() {
    this.rhythmConvergence = createRhythmConvergenceEngine();
    this.timingModel = "kalman";
    this.reset();
  }

  reset() {
    this.rhythmConvergence.setMode(this.timingModel);
    this.rhythmConvergence.reset();
    this.snapshot = {
      sourceMode: "none",
      tempo: 0,
      confidence: 0,
      energy: 0,
      onset: 0,
      barAnchorConfidence: 0,
      phraseBars: 4,
      grooveConvergence: 0,
      beatInBar: 0,
      phase: 0,
      barStart: false,
      downbeatPulse: false,
      anchorPulseCount: 0,
      nextBeatTime: 0,
      stability: 0,
      tempoAgreement: 0,
      essentiaTempo: 0,
      essentiaStableTempo: 0,
      essentiaConfidence: 0,
      essentiaStableConfidence: 0,
      essentiaAnchorConfidence: 0,
      essentiaPhraseBars: 4,
      aubioTempo: 0,
      aubioConfidence: 0,
      aubioOnset: 0,
      aubioBeatPulse: false,
      preprocessFlux: 0,
      preprocessLow: 0,
      preprocessMid: 0,
      preprocessHigh: 0,
      preprocessLowOnset: 0,
      preprocessMidOnset: 0,
      preprocessHighOnset: 0,
      preprocessNormalized: 0,
      preprocessGain: 1,
      fastTempo: 0,
      mediumTempo: 0,
      longTempo: 0,
      activeHypothesis: "normal",
      phaseErrorMs: 0,
      innovationMs: 0,
      pllLock: 0,
      pllState: "Waiting",
      internalPhase: 0,
      barPosition: 0,
      nextBarTime: 0,
      outlierRejected: false,
      outlierCount: 0,
      windowMode: "wide-listen",
      timingModel: this.timingModel,
      statusLabel: "Waiting",
      summary: "Timing engine is waiting for a live route.",
    };
  }

  setTimingModel(mode = "kalman") {
    this.timingModel = mode === "particle" ? "particle" : "kalman";
    this.rhythmConvergence.setMode(this.timingModel);
    this.reset();
    return this.getSnapshot();
  }

  getSnapshot() {
    return { ...this.snapshot };
  }

  update({
    detectionActive = false,
    sourceMode = "none",
    baseTempo = 104,
    essentia = {},
    aubio = {},
  } = {}) {
    if (!detectionActive || sourceMode === "none" || (!essentia.ready && !aubio.ready)) {
      this.reset();
      this.snapshot = {
        ...this.snapshot,
        sourceMode,
        statusLabel: detectionActive ? "Waiting" : "Off",
        pllState: detectionActive ? "Waiting" : "Off",
        summary: detectionActive
          ? "Timing engine is waiting for a live route."
          : "Detection is off.",
      };
      return this.getSnapshot();
    }

    const eTempo = normalizeTempo(essentia.tempo);
    const eStableTempo = normalizeTempo(essentia.stableTempo);
    const aTempo = normalizeTempo(aubio.tempo);
    const eConfidence = clamp(Number(essentia.confidence || 0), 0, 100);
    const eStableConfidence = clamp(Number(essentia.stableConfidence || 0), 0, 100);
    const aConfidence = clamp(Number(aubio.confidence || 0), 0, 100);
    const preprocess = essentia.preprocess || {};
    const lowBand = clamp(Number(preprocess.low || 0), 0, 1);
    const midBand = clamp(Number(preprocess.mid || 0), 0, 1);
    const highBand = clamp(Number(preprocess.high || 0), 0, 1);
    const lowOnset = clamp(Number(preprocess.lowOnset || 0), 0, 1);
    const midOnset = clamp(Number(preprocess.midOnset || 0), 0, 1);
    const highOnset = clamp(Number(preprocess.highOnset || 0), 0, 1);
    const preprocessFlux = clamp(Number(preprocess.flux || 0), 0, 1);
    const normalizedEnergy = clamp(Number(preprocess.normalized || 0), 0, 1);
    const preprocessGain = clamp(Number(preprocess.gain || 1), 0, 6);
    const energy = clamp((Number(essentia.energy || 0) * 0.45) + (normalizedEnergy * 0.55), 0, 1);
    const onset = clamp(
      Math.max(
        Number(essentia.onset || 0),
        Number(aubio.onset || 0),
        (lowOnset * 0.92) + (highOnset * 0.08),
        (highOnset * 0.7) + (preprocessFlux * 0.3)
      ),
      0,
      1
    );
    const rawBeatPulse = Boolean(aubio.beatPulse)
      || (lowOnset >= 0.42 && lowBand >= 0.18)
      || (onset >= 0.58 && Number(essentia.barAnchorConfidence || 0) >= 50);
    const convergence = this.rhythmConvergence.update({
      sourceMode,
      baseTempo,
      eTempo,
      eStableTempo,
      eConfidence,
      eStableConfidence,
      aTempo,
      aConfidence,
      anchorHint: Number(essentia.barAnchorConfidence || 0),
      phraseBarsHint: essentia.phraseBars || 4,
      rawBeatPulse,
      onset,
      energy,
      lowBand,
      lowOnset,
      preprocessFlux,
    });

    const preprocessingConfidence = Math.round(clamp(
      (preprocessFlux * 28)
      + (lowOnset * 22)
      + (highOnset * 14)
      + (midOnset * 10)
      + (normalizedEnergy * 18)
      + (Math.max(lowBand, highBand) * 8),
      0,
      100
    ));
    const confidence = Math.round(clamp(
      (eConfidence * 0.26)
      + (eStableConfidence * 0.2)
      + (aConfidence * 0.1)
      + (convergence.barAnchorConfidence * 0.12)
      + (convergence.grooveConvergence * 0.08)
      + (preprocessingConfidence * 0.12)
      + (convergence.pllLock * 0.12),
      0,
      100
    ));
    const phraseBars = convergence.grooveConvergence >= 56 && convergence.barAnchorConfidence >= 52
      ? nearestPhraseBars(essentia.phraseBars || convergence.phraseBars || 4)
      : 4;

    this.snapshot = {
      sourceMode,
      tempo: convergence.tempo,
      confidence,
      energy,
      onset,
      barAnchorConfidence: convergence.barAnchorConfidence,
      phraseBars,
      grooveConvergence: convergence.grooveConvergence,
      beatInBar: convergence.beatInBar,
      phase: convergence.phase,
      barStart: convergence.barStart,
      downbeatPulse: convergence.downbeatPulse,
      anchorPulseCount: convergence.anchorPulseCount,
      nextBeatTime: convergence.nextBeatTime,
      stability: convergence.stability,
      tempoAgreement: convergence.tempoAgreement,
      essentiaTempo: eTempo,
      essentiaStableTempo: eStableTempo,
      essentiaConfidence: eConfidence,
      essentiaStableConfidence: eStableConfidence,
      essentiaAnchorConfidence: Math.round(Number(essentia.barAnchorConfidence || 0)),
      essentiaPhraseBars: nearestPhraseBars(essentia.phraseBars || 4),
      aubioTempo: aTempo,
      aubioConfidence: aConfidence,
      aubioOnset: Math.round(clamp(Number(aubio.onset || 0), 0, 1) * 100),
      aubioBeatPulse: Boolean(aubio.beatPulse),
      preprocessFlux: Math.round(preprocessFlux * 100),
      preprocessLow: Math.round(lowBand * 100),
      preprocessMid: Math.round(midBand * 100),
      preprocessHigh: Math.round(highBand * 100),
      preprocessLowOnset: Math.round(lowOnset * 100),
      preprocessMidOnset: Math.round(midOnset * 100),
      preprocessHighOnset: Math.round(highOnset * 100),
      preprocessNormalized: Math.round(normalizedEnergy * 100),
      preprocessGain: Math.round(preprocessGain * 100) / 100,
      fastTempo: convergence.fastTempo,
      mediumTempo: convergence.mediumTempo,
      longTempo: convergence.longTempo,
      activeHypothesis: convergence.activeHypothesis,
      phaseErrorMs: convergence.phaseErrorMs,
      innovationMs: convergence.innovationMs,
      pllLock: convergence.pllLock,
      pllState: convergence.pllState,
      internalPhase: convergence.internalPhase,
      barPosition: convergence.barPosition,
      nextBarTime: convergence.nextBarTime,
      outlierRejected: convergence.outlierRejected,
      outlierCount: convergence.outlierCount,
      windowMode: convergence.windowMode,
      timingModel: convergence.timingModel || this.timingModel,
      statusLabel: convergence.pllState === "Locked"
        ? "Anchored"
        : convergence.pllState === "Converging"
          ? "Locking"
          : convergence.pllState === "Acquiring"
            ? "Listening"
            : "Listening",
      summary: convergence.tempo > 0
        ? `Grid around ${convergence.tempo} BPM, phase ${convergence.phase || 1} of 4, anchor ${convergence.barAnchorConfidence}% and stability ${Math.round(convergence.stability * 100)}%. ${convergence.timingModel === "particle" ? "Particle grid" : "Kalman PLL"} ${convergence.pllState.toLowerCase()} at ${convergence.pllLock}% lock, phase error ${convergence.phaseErrorMs} ms, innovation ${convergence.innovationMs} ms, window ${convergence.windowMode}. Windows F:${convergence.fastTempo || 0} M:${convergence.mediumTempo || 0} L:${convergence.longTempo || 0}, mode ${convergence.activeHypothesis}${convergence.outlierRejected ? ", outlier rejected" : ""}.`
        : "Timing engine is listening for a stable pulse.",
    };
    return this.getSnapshot();
  }
}

function createAdaptiveTimingEngine() {
  return new AdaptiveTimingEngine();
}

export { AdaptiveTimingEngine, createAdaptiveTimingEngine };
