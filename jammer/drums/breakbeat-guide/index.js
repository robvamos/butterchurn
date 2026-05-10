const breakbeatGuide = {
  id: "breakbeat-guide",
  name: "Breakbeat Guide",
  summary: "Faster transient-led drummer that can sketch syncopated support for electronic grooves.",
  defaultFeel: "push",
  defaultPattern: "Broken kick/snare spine with hat chatter",
  laneFocus: ["kick", "snare", "hat", "ghost perc"],
  architecture: {
    listener: "Onset-heavy transient capture with density scoring",
    tracker: "Fast BPM bias with burst suppression",
    brain: "Syncopation-aware groove map with turn-around fills",
    engine: "Future Tone.js chopped-break sampler with transient ducking",
  },
  defaults: {
    intensity: 68,
    density: 64,
    swing: 10,
    humanize: 16,
  },
};

export default breakbeatGuide;
