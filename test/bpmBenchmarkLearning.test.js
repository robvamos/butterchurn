import { describe, expect, test } from "@jest/globals";

import {
  buildBenchmarkEvolutionConfig,
  chooseBestBenchmarkRun,
} from "../src/bpmBenchmarkLearning.js";

function createRun({
  savedAt,
  score,
  delta,
  confidence,
  fitScore,
  downbeatBias,
  tickAlignment,
  anchorScore,
  referenceFit,
  config,
  suggestedConfig,
}) {
  return {
    savedAt,
    aubio: {
      score,
      delta,
      confidence,
      fitScore,
      downbeatBias,
      tickAlignment,
      anchorScore,
      referenceFit,
      config,
      suggestedConfig,
    },
    configs: {
      aubio: config,
    },
  };
}

describe("bpmBenchmarkLearning", () => {
  test("prefers the run with stronger beat-1 anchoring when scores are close", () => {
    const history = [
      createRun({
        savedAt: "2026-05-30T10:00:00.000Z",
        score: 94,
        delta: 0.4,
        confidence: 70,
        fitScore: 0.62,
        downbeatBias: 0.98,
        tickAlignment: 0.6,
        anchorScore: 0.58,
        referenceFit: {
          score: 0.56,
          phraseScore: 0.52,
          harmonicScore: 0.44,
        },
        config: {
          onsetThreshold: 0.18,
          lowWeight: 0.72,
          barSyncWeight: 0.28,
          harmonicAnchorWeight: 0.16,
        },
      }),
      createRun({
        savedAt: "2026-05-30T10:05:00.000Z",
        score: 93,
        delta: 0.7,
        confidence: 72,
        fitScore: 0.78,
        downbeatBias: 1.22,
        tickAlignment: 0.82,
        anchorScore: 0.81,
        referenceFit: {
          score: 0.82,
          phraseScore: 0.7,
          harmonicScore: 0.78,
        },
        config: {
          onsetThreshold: 0.18,
          lowWeight: 0.72,
          barSyncWeight: 0.38,
          harmonicAnchorWeight: 0.24,
        },
      }),
    ];

    const result = chooseBestBenchmarkRun(history, "aubio");

    expect(result.bestEntry?.savedAt).toBe("2026-05-30T10:05:00.000Z");
    expect(result.graph.bestNode?.metrics.anchorScore).toBeGreaterThan(0.8);
  });

  test("uses graph influence to skip suggestions that previously hurt beat-1 quality", () => {
    const history = [
      createRun({
        savedAt: "2026-05-30T10:00:00.000Z",
        score: 90,
        delta: 1.6,
        confidence: 69,
        fitScore: 0.72,
        downbeatBias: 1.1,
        tickAlignment: 0.76,
        anchorScore: 0.74,
        referenceFit: {
          score: 0.68,
          phraseScore: 0.58,
          harmonicScore: 0.5,
        },
        config: {
          lowWeight: 0.72,
          barSyncWeight: 0.28,
          harmonicAnchorWeight: 0.16,
        },
      }),
      createRun({
        savedAt: "2026-05-30T10:05:00.000Z",
        score: 87,
        delta: 2.2,
        confidence: 66,
        fitScore: 0.61,
        downbeatBias: 0.96,
        tickAlignment: 0.62,
        anchorScore: 0.57,
        referenceFit: {
          score: 0.54,
          phraseScore: 0.46,
          harmonicScore: 0.32,
        },
        config: {
          lowWeight: 0.82,
          barSyncWeight: 0.28,
          harmonicAnchorWeight: 0.16,
        },
      }),
      createRun({
        savedAt: "2026-05-30T10:10:00.000Z",
        score: 92,
        delta: 0.8,
        confidence: 71,
        fitScore: 0.79,
        downbeatBias: 1.24,
        tickAlignment: 0.84,
        anchorScore: 0.82,
        referenceFit: {
          score: 0.86,
          phraseScore: 0.78,
          harmonicScore: 0.84,
        },
        config: {
          lowWeight: 0.82,
          barSyncWeight: 0.38,
          harmonicAnchorWeight: 0.24,
        },
        suggestedConfig: {
          lowWeight: 0.9,
          barSyncWeight: 0.46,
          harmonicAnchorWeight: 0.3,
        },
      }),
    ];

    const state = {
      history,
      latestRun: {
        aubio: history[2].aubio,
      },
      configs: {
        aubio: history[2].configs.aubio,
      },
    };

    const plan = buildBenchmarkEvolutionConfig(state, "aubio");

    expect(plan.appliedKeys).toContain("barSyncWeight");
    expect(plan.appliedKeys).toContain("harmonicAnchorWeight");
    expect(plan.appliedKeys).not.toContain("lowWeight");
    expect(plan.nextConfig.barSyncWeight).toBe(0.46);
    expect(plan.nextConfig.harmonicAnchorWeight).toBe(0.3);
    expect(plan.nextConfig.lowWeight).toBe(0.82);
  });

  test("evolves toward harmonic and section settings when tonal cycles improve the graph score", () => {
    const history = [
      createRun({
        savedAt: "2026-05-30T11:00:00.000Z",
        score: 88,
        delta: 1.8,
        confidence: 68,
        fitScore: 0.7,
        downbeatBias: 1.05,
        tickAlignment: 0.73,
        anchorScore: 0.7,
        referenceFit: {
          score: 0.6,
          phraseScore: 0.48,
          harmonicScore: 0.34,
        },
        config: {
          tickWeight: 0.22,
          sectionSyncWeight: 0.22,
          harmonicAnchorWeight: 0.16,
          mixedEnvelopeWeight: 0.1,
        },
      }),
      createRun({
        savedAt: "2026-05-30T11:05:00.000Z",
        score: 91,
        delta: 1.1,
        confidence: 72,
        fitScore: 0.76,
        downbeatBias: 1.18,
        tickAlignment: 0.8,
        anchorScore: 0.79,
        referenceFit: {
          score: 0.76,
          phraseScore: 0.7,
          harmonicScore: 0.82,
        },
        config: {
          tickWeight: 0.26,
          sectionSyncWeight: 0.34,
          harmonicAnchorWeight: 0.28,
          mixedEnvelopeWeight: 0.08,
        },
      }),
      createRun({
        savedAt: "2026-05-30T11:10:00.000Z",
        score: 92,
        delta: 0.9,
        confidence: 74,
        fitScore: 0.79,
        downbeatBias: 1.24,
        tickAlignment: 0.84,
        anchorScore: 0.83,
        referenceFit: {
          score: 0.82,
          phraseScore: 0.78,
          harmonicScore: 0.88,
        },
        config: {
          tickWeight: 0.26,
          sectionSyncWeight: 0.34,
          harmonicAnchorWeight: 0.28,
          mixedEnvelopeWeight: 0.08,
        },
        suggestedConfig: {
          tickWeight: 0.3,
          sectionSyncWeight: 0.42,
          harmonicAnchorWeight: 0.34,
          mixedEnvelopeWeight: 0.06,
        },
      }),
    ];

    const state = {
      history,
      latestRun: {
        aubio: history[2].aubio,
      },
      configs: {
        aubio: history[2].configs.aubio,
      },
    };

    const plan = buildBenchmarkEvolutionConfig(state, "aubio");

    expect(plan.appliedKeys).toContain("sectionSyncWeight");
    expect(plan.appliedKeys).toContain("harmonicAnchorWeight");
    expect(plan.nextConfig.sectionSyncWeight).toBe(0.42);
    expect(plan.nextConfig.harmonicAnchorWeight).toBe(0.34);
  });
});
