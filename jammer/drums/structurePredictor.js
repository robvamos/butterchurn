function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function nearestSectionLength(value = 8) {
  const options = [2, 4, 8, 16];
  const numeric = Number(value || 8);
  return options.reduce((best, current) => (
    Math.abs(current - numeric) < Math.abs(best - numeric) ? current : best
  ), 8);
}

function average(list) {
  if (!Array.isArray(list) || list.length === 0) {
    return 0;
  }
  return list.reduce((sum, value) => sum + value, 0) / list.length;
}

function averageBarMetrics(bars) {
  return {
    energy: average(bars.map((bar) => bar.energy)),
    onset: average(bars.map((bar) => bar.onset)),
    low: average(bars.map((bar) => bar.low)),
    mid: average(bars.map((bar) => bar.mid)),
    high: average(bars.map((bar) => bar.high)),
    rhythmDensity: average(bars.map((bar) => bar.rhythmDensity)),
    harmonicChange: average(bars.map((bar) => bar.harmonicChange)),
    harmonicStability: average(bars.map((bar) => bar.harmonicStability)),
    vocalLikelihood: average(bars.map((bar) => bar.vocalLikelihood)),
    roots: bars.map((bar) => bar.harmonicRoot).filter((value) => value && value !== "?"),
  };
}

function dominantRoot(roots = []) {
  if (!roots.length) {
    return "?";
  }

  const counts = new Map();
  roots.forEach((root) => {
    counts.set(root, (counts.get(root) || 0) + 1);
  });

  return Array.from(counts.entries()).sort((left, right) => right[1] - left[1])[0]?.[0] || "?";
}

function buildSignature(bars) {
  const metrics = averageBarMetrics(bars);
  const root = dominantRoot(metrics.roots);
  const energyBand = Math.round(metrics.energy / 12);
  const densityBand = Math.round(metrics.rhythmDensity / 12);
  const harmonicBand = Math.round(metrics.harmonicChange / 12);
  const repetitionHash = `${root}:${energyBand}:${densityBand}:${harmonicBand}:${Math.round(metrics.vocalLikelihood / 20)}`;

  return {
    energy: Math.round(metrics.energy),
    harmony: Math.round(((metrics.harmonicStability * 0.55) + (metrics.harmonicChange * 0.45)) * 100) / 100,
    rhythmDensity: Math.round(metrics.rhythmDensity),
    spectralShape: {
      low: Math.round(metrics.low),
      mid: Math.round(metrics.mid),
      high: Math.round(metrics.high),
    },
    repetitionHash,
    vocalLikelihood: Math.round(metrics.vocalLikelihood),
    harmonicRoot: root,
  };
}

function similarityBetweenSignatures(left, right) {
  if (!left || !right) {
    return 0;
  }

  const energyScore = 1 - (Math.abs(left.energy - right.energy) / 100);
  const densityScore = 1 - (Math.abs(left.rhythmDensity - right.rhythmDensity) / 100);
  const vocalScore = 1 - (Math.abs(left.vocalLikelihood - right.vocalLikelihood) / 100);
  const lowScore = 1 - (Math.abs(left.spectralShape.low - right.spectralShape.low) / 100);
  const midScore = 1 - (Math.abs(left.spectralShape.mid - right.spectralShape.mid) / 100);
  const highScore = 1 - (Math.abs(left.spectralShape.high - right.spectralShape.high) / 100);
  const harmonyScore = 1 - (Math.abs(left.harmony - right.harmony) / 100);
  const rootScore = left.harmonicRoot !== "?" && left.harmonicRoot === right.harmonicRoot ? 1 : 0.35;
  const hashScore = left.repetitionHash === right.repetitionHash ? 1 : 0;

  return clamp(
    (energyScore * 0.16)
    + (densityScore * 0.18)
    + (vocalScore * 0.08)
    + (lowScore * 0.1)
    + (midScore * 0.1)
    + (highScore * 0.08)
    + (harmonyScore * 0.1)
    + (rootScore * 0.1)
    + (hashScore * 0.1),
    0,
    1
  );
}

function grammarNextSection(currentSection, hasSeenChorus) {
  const grammar = {
    intro: { verse: 0.46, chorus: 0.18, break: 0.12, unknown: 0.24 },
    verse: { chorus: 0.42, verse: 0.14, bridge: 0.16, solo: 0.06, break: 0.1, outro: 0.12 },
    chorus: { verse: 0.24, bridge: 0.22, chorus: 0.12, solo: 0.08, break: 0.12, outro: 0.22 },
    bridge: { chorus: 0.44, solo: 0.14, verse: 0.16, break: 0.14, outro: 0.12 },
    solo: { chorus: 0.34, verse: 0.16, break: 0.16, bridge: 0.16, outro: 0.18 },
    break: { chorus: 0.28, verse: 0.24, break: 0.12, outro: 0.18, solo: 0.18 },
    outro: { outro: 1 },
    unknown: { verse: 0.28, chorus: hasSeenChorus ? 0.22 : 0.14, intro: 0.16, break: 0.12, bridge: 0.1, outro: 0.12 },
  };

  const scores = grammar[currentSection] || grammar.unknown;
  return Object.entries(scores).sort((left, right) => right[1] - left[1])[0]?.[0] || "unknown";
}

function classifySectionType({
  signature,
  totalBars,
  barsIntoSection,
  repetition,
  previousSectionType,
}) {
  const energy = signature.energy;
  const density = signature.rhythmDensity;
  const vocal = signature.vocalLikelihood;
  const harmony = signature.harmony;

  if (totalBars <= 4 && energy < 42 && density < 44) {
    return "intro";
  }

  if (energy < 18 && density < 20) {
    return totalBars >= 24 ? "outro" : "break";
  }

  if (barsIntoSection >= 4 && totalBars >= 24 && energy < 28 && repetition < 0.35) {
    return "outro";
  }

  if (energy >= 66 && density >= 62) {
    return repetition >= 0.62 || previousSectionType === "chorus" ? "chorus" : "chorus";
  }

  if (density < 36 && energy < 36) {
    return "break";
  }

  if (harmony >= 46 && repetition < 0.46 && barsIntoSection >= 4) {
    return "bridge";
  }

  if (vocal < 34 && energy >= 48 && density >= 44 && repetition < 0.52) {
    return "solo";
  }

  if (repetition >= 0.58 && energy >= 28 && energy <= 64) {
    return "verse";
  }

  if (previousSectionType === "intro" && energy >= 30) {
    return "verse";
  }

  return "unknown";
}

function suggestedActionForTransition({ currentSection, nextLikelySection, barsToTransition, transitionConfidence }) {
  if (barsToTransition <= 1 && transitionConfidence >= 66) {
    if (nextLikelySection === "chorus") {
      return "prepare_fill";
    }
    if (nextLikelySection === "break" || nextLikelySection === "outro") {
      return "simplify";
    }
    if (nextLikelySection === "bridge" || nextLikelySection === "solo") {
      return "open_space";
    }
  }

  if (currentSection === "intro" || currentSection === "break") {
    return "hold_back";
  }

  if (currentSection === "chorus") {
    return "support_open";
  }

  return "steady_support";
}

class AdaptiveSongFormPredictor {
  constructor() {
    this.reset();
  }

  reset() {
    this.totalBars = 0;
    this.lastBarAcceptedAt = 0;
    this.pendingBar = this.createPendingBar();
    this.barHistory = [];
    this.completedSections = [];
    this.currentSection = null;
    this.lastBarStartSignature = 0;
    this.snapshot = {
      currentSection: "unknown",
      barsIntoSection: 0,
      expectedSectionLength: 8,
      nextLikelySection: "unknown",
      barsToTransition: 8,
      transitionConfidence: 0,
      confidence: 0,
      suggestedDrumAction: "steady_support",
      formHypothesis: "A",
      sectionCount: 0,
      repetitionConfidence: 0,
      signature: null,
    };
  }

  createPendingBar() {
    return {
      frames: 0,
      energy: 0,
      onset: 0,
      low: 0,
      mid: 0,
      high: 0,
      rhythmDensity: 0,
      harmonicChange: 0,
      harmonicStability: 0,
      harmonicRootVotes: [],
      vocalLikelihood: 0,
    };
  }

  pushFrame(frame = {}) {
    this.pendingBar.frames += 1;
    this.pendingBar.energy += Number(frame.energy || 0) * 100;
    this.pendingBar.onset += Number(frame.onset || 0) * 100;
    this.pendingBar.low += Number(frame.low || 0);
    this.pendingBar.mid += Number(frame.mid || 0);
    this.pendingBar.high += Number(frame.high || 0);
    this.pendingBar.rhythmDensity += clamp(
      ((Number(frame.onset || 0) * 55)
      + (Number(frame.preprocessFlux || 0) * 20)
      + (Number(frame.lowOnset || 0) * 15)
      + (Number(frame.highOnset || 0) * 10)),
      0,
      100
    );
    this.pendingBar.harmonicChange += Number(frame.harmonicChange || 0);
    this.pendingBar.harmonicStability += Number(frame.harmonicStability || 0) / 100;
    const harmonicRoot = frame.harmonicRoot || "?";
    if (harmonicRoot !== "?") {
      this.pendingBar.harmonicRootVotes.push(harmonicRoot);
    }
    const vocalLikelihood = clamp(
      (Number(frame.preprocessMid || 0) * 0.58)
      + ((100 - Number(frame.preprocessLow || 0)) * 0.14)
      + ((100 - Number(frame.preprocessFlux || 0)) * 0.12)
      + ((100 - Number(frame.harmonicChange || 0)) * 0.16),
      0,
      100
    );
    this.pendingBar.vocalLikelihood += vocalLikelihood;
  }

  commitBar() {
    const frames = Math.max(1, this.pendingBar.frames);
    this.totalBars += 1;
    const root = dominantRoot(this.pendingBar.harmonicRootVotes);
    const bar = {
      barNumber: this.totalBars,
      energy: Math.round(this.pendingBar.energy / frames),
      onset: Math.round(this.pendingBar.onset / frames),
      low: Math.round(this.pendingBar.low / frames),
      mid: Math.round(this.pendingBar.mid / frames),
      high: Math.round(this.pendingBar.high / frames),
      rhythmDensity: Math.round(this.pendingBar.rhythmDensity / frames),
      harmonicChange: Math.round(this.pendingBar.harmonicChange / frames),
      harmonicStability: clamp(this.pendingBar.harmonicStability / frames, 0, 1),
      harmonicRoot: root,
      vocalLikelihood: Math.round(this.pendingBar.vocalLikelihood / frames),
    };
    this.barHistory.push(bar);
    this.barHistory = this.barHistory.slice(-64);
    this.pendingBar = this.createPendingBar();
    return bar;
  }

  ensureCurrentSection(expectedSectionLength) {
    if (this.currentSection) {
      return;
    }

    this.currentSection = {
      startBar: Math.max(1, this.totalBars),
      bars: [],
      type: "unknown",
      confidence: 0,
      expectedSectionLength,
      signature: null,
    };
  }

  updateSectionState({ phraseBars, stability, confidence }) {
    const expectedSectionLength = nearestSectionLength(
      phraseBars >= 8 ? 16 : phraseBars >= 6 ? 8 : phraseBars >= 4 ? 8 : 4
    );
    this.ensureCurrentSection(expectedSectionLength);
    this.currentSection.expectedSectionLength = expectedSectionLength;

    const bar = this.barHistory[this.barHistory.length - 1];
    if (!bar) {
      return;
    }

    this.currentSection.bars.push(bar);
    const signature = buildSignature(this.currentSection.bars);
    this.currentSection.signature = signature;
    const previousMatches = this.completedSections
      .map((section) => ({
        type: section.type,
        similarity: similarityBetweenSignatures(signature, section.signature),
      }))
      .sort((left, right) => right.similarity - left.similarity);
    const repetition = previousMatches[0]?.similarity || 0;
    const previousSectionType = this.completedSections[this.completedSections.length - 1]?.type || "unknown";
    const sectionType = classifySectionType({
      signature,
      totalBars: this.totalBars,
      barsIntoSection: this.currentSection.bars.length,
      repetition,
      previousSectionType,
    });
    this.currentSection.type = sectionType;
    this.currentSection.confidence = Math.round(clamp(
      (repetition * 36)
      + (confidence * 0.22)
      + (stability * 100 * 0.22)
      + (this.currentSection.bars.length / Math.max(2, expectedSectionLength) * 20),
      0,
      100
    ));

    if (this.currentSection.bars.length >= expectedSectionLength) {
      this.completedSections.push({
        type: this.currentSection.type,
        startBar: this.currentSection.startBar,
        lengthBars: this.currentSection.bars.length,
        confidence: this.currentSection.confidence / 100,
        signature: this.currentSection.signature,
      });
      this.completedSections = this.completedSections.slice(-12);
      this.currentSection = {
        startBar: this.totalBars + 1,
        bars: [],
        type: this.currentSection.type,
        confidence: this.currentSection.confidence,
        expectedSectionLength,
        signature: this.currentSection.signature,
      };
    }

    const activeSection = this.currentSection.bars.length > 0
      ? this.currentSection
      : this.completedSections[this.completedSections.length - 1];
    const currentType = activeSection?.type || sectionType || "unknown";
    const barsIntoSection = Math.max(0, activeSection?.bars?.length || 0);
    const nextLikelySection = grammarNextSection(
      currentType,
      this.completedSections.some((section) => section.type === "chorus")
    );
    const barsToTransition = Math.max(0, expectedSectionLength - barsIntoSection);
    const transitionConfidence = Math.round(clamp(
      (activeSection?.confidence || 0) * 0.52
      + ((expectedSectionLength > 0 ? (1 - (barsToTransition / expectedSectionLength)) : 0) * 28)
      + (repetition * 20),
      0,
      100
    ));
    const suggestedDrumAction = suggestedActionForTransition({
      currentSection: currentType,
      nextLikelySection,
      barsToTransition,
      transitionConfidence,
    });
    const formHypothesis = this.completedSections
      .map((section, index) => `${String.fromCharCode(65 + Math.min(index, 25))}:${section.type}`)
      .slice(-6)
      .join(" - ") || "A";

    this.snapshot = {
      currentSection: currentType,
      barsIntoSection,
      expectedSectionLength,
      nextLikelySection,
      barsToTransition,
      transitionConfidence,
      confidence: activeSection?.confidence || 0,
      suggestedDrumAction,
      formHypothesis,
      sectionCount: this.completedSections.length,
      repetitionConfidence: Math.round(repetition * 100),
      signature: activeSection?.signature || signature,
    };
  }

  update({
    detectionActive = false,
    sourceMode = "none",
    tempo = 0,
    phraseBars = 4,
    barStart = false,
    energy = 0,
    onset = 0,
    preprocessLow = 0,
    preprocessMid = 0,
    preprocessHigh = 0,
    preprocessFlux = 0,
    preprocessLowOnset = 0,
    preprocessHighOnset = 0,
    harmonicChange = 0,
    harmonicStability = 0,
    harmonicRoot = "?",
    barAnchorConfidence = 0,
    stability = 0,
    confidence = 0,
  } = {}) {
    if (!detectionActive || sourceMode === "none" || !tempo) {
      this.reset();
      return { ...this.snapshot };
    }

    this.pushFrame({
      energy,
      onset,
      low: preprocessLow,
      mid: preprocessMid,
      high: preprocessHigh,
      preprocessFlux,
      lowOnset: preprocessLowOnset,
      highOnset: preprocessHighOnset,
      harmonicChange,
      harmonicStability,
      harmonicRoot,
    });

    if (barStart) {
      const now = typeof performance !== "undefined" && performance.now ? performance.now() : Date.now();
      if (!this.lastBarAcceptedAt || (now - this.lastBarAcceptedAt) > 420) {
        this.lastBarAcceptedAt = now;
        this.commitBar();
        this.updateSectionState({
          phraseBars,
          stability,
          confidence,
          barAnchorConfidence,
        });
      }
    }

    return { ...this.snapshot };
  }

  getSnapshot() {
    return { ...this.snapshot };
  }
}

function createAdaptiveSongFormPredictor() {
  return new AdaptiveSongFormPredictor();
}

export {
  AdaptiveSongFormPredictor,
  createAdaptiveSongFormPredictor,
};
