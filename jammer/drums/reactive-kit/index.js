const reactiveKit = {
  id: "reactive-kit",
  name: "Reactive Kit",
  summary: "Default live-follow drummer that reacts quickly while staying simple and readable.",
  defaultFeel: "assist",
  defaultPattern: "Kick anchors, snare answers, hats track energy",
  laneFocus: ["kick", "snare", "hat", "accent perc"],
  architecture: {
    listener: "AnalyserNode RMS + onset placeholders for live input",
    tracker: "Tempo confidence layer ready for Essentia.js or onset tracking",
    brain: "Adaptive groove rules with fill gates every 4 or 8 bars",
    engine: "Future Tone.js sampler/synth stack on the JamPal drum bus",
  },
  defaults: {
    intensity: 55,
    density: 48,
    swing: 8,
    humanize: 18,
  },
};

export default reactiveKit;
