export function createReactiveDrummerController({
  adaptiveTiming,
  aubioListener,
  deriveReactiveBehavior,
  essentiaListener,
  getActiveInputMode,
  getDetectionActive,
  getReactiveBehaviorStrategies,
  jammerEngine,
  toneDrumBus,
}) {
  const state = {
    adaptiveState: null,
    lastReactiveEarUpdateAt: 0,
    reactiveKitStartPending: false,
    reactiveListenStartedAt: 0,
  };

  function getAdaptiveState() {
    return state.adaptiveState;
  }

  function setAdaptiveState(nextState) {
    state.adaptiveState = nextState;
  }

  function resetReactiveState() {
    state.lastReactiveEarUpdateAt = 0;
    state.adaptiveState = null;
    state.reactiveListenStartedAt = 0;
    state.reactiveKitStartPending = false;
  }

  function updateDetectionSummary({ essentiaSummary, aubioSummary }) {
    return adaptiveTiming.update({
      detectionActive: getDetectionActive(),
      sourceMode: getActiveInputMode(),
      baseTempo: Number(jammerEngine.state.tempo || 104),
      essentia: essentiaSummary,
      aubio: aubioSummary,
    });
  }

  function getReactiveListenPhaseMetrics() {
    const resolvedSource = jammerEngine.getResolvedSource();
    const liveFollow = jammerEngine.state.enabled
      && jammerEngine.getProfile().id === "reactive-kit"
      && (resolvedSource === "player" || resolvedSource === "microphone-live");

    if (!liveFollow) {
      state.reactiveListenStartedAt = 0;
      return {
        liveFollow: false,
        listenMs: 0,
        phase: "standby",
      };
    }

    const now = performance.now();
    if (!state.reactiveListenStartedAt) {
      state.reactiveListenStartedAt = now;
    }

    const listenMs = now - state.reactiveListenStartedAt;
    return {
      liveFollow: true,
      listenMs,
      phase: "listening",
    };
  }

  function clampPercent(value) {
    return Math.max(0, Math.min(100, Math.round(value)));
  }

  function buildAdaptiveReactiveKitConfig({ detectionSummary, essentiaSummary }) {
    const baseTempo = Number(jammerEngine.state.tempo || 104);
    const baseIntensity = Number(jammerEngine.state.intensity || 55);
    const baseDensity = Number(jammerEngine.state.density || 48);
    const baseSwing = Number(jammerEngine.state.swing || 8);
    const baseHumanize = Number(jammerEngine.state.humanize || 18);
    const sourceMode = detectionSummary.sourceMode || essentiaSummary.sourceMode || "none";
    const isMicrophoneRoute = sourceMode === "microphone";
    const energy = Math.max(0, Math.min(1, Number(detectionSummary.energy || essentiaSummary.energy || 0)));
    const onset = Math.max(0, Math.min(1, Number(detectionSummary.onset || essentiaSummary.onset || 0)));
    const confidence = Math.max(0, Math.min(100, Number(detectionSummary.confidence || essentiaSummary.confidence || 0)));
    const confidenceRatio = confidence / 100;
    const phaseMetrics = getReactiveListenPhaseMetrics();
    const listenSeconds = phaseMetrics.listenMs / 1000;
    const tempoConfidenceThreshold = isMicrophoneRoute ? 22 : 46;
    const tempoBlend = isMicrophoneRoute
      ? Math.max(0.24, Math.min(0.78, 0.24 + (confidenceRatio * 0.42) + (onset * 0.12)))
      : Math.max(0.18, Math.min(0.72, 0.18 + (confidenceRatio * 0.4)));
    const detectedTempo = Number(detectionSummary.tempo || essentiaSummary.tempo || 0);
    const tempoTarget = confidence >= tempoConfidenceThreshold && detectedTempo > 0
      ? Math.round((baseTempo * (1 - tempoBlend)) + (detectedTempo * tempoBlend))
      : baseTempo;
    const intensityBoost = isMicrophoneRoute
      ? (energy * 34) + (onset * 18) + (confidenceRatio * 8)
      : (energy * 24) + (onset * 10);
    const densityBoost = isMicrophoneRoute
      ? (energy * 16) + (onset * 30) + (confidenceRatio * 12)
      : (energy * 10) + (onset * 24) + (confidenceRatio * 8);
    const swingBoost = isMicrophoneRoute
      ? (confidenceRatio * 6) + (onset * 3)
      : (confidenceRatio * 4);
    const humanizeShift = isMicrophoneRoute
      ? ((1 - confidenceRatio) * 10) + ((1 - energy) * 8) - (onset * 4)
      : ((1 - confidenceRatio) * 8) + ((1 - energy) * 6);
    const entryConfidence = phaseMetrics.liveFollow
      ? Math.max(0, Math.min(100, Math.round(
        (confidenceRatio * 72)
        + (energy * 16)
        + (onset * 12)
      )))
      : 0;

    const downbeatPulse = phaseMetrics.liveFollow && Boolean(detectionSummary.downbeatPulse);
    const anchorPulseCount = phaseMetrics.liveFollow
      ? Math.max(0, Number(detectionSummary.anchorPulseCount || 0))
      : 0;

    let entryLevel = 0;
    let phase = phaseMetrics.liveFollow ? "listening" : "standby";
    if (phaseMetrics.liveFollow) {
      if (listenSeconds < 2.4 || anchorPulseCount < 1 || entryConfidence < 22) {
        entryLevel = 0;
        phase = "listening";
      } else if (listenSeconds < 5.2 || anchorPulseCount < 2 || entryConfidence < 42) {
        entryLevel = 1;
        phase = "entering";
      } else if (listenSeconds < 8.8 || anchorPulseCount < 4 || entryConfidence < 64) {
        entryLevel = 2;
        phase = "building";
      } else if (anchorPulseCount < 6 || entryConfidence < 78) {
        entryLevel = 3;
        phase = "supporting";
      } else {
        entryLevel = 4;
        phase = "supporting";
      }
    }

    const fillProbability = phaseMetrics.liveFollow
      ? Math.max(0, Math.min(100, Math.round(
        (onset * 42)
        + (energy * 26)
        + (confidenceRatio * 18)
        + (Math.max(0, clampPercent(baseDensity + densityBoost) - baseDensity) * 0.45)
      )))
      : 0;
    const densityTarget = phaseMetrics.liveFollow
      ? (entryLevel <= 1
        ? Math.min(baseDensity + 4, clampPercent(baseDensity + densityBoost))
        : entryLevel === 2
          ? Math.min(baseDensity + 12, clampPercent(baseDensity + densityBoost))
          : clampPercent(baseDensity + densityBoost))
      : clampPercent(baseDensity + densityBoost);

    const behavior = deriveReactiveBehavior({
      liveFollow: phaseMetrics.liveFollow,
      phase,
      energy,
      onset,
      fillProbability,
      densityTarget,
      entryLevel,
      barAnchorConfidence: Number(detectionSummary.barAnchorConfidence || essentiaSummary.barAnchorConfidence || 0),
      phraseBars: Number(detectionSummary.phraseBars || essentiaSummary.phraseBars || 4),
    }, getReactiveBehaviorStrategies());

    return {
      tempo: tempoTarget,
      intensity: clampPercent(baseIntensity + intensityBoost),
      density: densityTarget,
      swing: clampPercent(baseSwing + swingBoost),
      humanize: clampPercent(baseHumanize + humanizeShift),
      energy,
      onset,
      confidence,
      entryConfidence,
      entryLevel,
      phase,
      listenMs: phaseMetrics.listenMs,
      fillProbability,
      detectedTempo,
      sourceMode,
      downbeatPulse,
      barAnchorConfidence: Number(detectionSummary.barAnchorConfidence || essentiaSummary.barAnchorConfidence || 0),
      anchorPulseCount,
      bars: behavior.bars,
      variationEveryLoops: behavior.variationEveryLoops,
      sectionState: behavior.sectionState,
      loopMutation: behavior.loopMutation,
      pulseMode: behavior.pulseMode,
      strategyId: behavior.strategyId,
      strategyName: behavior.strategyName,
    };
  }

  function analyzeFrame() {
    let essentiaSummary = essentiaListener.getSnapshot();
    let aubioSummary = aubioListener.getSnapshot();

    if (!essentiaSummary.installed || !essentiaSummary.ready || !getDetectionActive()) {
      return {
        adaptiveState: state.adaptiveState,
        aubioSummary,
        detectionSummary: adaptiveTiming.getSnapshot(),
        essentiaSummary,
      };
    }

    essentiaSummary = essentiaListener.analyzeFrame();
    if (aubioSummary.installed && aubioSummary.ready) {
      aubioSummary = aubioListener.analyzeFrame();
    }

    const detectionSummary = updateDetectionSummary({ essentiaSummary, aubioSummary });
    jammerEngine.setListenerState(detectionSummary);
    const adaptiveState = buildAdaptiveReactiveKitConfig({ detectionSummary, essentiaSummary });
    state.adaptiveState = adaptiveState;

    return {
      adaptiveState,
      aubioSummary,
      detectionSummary,
      essentiaSummary,
    };
  }

  function maybeApplyEarDrivenReactiveKit({
    detectionSummary,
    essentiaSummary,
    onDeckChanged,
    onReactiveStartError,
    onReactiveStarted,
  }) {
    const resolvedSource = jammerEngine.getResolvedSource();
    const activeProfile = jammerEngine.getProfile();
    if (
      !jammerEngine.state.enabled
      || activeProfile.id !== "reactive-kit"
      || (resolvedSource !== "player" && resolvedSource !== "microphone-live")
    ) {
      return;
    }

    const now = performance.now();
    const analysisCadence = resolvedSource === "microphone-live" ? 140 : 220;
    if (now - state.lastReactiveEarUpdateAt < analysisCadence) {
      return;
    }
    state.lastReactiveEarUpdateAt = now;

    const adaptiveConfig = buildAdaptiveReactiveKitConfig({ detectionSummary, essentiaSummary });
    state.adaptiveState = adaptiveConfig;
    const deckChanged = toneDrumBus.applyAdaptiveDeckDecision(adaptiveConfig);
    if (deckChanged && onDeckChanged) {
      onDeckChanged();
    }
    if (adaptiveConfig.entryLevel <= 0) {
      return { toneDrumBusSummary: toneDrumBus.stopPattern() };
    }
    const reactiveLoopActive = toneDrumBus.getLoopState().active && toneDrumBus.getSummary().pattern === "reactive-kit";
    if (reactiveLoopActive) {
      let toneDrumBusSummary = toneDrumBus.updateReactiveKit(adaptiveConfig);
      if (adaptiveConfig.downbeatPulse && adaptiveConfig.anchorPulseCount >= 1) {
        toneDrumBusSummary = toneDrumBus.realignReactiveKit(adaptiveConfig);
      }
      return { toneDrumBusSummary };
    }

    if (!adaptiveConfig.downbeatPulse || adaptiveConfig.anchorPulseCount < 1) {
      return;
    }

    if (!state.reactiveKitStartPending) {
      state.reactiveKitStartPending = true;
      void toneDrumBus.startReactiveKit(adaptiveConfig)
        .then((toneDrumBusSummary) => {
          if (onReactiveStarted) {
            onReactiveStarted(toneDrumBusSummary);
          }
        })
        .catch((error) => {
          if (onReactiveStartError) {
            onReactiveStartError(error);
          }
        })
        .finally(() => {
          state.reactiveKitStartPending = false;
        });
    }
    return;
  }

  async function syncJammerPlayback({
    detectionSummary,
    essentiaSummary,
    onAfterUpdate,
    onAutonomousError,
    onReactiveError,
    startAutonomousDrummerLoop,
  }) {
    const activeProfile = jammerEngine.getProfile();
    const resolvedSource = jammerEngine.getResolvedSource();
    const shouldRunReactiveKit = jammerEngine.state.enabled
      && activeProfile.id === "reactive-kit"
      && (resolvedSource === "player" || resolvedSource === "microphone-live");
    const shouldRunAutonomousLoop = jammerEngine.state.enabled
      && resolvedSource === "idle";

    if (shouldRunAutonomousLoop) {
      try {
        return await startAutonomousDrummerLoop();
      } catch (error) {
        if (onAutonomousError) {
          onAutonomousError(error);
        }
      }
    }

    if (!shouldRunReactiveKit) {
      const toneDrumBusSummary = toneDrumBus.stopPattern();
      resetReactiveState();
      if (onAfterUpdate) {
        onAfterUpdate(toneDrumBusSummary);
      }
      return toneDrumBusSummary;
    }

    try {
      const adaptiveConfig = buildAdaptiveReactiveKitConfig({ detectionSummary, essentiaSummary });
      state.adaptiveState = adaptiveConfig;
      if (adaptiveConfig.entryLevel <= 0) {
        const toneDrumBusSummary = toneDrumBus.stopPattern();
        if (onAfterUpdate) {
          onAfterUpdate(toneDrumBusSummary);
        }
        return toneDrumBusSummary;
      }
      if (!adaptiveConfig.downbeatPulse || adaptiveConfig.anchorPulseCount < 1) {
        const toneDrumBusSummary = toneDrumBus.stopPattern();
        if (onAfterUpdate) {
          onAfterUpdate(toneDrumBusSummary);
        }
        return toneDrumBusSummary;
      }
      const toneDrumBusSummary = await toneDrumBus.startReactiveKit(adaptiveConfig);
      state.reactiveKitStartPending = false;
      if (onAfterUpdate) {
        onAfterUpdate(toneDrumBusSummary);
      }
      return toneDrumBusSummary;
    } catch (error) {
      if (onReactiveError) {
        onReactiveError(error);
      }
      return null;
    }
  }

  return {
    analyzeFrame,
    buildAdaptiveReactiveKitConfig,
    getAdaptiveState,
    maybeApplyEarDrivenReactiveKit,
    resetReactiveState,
    setAdaptiveState,
    syncJammerPlayback,
    updateDetectionSummary,
  };
}
