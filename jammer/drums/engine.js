function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function clampPercent(value, fallback) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }

  return clamp(Math.round(numeric), 0, 100);
}

function getProfileDefaults(profile) {
  return {
    intensity: profile?.defaults?.intensity ?? 55,
    density: profile?.defaults?.density ?? 48,
    swing: profile?.defaults?.swing ?? 8,
    humanize: profile?.defaults?.humanize ?? 18,
    feel: profile?.defaultFeel ?? "assist",
  };
}

export class JammerEngine {
  constructor(drummerCatalog) {
    this.drummerCatalog = drummerCatalog;
    this.profileMap = new Map(drummerCatalog.map((profile) => [profile.id, profile]));
    this.sourceState = {
      activeInputMode: "none",
      micArmed: false,
      micLive: false,
      playerLive: false,
    };
    this.state = this.buildInitialState();
  }

  buildInitialState() {
    const initialProfile = this.drummerCatalog[0];
    const defaults = getProfileDefaults(initialProfile);

    return {
      drummerId: initialProfile?.id ?? "",
      enabled: false,
      feel: defaults.feel,
      followSource: "auto",
      intensity: defaults.intensity,
      density: defaults.density,
      swing: defaults.swing,
      humanize: defaults.humanize,
      tempo: 104,
    };
  }

  getProfile(drummerId = this.state.drummerId) {
    return this.profileMap.get(drummerId) || this.drummerCatalog[0];
  }

  applySettings(settings = {}) {
    this.setDrummer(settings.jammerDrummerId || this.state.drummerId, false);
    this.state.enabled = settings.jammerEnabled === true;
    this.state.followSource = settings.jammerFollowSource || "auto";
    this.state.feel = settings.jammerFeel || this.getProfile().defaultFeel || "assist";
    this.state.intensity = clampPercent(settings.jammerIntensity, this.state.intensity);
    this.state.density = clampPercent(settings.jammerDensity, this.state.density);
    this.state.swing = clampPercent(settings.jammerSwing, this.state.swing);
    this.state.humanize = clampPercent(settings.jammerHumanize, this.state.humanize);
    this.setTempo(settings.jammerTempo || this.state.tempo);
  }

  setSourceState(sourceState = {}) {
    this.sourceState = {
      activeInputMode: sourceState.activeInputMode || "none",
      micArmed: Boolean(sourceState.micArmed),
      micLive: Boolean(sourceState.micLive),
      playerLive: Boolean(sourceState.playerLive),
    };
  }

  setEnabled(enabled) {
    this.state.enabled = Boolean(enabled);
  }

  setDrummer(drummerId, resetVoicing = true) {
    const profile = this.getProfile(drummerId);
    this.state.drummerId = profile.id;
    if (resetVoicing) {
      const defaults = getProfileDefaults(profile);
      this.state.feel = defaults.feel;
      this.state.intensity = defaults.intensity;
      this.state.density = defaults.density;
      this.state.swing = defaults.swing;
      this.state.humanize = defaults.humanize;
    }
  }

  setFollowSource(value) {
    this.state.followSource = value || "auto";
  }

  setFeel(value) {
    this.state.feel = value || this.getProfile().defaultFeel || "assist";
  }

  setVoicingParam(key, value) {
    if (!["intensity", "density", "swing", "humanize"].includes(key)) {
      return;
    }

    this.state[key] = clampPercent(value, this.state[key]);
  }

  setTempo(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
      return;
    }

    this.state.tempo = clamp(Math.round(numeric), 60, 180);
  }

  getResolvedSource() {
    if (this.state.followSource === "none") {
      return "idle";
    }

    if (this.state.followSource === "player") {
      return this.sourceState.playerLive ? "player" : "waiting-player";
    }

    if (this.state.followSource === "microphone") {
      if (this.sourceState.micLive) {
        return "microphone-live";
      }
      if (this.sourceState.micArmed) {
        return "microphone-armed";
      }
      return "waiting-microphone";
    }

    if (this.sourceState.playerLive) {
      return "player";
    }

    if (this.sourceState.micLive) {
      return "microphone-live";
    }

    if (this.sourceState.micArmed) {
      return "microphone-armed";
    }

    return "idle";
  }

  getStatusSnapshot() {
    const profile = this.getProfile();
    const resolvedSource = this.getResolvedSource();

    let routeLabel = "No source";
    let statusLabel = "Standby";
    let summary = "Waiting for an input route before the drummer can lock onto a groove.";

    if (!this.state.enabled) {
      summary = `${profile.name} is ready when you press Play Drummer.`;
    } else if (resolvedSource === "player") {
      routeLabel = "Player";
      statusLabel = "Ready";
      summary = `${profile.name} is following the player path and can sketch ${profile.defaultPattern.toLowerCase()}.`;
    } else if (resolvedSource === "microphone-live") {
      routeLabel = "Mic live";
      statusLabel = "Listening";
      summary = `${profile.name} is listening to the microphone route and waiting for stable tempo confidence.`;
    } else if (resolvedSource === "microphone-armed") {
      routeLabel = "Mic armed";
      statusLabel = "Primed";
      summary = `${profile.name} sees the selected microphone route, but live capture has not started yet.`;
    } else if (resolvedSource === "waiting-player") {
      routeLabel = "Player";
      statusLabel = "Waiting";
      summary = "The drummer is pinned to the player route and will wake up when playback starts.";
    } else if (resolvedSource === "waiting-microphone") {
      routeLabel = "Mic";
      statusLabel = "Waiting";
      summary = "The drummer is pinned to the microphone route and is waiting for mic start.";
    } else if (resolvedSource === "idle" && this.state.followSource === "none") {
      routeLabel = "No source";
      statusLabel = "Looping";
      summary = `${profile.name} is free-running with no input route, inventing its own loop for live tone shaping.`;
    }

    return {
      profile,
      routeLabel,
      statusLabel,
      summary,
      feelLabel: this.state.feel,
      patternLabel: profile.defaultPattern,
      laneLabel: profile.laneFocus.join(" • "),
      readiness: `${statusLabel} • ${routeLabel}`,
    };
  }
}
