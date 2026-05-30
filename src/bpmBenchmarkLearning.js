function clamp(value, min, max) {
  return Math.min(Math.max(Number.isFinite(value) ? value : min, min), max);
}

function average(values) {
  if (!Array.isArray(values) || values.length === 0) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function normalizeModuleMetrics(moduleRun = {}) {
  const score = clamp(Number(moduleRun.score || 0) / 100, 0, 1);
  const confidence = clamp(Number(moduleRun.confidence || 0) / 100, 0, 1);
  const fitScore = clamp(Number(moduleRun.fitScore || 0), 0, 1);
  const delta = Math.abs(Number(moduleRun.delta || 0));
  const deltaCloseness = clamp(1 - (delta / 12), 0, 1);
  const downbeat = clamp(Number(moduleRun.downbeatBias || 0) / 1.35, 0, 1);
  const backbeat = clamp(Number(moduleRun.backbeatBias || 0) / 1.2, 0, 1);
  const tickAlignment = clamp(Number(moduleRun.tickAlignment || 0), 0, 1);
  const reference = clamp(
    Number(
      moduleRun.referenceFit?.score
      ?? moduleRun.referenceFit?.barScore
      ?? 0.5
    ),
    0,
    1,
  );
  const harmonic = clamp(Number(moduleRun.referenceFit?.harmonicScore ?? moduleRun.harmonicScore ?? 0.5), 0, 1);
  const phrase = clamp(Number(moduleRun.referenceFit?.phraseScore ?? moduleRun.phraseScore ?? 0.5), 0, 1);
  const anchorScore = clamp(
    Number(moduleRun.anchorScore ?? (
      (fitScore * 0.28)
      + (downbeat * 0.28)
      + (tickAlignment * 0.22)
      + (reference * 0.12)
      + (harmonic * 0.07)
      + (phrase * 0.03)
      + (backbeat * 0.06)
    )),
    0,
    1,
  );
  const structureScore = clamp(
    Number(moduleRun.structureScore ?? (
      (reference * 0.48)
      + (harmonic * 0.32)
      + (phrase * 0.2)
    )),
    0,
    1,
  );

  return {
    score,
    confidence,
    fitScore,
    delta,
    deltaCloseness,
    downbeat,
    backbeat,
    tickAlignment,
    reference,
    harmonic,
    phrase,
    anchorScore,
    structureScore,
  };
}

function buildBaseLearningScore(metrics) {
  return clamp(
    (metrics.score * 0.34)
    + (metrics.anchorScore * 0.29)
    + (metrics.structureScore * 0.13)
    + (metrics.deltaCloseness * 0.14)
    + (metrics.confidence * 0.1),
    0,
    1,
  );
}

function buildConfigDiff(previousConfig = {}, nextConfig = {}) {
  const keys = new Set([
    ...Object.keys(previousConfig || {}),
    ...Object.keys(nextConfig || {}),
  ]);
  const diff = {};
  keys.forEach((key) => {
    const before = Number(previousConfig?.[key]);
    const after = Number(nextConfig?.[key]);
    if (!Number.isFinite(before) || !Number.isFinite(after) || before === after) {
      return;
    }
    diff[key] = {
      before,
      after,
      change: after - before,
    };
  });
  return diff;
}

function buildGraphEdges(nodes = []) {
  const edges = [];
  for (let index = 1; index < nodes.length; index += 1) {
    const previous = nodes[index - 1];
    const current = nodes[index];
    const configDiff = buildConfigDiff(previous.config, current.config);
    const scoreDelta = current.baseLearningScore - previous.baseLearningScore;
    const anchorDelta = current.metrics.anchorScore - previous.metrics.anchorScore;
    const deltaImprovement = current.metrics.deltaCloseness - previous.metrics.deltaCloseness;
    const harmonicDelta = current.metrics.harmonic - previous.metrics.harmonic;
    const structureDelta = current.metrics.structureScore - previous.metrics.structureScore;
    edges.push({
      from: previous.id,
      to: current.id,
      scoreDelta,
      anchorDelta,
      deltaImprovement,
      harmonicDelta,
      structureDelta,
      improved: scoreDelta > 0.01,
      configDiff,
    });
  }
  return edges;
}

function buildParameterInfluence(edges = []) {
  const parameterInfluence = {};
  edges.forEach((edge) => {
    Object.entries(edge.configDiff || {}).forEach(([key, change]) => {
      const current = parameterInfluence[key] || {
        touches: 0,
        wins: 0,
        losses: 0,
        scoreLift: 0,
        anchorLift: 0,
        deltaLift: 0,
        harmonicLift: 0,
        structureLift: 0,
        averageChange: 0,
      };
      current.touches += 1;
      current.wins += edge.improved ? 1 : 0;
      current.losses += edge.improved ? 0 : 1;
      current.scoreLift += edge.scoreDelta;
      current.anchorLift += edge.anchorDelta;
      current.deltaLift += edge.deltaImprovement;
      current.harmonicLift += edge.harmonicDelta;
      current.structureLift += edge.structureDelta;
      current.averageChange += change.change;
      parameterInfluence[key] = current;
    });
  });

  Object.values(parameterInfluence).forEach((entry) => {
    entry.averageChange /= Math.max(entry.touches, 1);
    entry.averageScoreLift = entry.scoreLift / Math.max(entry.touches, 1);
    entry.averageAnchorLift = entry.anchorLift / Math.max(entry.touches, 1);
    entry.averageDeltaLift = entry.deltaLift / Math.max(entry.touches, 1);
    entry.averageHarmonicLift = entry.harmonicLift / Math.max(entry.touches, 1);
    entry.averageStructureLift = entry.structureLift / Math.max(entry.touches, 1);
    entry.netLift = (
      (entry.averageScoreLift * 0.31)
      + (entry.averageAnchorLift * 0.28)
      + (entry.averageStructureLift * 0.16)
      + (entry.averageHarmonicLift * 0.15)
      + (entry.averageDeltaLift * 0.1)
    );
  });

  return parameterInfluence;
}

function buildLearningProfile(edges = []) {
  const improvedEdges = edges.filter((edge) => edge.improved);
  const avgAnchorLift = average(improvedEdges.map((edge) => Math.max(0, edge.anchorDelta)));
  const avgDeltaLift = average(improvedEdges.map((edge) => Math.max(0, edge.deltaImprovement)));
  const avgScoreLift = average(improvedEdges.map((edge) => Math.max(0, edge.scoreDelta)));
  const avgHarmonicLift = average(improvedEdges.map((edge) => Math.max(0, edge.harmonicDelta)));
  const avgStructureLift = average(improvedEdges.map((edge) => Math.max(0, edge.structureDelta)));

  const rawWeights = {
    score: 0.24 + (avgScoreLift * 0.14),
    anchor: 0.26 + (avgAnchorLift * 0.16),
    structure: 0.14 + (avgStructureLift * 0.16),
    harmonic: 0.12 + (avgHarmonicLift * 0.18),
    delta: 0.12 + (avgDeltaLift * 0.08),
    confidence: 0.07,
    reference: 0.05 + (avgAnchorLift * 0.05),
  };
  const total = Object.values(rawWeights).reduce((sum, value) => sum + value, 0) || 1;

  return Object.fromEntries(
    Object.entries(rawWeights).map(([key, value]) => [key, value / total]),
  );
}

function computeLearningScore(metrics, profile) {
  return clamp(
    (metrics.score * profile.score)
    + (metrics.anchorScore * profile.anchor)
    + (metrics.structureScore * profile.structure)
    + (metrics.harmonic * profile.harmonic)
    + (metrics.deltaCloseness * profile.delta)
    + (metrics.confidence * profile.confidence)
    + (metrics.reference * profile.reference),
    0,
    1,
  );
}

function buildBenchmarkLearningGraph(history = [], moduleKey) {
  const validEntries = Array.isArray(history)
    ? history
      .filter((entry) => entry?.[moduleKey] && entry?.configs?.[moduleKey])
      .slice()
      .sort((left, right) => new Date(left?.savedAt || 0).getTime() - new Date(right?.savedAt || 0).getTime())
    : [];

  const nodes = validEntries.map((entry, index) => {
    const moduleRun = entry[moduleKey];
    const metrics = normalizeModuleMetrics(moduleRun);
    return {
      id: `${moduleKey}-${index}-${entry.savedAt || index}`,
      entry,
      config: entry.configs[moduleKey] || {},
      moduleRun,
      metrics,
      baseLearningScore: buildBaseLearningScore(metrics),
      learningScore: 0,
    };
  });

  const edges = buildGraphEdges(nodes);
  const parameterInfluence = buildParameterInfluence(edges);
  const profile = buildLearningProfile(edges);

  nodes.forEach((node) => {
    node.learningScore = computeLearningScore(node.metrics, profile);
  });

  const rankedNodes = [...nodes].sort((left, right) => {
    if (right.learningScore !== left.learningScore) {
      return right.learningScore - left.learningScore;
    }
    if (right.metrics.anchorScore !== left.metrics.anchorScore) {
      return right.metrics.anchorScore - left.metrics.anchorScore;
    }
    if (left.metrics.delta !== right.metrics.delta) {
      return left.metrics.delta - right.metrics.delta;
    }
    return new Date(right.entry?.savedAt || 0).getTime() - new Date(left.entry?.savedAt || 0).getTime();
  });

  return {
    moduleKey,
    profile,
    nodes,
    edges,
    rankedNodes,
    bestNode: rankedNodes[0] || null,
    parameterInfluence,
  };
}

function chooseBestBenchmarkRun(history = [], moduleKey) {
  const graph = buildBenchmarkLearningGraph(history, moduleKey);
  return {
    graph,
    bestEntry: graph.bestNode?.entry || null,
    rankedEntries: graph.rankedNodes.map((node) => node.entry),
  };
}

function buildBenchmarkEvolutionConfig(state = {}, moduleKey) {
  const currentConfig = state?.configs?.[moduleKey] || {};
  const latestRun = state?.latestRun?.[moduleKey] || null;
  const suggestedConfig = latestRun?.suggestedConfig || null;
  const history = Array.isArray(state?.history) ? state.history : [];
  const graph = buildBenchmarkLearningGraph(history, moduleKey);

  if (!suggestedConfig) {
    return {
      nextConfig: { ...currentConfig },
      appliedKeys: [],
      graph,
    };
  }

  const differingKeys = Object.keys(suggestedConfig)
    .filter((key) => suggestedConfig[key] !== currentConfig[key]);

  if (!differingKeys.length) {
    return {
      nextConfig: { ...currentConfig },
      appliedKeys: [],
      graph,
    };
  }

  const positivelyBiasedKeys = differingKeys.filter((key) => {
    const influence = graph.parameterInfluence[key];
    return !influence || influence.netLift >= -0.005;
  });

  const appliedKeys = positivelyBiasedKeys.length ? positivelyBiasedKeys : differingKeys.slice(0, 2);
  const nextConfig = { ...currentConfig };
  appliedKeys.forEach((key) => {
    nextConfig[key] = suggestedConfig[key];
  });

  return {
    nextConfig,
    appliedKeys,
    graph,
  };
}

export {
  buildBenchmarkEvolutionConfig,
  buildBenchmarkLearningGraph,
  chooseBestBenchmarkRun,
  normalizeModuleMetrics,
};
