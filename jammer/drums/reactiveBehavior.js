import { defaultReactiveStrategies } from "./reactiveStrategies.js";

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function normalizeStrategies(strategies = []) {
  return (Array.isArray(strategies) && strategies.length > 0 ? strategies : defaultReactiveStrategies)
    .filter((strategy) => strategy && strategy.enabled !== false)
    .map((strategy) => ({
      ...strategy,
      priority: Number(strategy.priority ?? 0),
      when: strategy.when || {},
      patch: strategy.patch || {},
    }))
    .sort((left, right) => right.priority - left.priority);
}

function strategyMatches(strategy, context) {
  const when = strategy.when || {};
  const sectionStates = Array.isArray(when.sectionStates) ? when.sectionStates : [];
  if (sectionStates.length > 0 && !sectionStates.includes(context.sectionState)) {
    return false;
  }

  if (when.minEntryLevel !== undefined && context.entryLevel < Number(when.minEntryLevel)) {
    return false;
  }

  if (when.maxEntryLevel !== undefined && context.entryLevel > Number(when.maxEntryLevel)) {
    return false;
  }

  if (when.minEnergy !== undefined && context.energy < Number(when.minEnergy)) {
    return false;
  }

  if (when.maxEnergy !== undefined && context.energy > Number(when.maxEnergy)) {
    return false;
  }

  if (when.liveFollow !== undefined && Boolean(context.liveFollow) !== Boolean(when.liveFollow)) {
    return false;
  }

  return true;
}

function resolveSectionState({ liveFollow, phase, energy, onset, fillProbability }) {
  if (!liveFollow) {
    return "standby";
  }

  if (phase === "listening" || phase === "entering") {
    return "intro";
  }

  if (energy < 0.08 && onset < 0.05) {
    return "silence";
  }

  if (energy < 0.12 && onset < 0.08) {
    return "pause";
  }

  if (energy < 0.22 && onset < 0.14) {
    return "low-energy";
  }

  if (energy < 0.24 && fillProbability < 24) {
    return "break";
  }

  if (onset > 0.36 && energy > 0.5) {
    return "build";
  }

  if (fillProbability >= 62 && energy > 0.42) {
    return "lift";
  }

  return "steady";
}

function resolvePhraseBars({ liveFollow, sectionState, barAnchorConfidence, phraseBars }) {
  if (!liveFollow) {
    return 2;
  }

  if (sectionState === "silence" || sectionState === "pause" || sectionState === "low-energy" || sectionState === "break") {
    return 4;
  }

  if (barAnchorConfidence < 48) {
    return 4;
  }

  return clamp(Number(phraseBars || 4), 2, 8);
}

function resolveVariationEveryLoops(sectionState) {
  switch (sectionState) {
    case "intro":
    case "silence":
    case "pause":
    case "low-energy":
    case "break":
      return 8;
    case "build":
    case "lift":
      return 4;
    default:
      return 6;
  }
}

function resolveLoopMutation({ entryLevel, sectionState, fillProbability, densityTarget }) {
  if (
    entryLevel <= 1
    || sectionState === "silence"
    || sectionState === "pause"
    || sectionState === "low-energy"
    || sectionState === "break"
  ) {
    return "none";
  }

  if (sectionState === "build") {
    return "hat-lift";
  }

  if (sectionState === "lift" && entryLevel >= 4) {
    return "perc-tag";
  }

  if (sectionState === "lift" && entryLevel >= 3) {
    return "snare-ghost";
  }

  if (entryLevel >= 3 && fillProbability >= 52) {
    return "snare-ghost";
  }

  if (entryLevel >= 2 && densityTarget >= 56) {
    return "hat-lift";
  }

  return "kick-pickup";
}

function resolvePulseMode({ sectionState, energy, densityTarget, entryLevel }) {
  if (entryLevel <= 1) {
    return "kick-only";
  }

  if (
    sectionState === "silence"
    || sectionState === "pause"
    || sectionState === "low-energy"
    || sectionState === "break"
    || energy < 0.24
    || densityTarget < 36
  ) {
    return "count-time";
  }

  return "basic-time";
}

function deriveReactiveBehavior(input = {}, strategySet = []) {
  const liveFollow = Boolean(input.liveFollow);
  const phase = input.phase || "standby";
  const energy = Number(input.energy || 0);
  const onset = Number(input.onset || 0);
  const fillProbability = Number(input.fillProbability || 0);
  const densityTarget = Number(input.densityTarget || 0);
  const entryLevel = Number(input.entryLevel || 0);
  const barAnchorConfidence = Number(input.barAnchorConfidence || 0);
  const phraseBars = Number(input.phraseBars || 4);

  const sectionState = resolveSectionState({
    liveFollow,
    phase,
    energy,
    onset,
    fillProbability,
  });

  const bars = resolvePhraseBars({
    liveFollow,
    sectionState,
    barAnchorConfidence,
    phraseBars,
  });

  const baseBehavior = {
    sectionState,
    bars,
    variationEveryLoops: resolveVariationEveryLoops(sectionState),
    loopMutation: resolveLoopMutation({
      entryLevel,
      sectionState,
      fillProbability,
      densityTarget,
    }),
    pulseMode: resolvePulseMode({
      sectionState,
      energy,
      densityTarget,
      entryLevel,
    }),
  };

  const strategyContext = {
    liveFollow,
    phase,
    energy,
    onset,
    fillProbability,
    densityTarget,
    entryLevel,
    barAnchorConfidence,
    phraseBars,
    sectionState,
  };

  const matchedStrategy = normalizeStrategies(strategySet).find((strategy) => strategyMatches(strategy, strategyContext));
  if (!matchedStrategy) {
    return {
      ...baseBehavior,
      strategyId: "built-in",
      strategyName: "Built-in behavior",
    };
  }

  return {
    ...baseBehavior,
    ...(matchedStrategy.patch || {}),
    strategyId: matchedStrategy.id,
    strategyName: matchedStrategy.name,
  };
}

export { defaultReactiveStrategies, deriveReactiveBehavior };
