const defaultReactiveStrategies = [
  {
    id: "silence-count-time",
    name: "Silence Count Time",
    enabled: true,
    priority: 100,
    when: {
      sectionStates: ["silence", "pause"],
    },
    patch: {
      pulseMode: "count-time",
      bars: 4,
      variationEveryLoops: 8,
      loopMutation: "none",
    },
  },
  {
    id: "low-energy-count-time",
    name: "Low Energy Count Time",
    enabled: true,
    priority: 90,
    when: {
      sectionStates: ["low-energy", "break"],
      minEntryLevel: 2,
    },
    patch: {
      pulseMode: "count-time",
      bars: 4,
      variationEveryLoops: 8,
      loopMutation: "none",
    },
  },
  {
    id: "intro-hold",
    name: "Intro Hold",
    enabled: true,
    priority: 80,
    when: {
      sectionStates: ["intro"],
    },
    patch: {
      variationEveryLoops: 8,
      loopMutation: "none",
    },
  },
  {
    id: "build-lift",
    name: "Build Lift",
    enabled: true,
    priority: 60,
    when: {
      sectionStates: ["build"],
      minEntryLevel: 2,
    },
    patch: {
      variationEveryLoops: 4,
      loopMutation: "hat-lift",
    },
  },
  {
    id: "lift-accent",
    name: "Lift Accent",
    enabled: true,
    priority: 50,
    when: {
      sectionStates: ["lift"],
      minEntryLevel: 3,
    },
    patch: {
      variationEveryLoops: 4,
      loopMutation: "snare-ghost",
    },
  },
];

export { defaultReactiveStrategies };
