function getToneGlobal() {
  const tone = globalThis.Tone;
  if (!tone) {
    throw new Error("Tone.js global bundle is not available");
  }

  return tone;
}

const DEFAULT_DECK_BLUEPRINT = [
  { catalogId: "kick-punch", enabled: true, volume: 0.92 },
  { catalogId: "snare-tight", enabled: true, volume: 0.88 },
  { catalogId: "hat-bright", enabled: true, volume: 0.72 },
];

const TONE_INSTRUMENT_CATALOG = [
  {
    id: "kick-punch",
    name: "Punch Kick",
    group: "Kick",
    role: "kick",
    engine: "MembraneSynth",
    create: (tone, output) =>
      new tone.MembraneSynth({
        pitchDecay: 0.04,
        octaves: 6,
        envelope: { attack: 0.001, decay: 0.34, sustain: 0, release: 0.08 },
      }).connect(output),
    applyConfig: (node, config) => {
      node.pitchDecay = Math.max(0.01, Number(config.kickDecay || 34) / 100);
      node.envelope.decay = Math.max(0.08, Number(config.kickDecay || 34) / 100);
    },
    trigger: (tone, node, config, time, velocity) => {
      const note = tone.Frequency(Number(config.kickPitch || 38), "midi").toNote();
      node.triggerAttackRelease(note, "8n", time, velocity);
    },
  },
  {
    id: "kick-round",
    name: "Round Kick",
    group: "Kick",
    role: "kick",
    engine: "MembraneSynth",
    create: (tone, output) =>
      new tone.MembraneSynth({
        pitchDecay: 0.02,
        octaves: 4,
        envelope: { attack: 0.001, decay: 0.48, sustain: 0, release: 0.12 },
      }).connect(output),
    applyConfig: (node, config) => {
      node.pitchDecay = Math.max(0.01, Number(config.kickDecay || 34) / 140);
      node.envelope.decay = Math.max(0.1, Number(config.kickDecay || 34) / 80);
    },
    trigger: (tone, node, config, time, velocity) => {
      const note = tone.Frequency(Math.max(24, Number(config.kickPitch || 38) - 4), "midi").toNote();
      node.triggerAttackRelease(note, "8n", time, velocity);
    },
  },
  {
    id: "snare-tight",
    name: "Tight Snare",
    group: "Snare",
    role: "snare",
    engine: "NoiseSynth",
    create: (tone, output) =>
      new tone.NoiseSynth({
        noise: { type: "white" },
        envelope: { attack: 0.001, decay: 0.18, sustain: 0 },
      }).connect(output),
    applyConfig: (node, config) => {
      node.envelope.decay = Math.max(0.05, Number(config.snareDecay || 18) / 100);
    },
    trigger: (_tone, node, _config, time, velocity, duration = "16n") => {
      node.triggerAttackRelease(duration, time, velocity);
    },
  },
  {
    id: "snare-wide",
    name: "Wide Snare",
    group: "Snare",
    role: "snare",
    engine: "NoiseSynth",
    create: (tone, output) =>
      new tone.NoiseSynth({
        noise: { type: "pink" },
        envelope: { attack: 0.001, decay: 0.24, sustain: 0 },
        volume: -2,
      }).connect(output),
    applyConfig: (node, config) => {
      node.envelope.decay = Math.max(0.08, Number(config.snareDecay || 18) / 80);
    },
    trigger: (_tone, node, _config, time, velocity, duration = "16n") => {
      node.triggerAttackRelease(duration, time, velocity);
    },
  },
  {
    id: "hat-bright",
    name: "Bright Hat",
    group: "Hat",
    role: "hat",
    engine: "NoiseSynth + Filter",
    create: (tone, output) => {
      const filter = new tone.Filter({
        type: "highpass",
        frequency: 4200,
        rolloff: -24,
        Q: 1,
      }).connect(output);
      const synth = new tone.NoiseSynth({
        noise: { type: "white" },
        envelope: { attack: 0.001, decay: 0.06, sustain: 0 },
        volume: -2,
      }).connect(filter);
      return { synth, filter };
    },
    applyConfig: (node, config) => {
      node.filter.frequency.value = 2600 + (Number(config.hatBrightness || 52) / 100) * 6200;
    },
    trigger: (_tone, node, _config, time, velocity, duration = "32n") => {
      node.synth.triggerAttackRelease(duration, time, velocity);
    },
  },
  {
    id: "hat-soft",
    name: "Soft Hat",
    group: "Hat",
    role: "hat",
    engine: "NoiseSynth + Filter",
    create: (tone, output) => {
      const filter = new tone.Filter({
        type: "bandpass",
        frequency: 3400,
        rolloff: -24,
        Q: 1.8,
      }).connect(output);
      const synth = new tone.NoiseSynth({
        noise: { type: "pink" },
        envelope: { attack: 0.001, decay: 0.08, sustain: 0 },
        volume: -6,
      }).connect(filter);
      return { synth, filter };
    },
    applyConfig: (node, config) => {
      node.filter.frequency.value = 1800 + (Number(config.hatBrightness || 52) / 100) * 4200;
    },
    trigger: (_tone, node, _config, time, velocity, duration = "16n") => {
      node.synth.triggerAttackRelease(duration, time, velocity);
    },
  },
  {
    id: "perc-click",
    name: "Click Perc",
    group: "Perc",
    role: "perc",
    engine: "Synth",
    create: (tone, output) =>
      new tone.Synth({
        oscillator: { type: "square" },
        envelope: { attack: 0.001, decay: 0.04, sustain: 0, release: 0.02 },
        volume: -8,
      }).connect(output),
    applyConfig: () => {},
    trigger: (_tone, node, _config, time, velocity) => {
      node.triggerAttackRelease("C6", "32n", time, velocity);
    },
  },
  {
    id: "perc-blip",
    name: "Blip Perc",
    group: "Perc",
    role: "perc",
    engine: "Synth",
    create: (tone, output) =>
      new tone.Synth({
        oscillator: { type: "triangle" },
        envelope: { attack: 0.001, decay: 0.08, sustain: 0, release: 0.03 },
        volume: -6,
      }).connect(output),
    applyConfig: () => {},
    trigger: (_tone, node, _config, time, velocity) => {
      node.triggerAttackRelease("G5", "32n", time, velocity);
    },
  },
  {
    id: "metal-cymbal",
    name: "Metal Cymbal",
    group: "Hat",
    role: "hat",
    engine: "MetalSynth",
    create: (tone, output) =>
      new tone.MetalSynth({
        frequency: 280,
        envelope: { attack: 0.001, decay: 0.18, release: 0.04 },
        harmonicity: 7,
        modulationIndex: 36,
        resonance: 4200,
        octaves: 2,
        volume: -6,
      }).connect(output),
    applyConfig: (node, config) => {
      node.frequency = 180 + (Number(config.hatBrightness || 52) / 100) * 260;
      node.resonance = 2600 + (Number(config.hatBrightness || 52) / 100) * 4200;
    },
    trigger: (_tone, node, _config, time, velocity, duration = "32n") => {
      node.triggerAttackRelease(duration, time, velocity);
    },
  },
  {
    id: "mono-thump",
    name: "Mono Thump",
    group: "Synth",
    role: "perc",
    engine: "MonoSynth",
    create: (tone, output) =>
      new tone.MonoSynth({
        oscillator: { type: "square" },
        filter: { Q: 1.2, type: "lowpass", rolloff: -24 },
        envelope: { attack: 0.001, decay: 0.09, sustain: 0, release: 0.06 },
        volume: -8,
      }).connect(output),
    applyConfig: () => {},
    trigger: (_tone, node, _config, time, velocity) => {
      node.triggerAttackRelease("C3", "32n", time, velocity);
    },
  },
  {
    id: "fm-clang",
    name: "FM Clang",
    group: "Synth",
    role: "perc",
    engine: "FMSynth",
    create: (tone, output) =>
      new tone.FMSynth({
        harmonicity: 3,
        modulationIndex: 12,
        envelope: { attack: 0.001, decay: 0.12, sustain: 0, release: 0.08 },
        modulation: { type: "square" },
        modulationEnvelope: { attack: 0.001, decay: 0.08, sustain: 0, release: 0.03 },
        volume: -10,
      }).connect(output),
    applyConfig: () => {},
    trigger: (_tone, node, _config, time, velocity) => {
      node.triggerAttackRelease("E5", "32n", time, velocity);
    },
  },
  {
    id: "am-chime",
    name: "AM Chime",
    group: "Synth",
    role: "perc",
    engine: "AMSynth",
    create: (tone, output) =>
      new tone.AMSynth({
        harmonicity: 2,
        envelope: { attack: 0.001, decay: 0.14, sustain: 0, release: 0.08 },
        modulation: { type: "triangle" },
        modulationEnvelope: { attack: 0.001, decay: 0.08, sustain: 0, release: 0.03 },
        volume: -10,
      }).connect(output),
    applyConfig: () => {},
    trigger: (_tone, node, _config, time, velocity) => {
      node.triggerAttackRelease("A5", "32n", time, velocity);
    },
  },
  {
    id: "pluck-pop",
    name: "Pluck Pop",
    group: "Synth",
    role: "perc",
    engine: "PluckSynth",
    create: (tone, output) =>
      new tone.PluckSynth({
        attackNoise: 1,
        dampening: 2800,
        resonance: 0.78,
        volume: -8,
      }).connect(output),
    applyConfig: () => {},
    trigger: (_tone, node, _config, time, velocity) => {
      node.triggerAttackRelease("D5", time, velocity);
    },
  },
  {
    id: "duo-glide",
    name: "Duo Glide",
    group: "Synth",
    role: "perc",
    engine: "DuoSynth",
    create: (tone, output) =>
      new tone.DuoSynth({
        harmonicity: 1.5,
        voice0: { oscillator: { type: "sawtooth" } },
        voice1: { oscillator: { type: "triangle" } },
        volume: -12,
      }).connect(output),
    applyConfig: () => {},
    trigger: (_tone, node, _config, time, velocity) => {
      node.triggerAttackRelease("G4", "32n", time, velocity);
    },
  },
  {
    id: "basic-synth",
    name: "Basic Synth",
    group: "Synth",
    role: "perc",
    engine: "Synth",
    create: (tone, output) =>
      new tone.Synth({
        oscillator: { type: "triangle" },
        envelope: { attack: 0.001, decay: 0.1, sustain: 0, release: 0.05 },
        volume: -10,
      }).connect(output),
    applyConfig: () => {},
    trigger: (_tone, node, _config, time, velocity) => {
      node.triggerAttackRelease("C5", "32n", time, velocity);
    },
  },
];

class ToneDrumBus {
  constructor() {
    this.output = null;
    this.deck = [];
    this.deckNodes = new Map();
    this.started = false;
    this.tone = getToneGlobal();
    this.sequence = null;
    this.scheduleId = null;
    this.patternTimer = null;
    this.currentPatternIndex = 0;
    this.activeSteps = [];
    this.activePatternName = "";
    this.activePattern = "";
    this.lastConfig = null;
    this.outputGain = 0.72;
    this.analysisReferenceReady = true;
    this.labJamActive = false;
    this.absoluteStepCount = 0;
    this.loopState = {
      active: false,
      pattern: "standby",
      totalSteps: 0,
      currentStep: 0,
      currentBar: 0,
      stepInBar: 0,
      cycle: 0,
      currentEvents: [],
      currentVoices: [],
      currentBarSteps: [],
      progress: 0,
    };
    this.labConfig = {
      kickPitch: 38,
      kickDecay: 34,
      snareDecay: 18,
      hatBrightness: 52,
    };
    this.roleCursor = {
      kick: 0,
      snare: 0,
      hat: 0,
      perc: 0,
    };
    this.lastReactiveRealignAt = 0;
    this.pendingReactiveConfig = null;
    this.completedPatternCycles = 0;
  }

  getVersion() {
    return this.tone.version || "unknown";
  }

  getSummary() {
    return {
      installed: true,
      version: this.getVersion(),
      transportState: this.patternTimer ? "running" : this.tone.getTransport().state,
      started: this.started,
      pattern: this.activePattern || "standby",
      outputGain: this.outputGain,
      analysisReferenceReady: this.analysisReferenceReady,
      labJamActive: this.labJamActive,
      deckCount: this.deck.length,
      activeDeckCount: this.getActiveDeckEntries().length,
    };
  }

  getLoopState() {
    return {
      ...this.loopState,
      currentEvents: [...this.loopState.currentEvents],
      currentVoices: [...this.loopState.currentVoices],
      currentBarSteps: this.loopState.currentBarSteps.map((step) => [...step]),
    };
  }

  async warmup() {
    if (!this.started) {
      await this.tone.start();
      this.started = true;
    }

    const context = this.tone.getContext();
    if (context?.rawContext?.state === "suspended") {
      await context.resume();
    }

    if (this.tone.Destination) {
      this.tone.Destination.mute = false;
    }

    if (!this.output) {
      this.output = new this.tone.Gain(this.outputGain).toDestination();
    }

    if (this.deck.length === 0) {
      this.loadDefaultDeck();
    } else {
      this.deck.forEach((entry) => this.ensureDeckNode(entry));
      this.applyLabConfigToDeck();
    }

    return this.getSummary();
  }

  setOutputGain(amount) {
    const numeric = Math.max(0, Math.min(1, Number(amount)));
    this.outputGain = Number.isFinite(numeric) ? numeric : this.outputGain;
    if (this.output) {
      this.output.gain.value = this.outputGain;
    }
    return this.getSummary();
  }

  setLabConfig(nextConfig = {}) {
    const mergeNumber = (key, min, max) => {
      const numeric = Number(nextConfig[key]);
      if (Number.isFinite(numeric)) {
        this.labConfig[key] = Math.min(Math.max(numeric, min), max);
      }
    };

    mergeNumber("kickPitch", 24, 60);
    mergeNumber("kickDecay", 8, 70);
    mergeNumber("snareDecay", 6, 40);
    mergeNumber("hatBrightness", 0, 100);
    this.applyLabConfigToDeck();
    return { ...this.labConfig };
  }

  getLabConfig() {
    return { ...this.labConfig };
  }

  getInstrumentCatalog() {
    return TONE_INSTRUMENT_CATALOG.map((entry) => ({
      id: entry.id,
      name: entry.name,
      group: entry.group,
      role: entry.role,
      engine: entry.engine,
    }));
  }

  getDefaultDeck() {
    return DEFAULT_DECK_BLUEPRINT.map((entry, index) => ({
      id: `deck-${Date.now()}-${index}`,
      catalogId: entry.catalogId,
      enabled: entry.enabled !== false,
      volume: Number.isFinite(Number(entry.volume)) ? Number(entry.volume) : 1,
    }));
  }

  getCatalogEntry(catalogId) {
    return TONE_INSTRUMENT_CATALOG.find((entry) => entry.id === catalogId) || null;
  }

  disposeDeckNode(node) {
    if (!node) {
      return;
    }

    if (node.dispose) {
      node.dispose();
      return;
    }

    Object.values(node).forEach((child) => {
      if (child?.dispose) {
        child.dispose();
      }
    });
  }

  ensureDeckNode(deckEntry) {
    if (!this.output) {
      return null;
    }

    const existing = this.deckNodes.get(deckEntry.id);
    if (existing) {
      return existing;
    }

    const catalogEntry = this.getCatalogEntry(deckEntry.catalogId);
    if (!catalogEntry) {
      return null;
    }

    const node = catalogEntry.create(this.tone, this.output);
    this.deckNodes.set(deckEntry.id, node);
    this.applyDeckEntryState(deckEntry);
    return node;
  }

  getDeckVolumeTarget(node) {
    if (!node) {
      return null;
    }

    if (node.synth?.volume) {
      return node.synth;
    }

    if (node.volume) {
      return node;
    }

    return null;
  }

  volumeToDecibels(volume) {
    const normalized = Math.max(0, Math.min(1, Number(volume ?? 1)));
    if (normalized <= 0.0001) {
      return -60;
    }

    return 20 * Math.log10(normalized);
  }

  applyDeckEntryState(deckEntry) {
    const volumeTarget = this.getDeckVolumeTarget(this.deckNodes.get(deckEntry.id));
    if (!volumeTarget) {
      return;
    }

    volumeTarget.volume.value = this.volumeToDecibels(deckEntry.volume ?? 1);
  }

  applyLabConfigToDeck() {
    this.deck.forEach((entry) => {
      const catalogEntry = this.getCatalogEntry(entry.catalogId);
      const node = this.ensureDeckNode(entry);
      if (catalogEntry?.applyConfig && node) {
        catalogEntry.applyConfig(node, this.labConfig);
      }
      this.applyDeckEntryState(entry);
    });
  }

  loadDefaultDeck() {
    this.setInstrumentDeck(this.getDefaultDeck());
    return this.getDeckSnapshot();
  }

  setInstrumentDeck(deck = []) {
    const previousIds = new Set(this.deck.map((entry) => entry.id));
    this.deck = deck
      .map((entry, index) => ({
        id: entry.id || `deck-${Date.now()}-${index}`,
        catalogId: entry.catalogId,
        enabled: entry.enabled !== false,
        volume: Number.isFinite(Number(entry.volume)) ? Math.max(0, Math.min(1, Number(entry.volume))) : 1,
      }))
      .filter((entry) => this.getCatalogEntry(entry.catalogId));

    const nextIds = new Set(this.deck.map((entry) => entry.id));
    previousIds.forEach((entryId) => {
      if (!nextIds.has(entryId)) {
        this.disposeDeckNode(this.deckNodes.get(entryId));
        this.deckNodes.delete(entryId);
      }
    });

    if (this.output) {
      this.deck.forEach((entry) => this.ensureDeckNode(entry));
      this.applyLabConfigToDeck();
    }
    return this.getDeckSnapshot();
  }

  getDeckSnapshot() {
    return this.deck.map((entry) => {
      const catalogEntry = this.getCatalogEntry(entry.catalogId);
      return {
        id: entry.id,
        catalogId: entry.catalogId,
        enabled: entry.enabled,
        volume: entry.volume ?? 1,
        name: catalogEntry?.name || entry.catalogId,
        group: catalogEntry?.group || "Other",
        role: catalogEntry?.role || "perc",
        engine: catalogEntry?.engine || "Tone",
      };
    });
  }

  addInstrumentToDeck(catalogId) {
    const catalogEntry = this.getCatalogEntry(catalogId);
    if (!catalogEntry) {
      return this.getDeckSnapshot();
    }

    const nextDeck = [...this.deck, {
      id: `deck-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      catalogId,
      enabled: true,
      volume: 1,
    }];
    return this.setInstrumentDeck(nextDeck);
  }

  toggleDeckInstrument(deckId) {
    this.deck = this.deck.map((entry) =>
      entry.id === deckId ? { ...entry, enabled: !entry.enabled } : entry
    );
    return this.getDeckSnapshot();
  }

  setDeckInstrumentVolume(deckId, volume) {
    this.deck = this.deck.map((entry) =>
      entry.id === deckId
        ? { ...entry, volume: Math.max(0, Math.min(1, Number(volume ?? 1))) }
        : entry
    );
    const deckEntry = this.deck.find((entry) => entry.id === deckId);
    if (deckEntry) {
      this.applyDeckEntryState(deckEntry);
    }
    return this.getDeckSnapshot();
  }

  removeDeckInstrument(deckId) {
    const node = this.deckNodes.get(deckId);
    this.disposeDeckNode(node);
    this.deckNodes.delete(deckId);
    this.deck = this.deck.filter((entry) => entry.id !== deckId);
    return this.getDeckSnapshot();
  }

  getActiveDeckEntries(role = null) {
    return this.getDeckSnapshot().filter((entry) => entry.enabled && (!role || entry.role === role));
  }

  findDeckEntryByCatalogId(catalogId) {
    return this.deck.find((entry) => entry.catalogId === catalogId) || null;
  }

  upsertDeckEntry(catalogId, { enabled = true, volume = 1 } = {}) {
    const existing = this.findDeckEntryByCatalogId(catalogId);
    if (existing) {
      existing.enabled = enabled;
      existing.volume = Math.max(0, Math.min(1, Number(volume ?? existing.volume ?? 1)));
      this.applyDeckEntryState(existing);
      return existing;
    }

    const next = {
      id: `deck-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      catalogId,
      enabled,
      volume: Math.max(0, Math.min(1, Number(volume ?? 1))),
    };
    this.deck.push(next);
    if (this.output) {
      this.ensureDeckNode(next);
      this.applyDeckEntryState(next);
    }
    return next;
  }

  disableDeckRole(role) {
    this.deck.forEach((entry) => {
      const catalogEntry = this.getCatalogEntry(entry.catalogId);
      if (catalogEntry?.role === role) {
        entry.enabled = false;
        this.applyDeckEntryState(entry);
      }
    });
  }

  applyAdaptiveDeckDecision(decision = {}) {
    const entryLevel = Math.max(0, Math.min(4, Number(decision.entryLevel ?? 0)));
    const energy = Math.max(0, Math.min(1, Number(decision.energy ?? 0)));
    const fillProbability = Math.max(0, Math.min(100, Number(decision.fillProbability ?? 0)));
    const sourceMode = decision.sourceMode || "none";

    const kickId = energy >= 0.58 ? "kick-punch" : "kick-round";
    const snareId = fillProbability >= 58 || energy >= 0.64 ? "snare-wide" : "snare-tight";
    const hatId = sourceMode === "microphone"
      ? (energy >= 0.52 ? "hat-soft" : "hat-bright")
      : (energy >= 0.55 ? "hat-bright" : "hat-soft");
    const percId = fillProbability >= 72 ? "perc-blip" : "perc-click";

    const before = JSON.stringify(this.getDeckSnapshot().map(({ catalogId, enabled, volume }) => ({ catalogId, enabled, volume })));

    if (entryLevel >= 1 && this.getActiveDeckEntries("kick").length === 0) {
      this.upsertDeckEntry(kickId, { enabled: true, volume: energy >= 0.58 ? 0.96 : 0.84 });
    }
    if (entryLevel >= 2 && this.getActiveDeckEntries("hat").length === 0) {
      this.upsertDeckEntry(hatId, { enabled: true, volume: energy >= 0.55 ? 0.74 : 0.62 });
    }
    if (entryLevel >= 3 && this.getActiveDeckEntries("snare").length === 0) {
      this.upsertDeckEntry(snareId, { enabled: true, volume: fillProbability >= 58 ? 0.94 : 0.82 });
    }
    if (entryLevel >= 4 && fillProbability >= 48 && this.getActiveDeckEntries("perc").length === 0) {
      this.upsertDeckEntry(percId, { enabled: true, volume: fillProbability >= 72 ? 0.76 : 0.58 });
    }

    const after = JSON.stringify(this.getDeckSnapshot().map(({ catalogId, enabled, volume }) => ({ catalogId, enabled, volume })));
    return before !== after;
  }

  hasActiveDeck() {
    return this.getActiveDeckEntries().length > 0;
  }

  pickDeckEntry(role) {
    const roleKey = role === "ghost-snare" ? "snare" : role;
    const available = this.getActiveDeckEntries(roleKey);
    if (available.length === 0) {
      return null;
    }

    const nextIndex = this.roleCursor[roleKey] % available.length;
    this.roleCursor[roleKey] += 1;
    return available[nextIndex];
  }

  getReferenceBusState() {
    return {
      ready: this.analysisReferenceReady,
      outputGain: this.outputGain,
      pattern: this.activePattern || "standby",
      note: "The drummer runs on its own Tone.js output bus, so the future live tracker can subtract this reference from microphone analysis.",
    };
  }

  getStepPattern(config) {
    const density = Number(config.density || 48);
    const bars = Math.max(1, Math.min(8, Number(config.bars || 4)));
    const totalSteps = bars * 16;
    const entryLevel = Math.max(0, Math.min(4, Number(config.entryLevel ?? 4)));
    const mutation = config.loopMutation || "none";
    const steps = [];

    for (let step = 0; step < totalSteps; step += 1) {
      const stepInBar = step % 16;
      const barIndex = Math.floor(step / 16);
      const events = [];
      if (stepInBar === 0 || stepInBar === 8) {
        events.push("kick");
      }
      if (stepInBar === 4 || stepInBar === 12) {
        events.push("snare");
      }

      const hatEveryStep = density >= 64;
      const hatEveryTwo = density >= 38;
      const hatEveryFour = density < 38;

      if (
        hatEveryStep ||
        (hatEveryTwo && stepInBar % 2 === 0) ||
        (hatEveryFour && stepInBar % 4 === 0)
      ) {
        events.push("hat");
      }

      if (mutation === "kick-pickup" && barIndex === Math.min(1, bars - 1) && stepInBar === 10) {
        events.push("kick");
      }
      if (mutation === "hat-lift" && barIndex === bars - 1 && stepInBar === 14) {
        events.push("hat");
      }
      if (mutation === "snare-ghost" && entryLevel >= 3 && barIndex === bars - 1 && stepInBar === 14) {
        events.push("ghost-snare");
      }
      if (mutation === "perc-tag" && entryLevel >= 4 && barIndex === bars - 1 && stepInBar === 15) {
        events.push("perc");
      }

      steps.push(events);
    }

    return steps;
  }

  getLabJamPattern(config) {
    const bars = Math.max(1, Math.min(8, Number(config.bars || 4)));
    const stepsPerBar = 16;
    const totalSteps = bars * stepsPerBar;
    const density = Number(config.density || config.dynamics || 62);
    const style = config.style || "steady";
    const steps = [];

    for (let step = 0; step < totalSteps; step += 1) {
      const stepInBar = step % stepsPerBar;
      const barIndex = Math.floor(step / stepsPerBar);
      const events = [];

      if (style === "four-floor") {
        if (stepInBar % 4 === 0) {
          events.push("kick");
        }
        if (stepInBar === 4 || stepInBar === 12) {
          events.push("snare");
        }
        if (stepInBar % 2 === 0) {
          events.push("hat");
        }
      } else if (style === "broken") {
        if ([0, 3, 8, 11].includes(stepInBar)) {
          events.push("kick");
        }
        if (stepInBar === 4 || stepInBar === 12) {
          events.push("snare");
        }
        if (density >= 58 ? stepInBar % 2 === 0 : stepInBar % 4 === 0) {
          events.push("hat");
        }
        if (barIndex % 2 === 1 && stepInBar === 14) {
          events.push("ghost-snare");
        }
        if (density >= 68 && (stepInBar === 6 || stepInBar === 15)) {
          events.push("perc");
        }
      } else if (style === "disco") {
        if (stepInBar % 4 === 0) {
          events.push("kick");
        }
        if (stepInBar === 4 || stepInBar === 12) {
          events.push("snare");
        }
        events.push("hat");
        if (barIndex === bars - 1 && stepInBar === 15) {
          events.push("ghost-snare");
        }
        if (density >= 64 && stepInBar === 7) {
          events.push("perc");
        }
      } else if (style === "ambient") {
        if (stepInBar === 0 || stepInBar === 10) {
          events.push("kick");
        }
        if (stepInBar === 12) {
          events.push("snare");
        }
        if (stepInBar % 4 === 0 || (density >= 70 && stepInBar % 2 === 0)) {
          events.push("hat");
        }
        if (density >= 58 && (stepInBar === 6 || stepInBar === 14)) {
          events.push("perc");
        }
      } else {
        if (stepInBar === 0 || stepInBar === 8) {
          events.push("kick");
        }
        if (stepInBar === 4 || stepInBar === 12) {
          events.push("snare");
        }
        if (density >= 64 || stepInBar % 2 === 0) {
          events.push("hat");
        }
        if (barIndex === bars - 1 && stepInBar === 14 && density >= 55) {
          events.push("ghost-snare");
        }
        if (density >= 66 && (stepInBar === 3 || stepInBar === 11)) {
          events.push("perc");
        }
      }

      steps.push(events);
    }

    return steps;
  }

  filterEventsForEntryLevel(events, config = {}) {
    const entryLevel = Math.max(0, Math.min(4, Number(config.entryLevel ?? 4)));
    if (entryLevel <= 0) {
      return [];
    }

    if (entryLevel === 1) {
      return events.filter((eventName) => eventName === "kick").slice(0, 1);
    }

    if (entryLevel === 2) {
      return events.filter((eventName) => eventName === "kick" || eventName === "hat");
    }

    if (entryLevel === 3) {
      return events.filter((eventName) => eventName !== "perc");
    }

    return [...events];
  }

  triggerStep(events, config, time, stepIndex) {
    const gatedEvents = this.filterEventsForEntryLevel(events, config);
    const intensity = Math.max(0.1, Number(config.intensity || 55) / 100);
    const humanize = (Number(config.humanize || 18) / 100) * 0.018;
    const hatVelocity = Math.min(1, 0.16 + intensity * 0.42);
    const kickVelocity = Math.min(1, 0.38 + intensity * 0.48);
    const snareVelocity = Math.min(1, 0.22 + intensity * 0.46);
    const drift = () => (Math.random() * 2 - 1) * humanize;

    const triggeredVoices = [];
    gatedEvents.forEach((eventName) => {
      const deckEntry = this.pickDeckEntry(eventName);
      if (!deckEntry) {
        return;
      }

      const catalogEntry = this.getCatalogEntry(deckEntry.catalogId);
      const node = this.ensureDeckNode(deckEntry);
      if (!catalogEntry || !node) {
        return;
      }

      let velocity = kickVelocity;
      let duration = "8n";
      if (eventName === "snare") {
        velocity = snareVelocity;
        duration = "16n";
      } else if (eventName === "ghost-snare") {
        velocity = snareVelocity * 0.48;
        duration = "32n";
      } else if (eventName === "hat") {
        const accent = stepIndex % 4 === 0 ? 1.14 : 1;
        velocity = Math.min(1, hatVelocity * accent * 1.2);
        duration = "32n";
      } else if (eventName === "perc") {
        velocity = Math.min(1, 0.24 + intensity * 0.38);
        duration = "32n";
      }

      catalogEntry.trigger(
        this.tone,
        node,
        this.labConfig,
        Math.max(0, time + drift()),
        velocity,
        duration
      );
      triggeredVoices.push({
        event: eventName,
        role: deckEntry.role,
        name: deckEntry.name,
      });
    });

    return triggeredVoices;
  }

  startPatternScheduler(steps, config, patternName, { resetIndex = true } = {}) {
    this.activeSteps = [...steps];
    this.activePatternName = patternName;
    const totalSteps = Math.max(1, this.activeSteps.length);
    const bpm = Math.max(60, Math.min(180, Number(config.tempo || config.bpm || 104)));
    const stepDurationMs = (60 / bpm / 4) * 1000;

    if (this.patternTimer) {
      globalThis.clearInterval(this.patternTimer);
      this.patternTimer = null;
    }

    if (resetIndex) {
      this.currentPatternIndex = 0;
      this.completedPatternCycles = 0;
    }
    this.patternTimer = globalThis.setInterval(() => {
      const safeTotal = Math.max(1, this.activeSteps.length);
      const stepIndex = this.currentPatternIndex % safeTotal;
      if (stepIndex === 0 && this.currentPatternIndex > 0) {
        this.completedPatternCycles += 1;
        if (this.pendingReactiveConfig) {
          this.lastConfig = {
            ...this.lastConfig,
            ...this.pendingReactiveConfig,
          };
          this.activeSteps = this.getStepPattern(this.lastConfig);
          this.pendingReactiveConfig = null;
        }
      }
      const events = this.activeSteps[stepIndex] || [];
      this.absoluteStepCount += 1;
      const activeConfig = this.lastConfig || config;
      const evolvedEvents = this.evolveEvents(events, activeConfig, stepIndex, safeTotal);
      const triggeredVoices = this.triggerStep(evolvedEvents, activeConfig, this.tone.now() + 0.01, stepIndex);
      this.updateLoopState(stepIndex, safeTotal, evolvedEvents, this.activePatternName || patternName, triggeredVoices);
      this.currentPatternIndex += 1;
    }, stepDurationMs);
  }

  updateLabJam(config = {}) {
    if (!this.labJamActive || !this.lastConfig) {
      return this.getSummary();
    }

    const nextConfig = {
      ...this.lastConfig,
      bars: Number(config.bars ?? this.lastConfig.bars ?? 4),
      bpm: Number(config.bpm ?? config.tempo ?? this.lastConfig.bpm ?? this.lastConfig.tempo ?? 104),
      style: config.style || this.lastConfig.style || "steady",
      dynamics: Number(config.dynamics ?? this.lastConfig.dynamics ?? 62),
      density: Number(config.density ?? config.dynamics ?? this.lastConfig.density ?? this.lastConfig.dynamics ?? 62),
      intensity: Number(config.intensity ?? config.dynamics ?? this.lastConfig.intensity ?? this.lastConfig.dynamics ?? 62),
      humanize: Number(config.humanize ?? this.lastConfig.humanize ?? 14),
      swing: Number(config.swing ?? this.lastConfig.swing ?? 8),
      tempo: Number(config.tempo ?? config.bpm ?? this.lastConfig.tempo ?? this.lastConfig.bpm ?? 104),
    };

    this.lastConfig = nextConfig;
    this.activePattern = `lab-jam:${nextConfig.style}`;
    this.activePatternName = this.activePattern;
    this.activeSteps = this.getLabJamPattern(nextConfig);

    const bpm = Math.max(60, Math.min(180, nextConfig.tempo));
    const stepDurationMs = (60 / bpm / 4) * 1000;
    if (this.patternTimer) {
      this.startPatternScheduler(this.activeSteps, this.lastConfig, this.activePatternName, { resetIndex: false });
    }

    return this.getSummary();
  }

  evolveEvents(events, config, stepIndex, totalSteps) {
    const nextEvents = [...events];
    const safeTotal = Math.max(1, totalSteps || 1);
    const cycle = Math.floor(this.absoluteStepCount / safeTotal);
    const stepInBar = stepIndex % 16;
    const intensity = Number(config.intensity || config.dynamics || 62);

    if (cycle % 2 === 1 && stepInBar === 14 && intensity >= 45 && !nextEvents.includes("ghost-snare")) {
      nextEvents.push("ghost-snare");
    }

    if (cycle % 3 === 2 && stepInBar === 7 && intensity >= 58 && !nextEvents.includes("kick")) {
      nextEvents.push("kick");
    }

    if (cycle % 4 === 3 && stepInBar === 10 && intensity >= 52 && !nextEvents.includes("hat")) {
      nextEvents.push("hat");
    }

    return nextEvents;
  }

  buildCurrentBarSteps(stepIndex) {
    const currentBarIndex = Math.floor(stepIndex / 16);
    const start = currentBarIndex * 16;
    const end = Math.min(start + 16, this.activeSteps.length);
    return this.activeSteps.slice(start, end).map((stepEvents) => [...stepEvents]);
  }

  updateLoopState(stepIndex, totalSteps, events, pattern, triggeredVoices = []) {
    const safeTotal = Math.max(1, totalSteps || 1);
    const cycle = Math.floor(this.absoluteStepCount / safeTotal) + 1;
    this.loopState = {
      active: true,
      pattern,
      totalSteps: safeTotal,
      currentStep: stepIndex + 1,
      currentBar: Math.floor(stepIndex / 16) + 1,
      stepInBar: (stepIndex % 16) + 1,
      cycle,
      currentEvents: [...events],
      currentVoices: triggeredVoices.map((voice) => voice.name),
      currentBarSteps: this.buildCurrentBarSteps(stepIndex),
      progress: (stepIndex + 1) / safeTotal,
    };
  }

  async startReactiveKit(config = {}) {
    await this.warmup();
    if (!this.hasActiveDeck()) {
      throw new Error("NO_ACTIVE_DECK");
    }

    const transport = this.tone.getTransport();
    transport.bpm.value = Math.max(60, Math.min(180, Number(config.tempo || 104)));
    transport.swing = Math.max(0, Math.min(0.45, Number(config.swing || 8) / 100 * 0.45));
    transport.swingSubdivision = "16n";

    const nextConfig = {
      density: Number(config.density || 48),
      intensity: Number(config.intensity || 55),
      humanize: Number(config.humanize || 18),
      swing: Number(config.swing || 8),
      tempo: Number(config.tempo || 104),
      entryLevel: Number(config.entryLevel || 4),
      confidence: Number(config.confidence || 0),
      bars: Number(config.bars || 4),
      loopMutation: config.loopMutation || "none",
    };

    this.lastConfig = nextConfig;
    this.activePattern = "reactive-kit";
    this.pendingReactiveConfig = null;

    const steps = this.getStepPattern(nextConfig);
    const totalSteps = steps.length;
    this.labJamActive = false;
    this.startPatternScheduler(steps, nextConfig, "reactive-kit");

    const previewEvents = this.evolveEvents(steps[0] || ["kick", "hat"], nextConfig, 0, totalSteps);
    const previewVoices = this.triggerStep(previewEvents, nextConfig, this.tone.now() + 0.02, 0);
    this.updateLoopState(0, totalSteps, previewEvents, "reactive-kit", previewVoices);

    if (transport.state !== "started") {
      transport.start();
    }

    return this.getSummary();
  }

  updateReactiveKit(config = {}) {
    if (this.labJamActive || this.activePattern !== "reactive-kit" || !this.lastConfig) {
      return this.getSummary();
    }

    const nextConfig = {
      ...this.lastConfig,
      density: Number(config.density ?? this.lastConfig.density ?? 48),
      intensity: Number(config.intensity ?? this.lastConfig.intensity ?? 55),
      humanize: Number(config.humanize ?? this.lastConfig.humanize ?? 18),
      swing: Number(config.swing ?? this.lastConfig.swing ?? 8),
      tempo: Number(config.tempo ?? this.lastConfig.tempo ?? 104),
      entryLevel: Number(config.entryLevel ?? this.lastConfig.entryLevel ?? 4),
      confidence: Number(config.confidence ?? this.lastConfig.confidence ?? 0),
      bars: Number(config.bars ?? this.lastConfig.bars ?? 4),
      loopMutation: config.loopMutation ?? this.lastConfig.loopMutation ?? "none",
    };

    const transport = this.tone.getTransport();
    transport.bpm.value = Math.max(60, Math.min(180, nextConfig.tempo));
    transport.swing = Math.max(0, Math.min(0.45, Number(nextConfig.swing || 8) / 100 * 0.45));
    transport.swingSubdivision = "16n";

    this.pendingReactiveConfig = nextConfig;

    if (!this.patternTimer) {
      this.lastConfig = nextConfig;
      this.activeSteps = this.getStepPattern(nextConfig);
      this.startPatternScheduler(this.activeSteps, nextConfig, "reactive-kit", { resetIndex: false });
    }

    return this.getSummary();
  }

  realignReactiveKit(config = {}) {
    if (this.labJamActive || this.activePattern !== "reactive-kit" || !this.lastConfig || !this.activeSteps.length) {
      return this.getSummary();
    }

    const now = Date.now();
    if (now - this.lastReactiveRealignAt < 1200) {
      return this.getSummary();
    }
    this.lastReactiveRealignAt = now;
    if (this.currentPatternIndex % Math.max(1, this.activeSteps.length) < 4) {
      this.currentPatternIndex = 0;
      this.absoluteStepCount = 0;
      const previewEvents = this.evolveEvents(this.activeSteps[0] || ["kick"], this.lastConfig, 0, this.activeSteps.length);
      this.updateLoopState(0, this.activeSteps.length, previewEvents, "reactive-kit", []);
    }
    return this.getSummary();
  }

  async startLabJam(config = {}) {
    await this.warmup();
    if (!this.hasActiveDeck()) {
      throw new Error("NO_ACTIVE_DECK");
    }

    const transport = this.tone.getTransport();
    transport.bpm.value = Math.max(60, Math.min(180, Number(config.tempo || config.bpm || 104)));
    transport.swing = Math.max(0, Math.min(0.45, Number(config.swing || 8) / 100 * 0.45));
    transport.swingSubdivision = "16n";

    const nextConfig = {
      bars: Number(config.bars || 4),
      bpm: Number(config.bpm || config.tempo || 104),
      style: config.style || "steady",
      dynamics: Number(config.dynamics || 62),
      density: Number(config.density || config.dynamics || 62),
      intensity: Number(config.intensity || config.dynamics || 62),
      humanize: Number(config.humanize || 14),
      swing: Number(config.swing || 8),
      tempo: Number(config.tempo || config.bpm || 104),
    };

    this.lastConfig = nextConfig;
    this.labJamActive = true;
    this.activePattern = `lab-jam:${nextConfig.style}`;

    const steps = this.getLabJamPattern(nextConfig);
    const totalSteps = steps.length;
    this.startPatternScheduler(steps, nextConfig, `lab-jam:${nextConfig.style}`);

    const previewEvents = this.evolveEvents(steps[0] || ["kick", "hat"], nextConfig, 0, totalSteps);
    const previewVoices = this.triggerStep(previewEvents, nextConfig, this.tone.now() + 0.02, 0);
    this.updateLoopState(0, totalSteps, previewEvents, `lab-jam:${nextConfig.style}`, previewVoices);

    if (transport.state !== "started") {
      transport.start();
    }

    return this.getSummary();
  }

  stopPattern() {
    const transport = this.tone.getTransport();
    if (this.patternTimer) {
      globalThis.clearInterval(this.patternTimer);
      this.patternTimer = null;
    }
    if (transport.state === "started") {
      transport.stop();
    }
    transport.cancel();
    this.currentPatternIndex = 0;
    this.activeSteps = [];
    this.activePatternName = "";
    this.activePattern = "";
    this.lastConfig = null;
    this.labJamActive = false;
    this.absoluteStepCount = 0;
    this.loopState = {
      active: false,
      pattern: "standby",
      totalSteps: 0,
      currentStep: 0,
      currentBar: 0,
      stepInBar: 0,
      cycle: 0,
      currentEvents: [],
      currentVoices: [],
      currentBarSteps: [],
      progress: 0,
    };
    return this.getSummary();
  }

  async previewVoice(voice) {
    await this.warmup();
    const deckEntry = typeof voice === "object" && voice !== null
      ? voice
      : this.deck.find((entry) => entry.id === voice) || this.pickDeckEntry(voice);
    if (!deckEntry) {
      return;
    }

    const catalogEntry = this.getCatalogEntry(deckEntry.catalogId);
    const node = this.ensureDeckNode(deckEntry);
    if (!catalogEntry || !node) {
      return;
    }

    const role = this.getCatalogEntry(deckEntry.catalogId)?.role || "perc";
    const now = this.tone.now() + 0.02;
    const duration = role === "kick" ? "8n" : role === "hat" ? "32n" : "16n";
    const velocity = role === "kick" ? 0.86 : role === "hat" ? 0.42 : 0.7;
    catalogEntry.trigger(this.tone, node, this.labConfig, now, velocity, duration);
  }
}

function createToneDrumBus() {
  return new ToneDrumBus();
}

export { createToneDrumBus, ToneDrumBus };
