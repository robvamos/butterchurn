import ambientPulse from "./ambient-pulse/index.js";
import breakbeatGuide from "./breakbeat-guide/index.js";
import pocketGroove from "./pocket-groove/index.js";
import reactiveKit from "./reactive-kit/index.js";
import { JammerEngine } from "./engine.js";
import { createEssentiaListener } from "./essentiaListener.js";
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

export { createEssentiaListener, createJammerEngine, createToneDrumBus, drummerCatalog };
