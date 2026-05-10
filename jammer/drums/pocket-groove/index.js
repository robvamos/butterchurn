const pocketGroove = {
  id: "pocket-groove",
  name: "Pocket Groove",
  summary: "Steady support drummer aimed at sitting under a player without stealing the center.",
  defaultFeel: "steady",
  defaultPattern: "Backbeat pocket with simple hats and occasional fills",
  laneFocus: ["kick", "snare", "closed hat", "rim/ghost"],
  architecture: {
    listener: "Stable beat confidence + phrase energy tracking",
    tracker: "Locked BPM with gradual correction and bar memory",
    brain: "Rule-based pocket engine for 4/4 support patterns",
    engine: "Future Tone.js kit with conservative dynamics and swing",
  },
  defaults: {
    intensity: 52,
    density: 44,
    swing: 8,
    humanize: 14,
  },
};

export default pocketGroove;
