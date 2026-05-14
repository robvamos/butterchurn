import ambientPulse from "./ambient-pulse/index.js";
import breakbeatGuide from "./breakbeat-guide/index.js";
import pocketGroove from "./pocket-groove/index.js";
import reactiveKit from "./reactive-kit/index.js";
import { createAdaptiveTimingEngine } from "./adaptiveTiming.js";
import { createRhythmConvergenceEngine } from "./rhythmConvergence.js";
import { createAdaptiveSongFormPredictor } from "./structurePredictor.js";
import { createBpmBenchmarkAnalyzer } from "./bpmBenchmarkAnalyzer.js";
import { createOfflineSongAnalyzer } from "./offlineSongAnalyzer.js";
import { createAubioListener } from "./aubioListener.js";
import { JammerEngine } from "./engine.js";
import { createEssentiaListener } from "./essentiaListener.js";
import { deriveReactiveBehavior } from "./reactiveBehavior.js";
import { createToneDrumBus } from "./toneDrumBus.js";

const drummerCatalog = [
  reactiveKit,
  pocketGroove,
  ambientPulse,
  breakbeatGuide,
];

function createJammerEngine() {
  return new JammerEngine(drummerCatalog);
}

export {
  createAdaptiveTimingEngine,
  createAdaptiveSongFormPredictor,
  createAubioListener,
  createBpmBenchmarkAnalyzer,
  createEssentiaListener,
  createJammerEngine,
  createOfflineSongAnalyzer,
  createRhythmConvergenceEngine,
  createToneDrumBus,
  deriveReactiveBehavior,
  drummerCatalog,
};
