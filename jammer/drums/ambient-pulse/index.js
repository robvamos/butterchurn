const ambientPulse = {
  id: "ambient-pulse",
  name: "Ambient Pulse",
  summary: "Sparse pulse drummer for pads, drones, and open space between phrases.",
  defaultFeel: "space",
  defaultPattern: "Airy kick + hat wash every 8 bars",
  laneFocus: ["sub kick", "brush snare", "noisy hat", "texture perc"],
  architecture: {
    listener: "Energy floor + spectral brightness gate",
    tracker: "Slow tempo confidence with gentle drift tolerance",
    brain: "Space-first phrase engine with low-density fills",
    engine: "Future Tone.js brush kit plus filtered texture layer",
  },
  defaults: {
    intensity: 38,
    density: 24,
    swing: 4,
    humanize: 28,
  },
};

export default ambientPulse;
