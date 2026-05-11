function bindAppEvents(context) {
  const {
    refs,
    state,
    actions,
    services,
    helpers,
  } = context;

  const persistLabSettingsWithLog = () => {
    actions.persistJammerLabSettings().catch((error) => {
      actions.log(`Drummer lab save error: ${error.message}`);
    });
  };

  refs.studioHomeButton.addEventListener("click", () => actions.showPanel("studio"));
  refs.studioHomeButton.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      actions.showPanel("studio");
    }
  });
  refs.jammerTabButton.addEventListener("click", (event) => {
    event.stopPropagation();
    actions.showPanel(refs.jammerPanel.classList.contains("active") ? "studio" : "jammer");
  });
  refs.settingsTabButton.addEventListener("click", (event) => {
    event.stopPropagation();
    actions.showPanel(refs.settingsPanel.classList.contains("active") ? "studio" : "settings");
  });
  refs.startMicButton.addEventListener("click", actions.startMicrophone);
  refs.stopMicButton.addEventListener("click", actions.stopMicrophone);
  refs.startRecordingButton.addEventListener("click", actions.startRecording);
  refs.stopRecordingButton.addEventListener("click", actions.stopRecording);
  refs.randomPresetButton.addEventListener("click", actions.selectRandomPreset);
  refs.nextPresetButton.addEventListener("click", () => {
    if (state.getPresetKeys().length > 0) {
      actions.selectPreset((state.getPresetIndex() + 1) % state.getPresetKeys().length);
    }
  });
  refs.visualizerToggleButton.addEventListener("click", () => {
    actions.setVisualizerEnabled(!state.getVisualizerEnabled());
  });
  refs.presetSelect.addEventListener("change", () => {
    if (refs.presetSelect.value !== "") {
      actions.selectPreset(Number(refs.presetSelect.value));
    }
  });
  refs.cycleSecondsInput.addEventListener("change", () => {
    actions.persistSetting("cycleSeconds", refs.cycleSecondsInput.value);
    actions.restartPresetCycle();
  });
  refs.autoCycleEnabledInput.addEventListener("change", () => {
    actions.persistSetting("autoCycleEnabled", refs.autoCycleEnabledInput.checked);
    actions.restartPresetCycle();
  });
  refs.resolutionSelect.addEventListener("change", actions.updateResolution);
  refs.fpsSelect.addEventListener("change", () => {
    actions.persistSetting("fps", refs.fpsSelect.value);
    actions.updateStageMeta();
  });
  refs.bitrateSelect.addEventListener("change", () => {
    actions.persistSetting("bitrate", refs.bitrateSelect.value);
  });
  refs.formatSelect.addEventListener("change", () => {
    actions.persistSetting("format", refs.formatSelect.value);
    actions.updateStageMeta();
  });
  refs.audioDeviceSelect.addEventListener("change", () => {
    actions.persistSetting("audioDeviceId", refs.audioDeviceSelect.value);
    actions.refreshAudioSummary();
    actions.log("Audio device selection updated");
    actions.applyStandbyMeterState();
    actions.updateJammerSourceState();
  });
  refs.refreshDevicesButton.addEventListener("click", actions.loadAudioDevices);
  refs.requestMicPermissionButton.addEventListener("click", actions.requestMicrophonePermission);
  refs.jammerDrummerSelect.addEventListener("change", () => {
    services.jammerEngine.setDrummer(refs.jammerDrummerSelect.value);
    actions.syncJammerControlsFromEngine();
    actions.persistSetting("jammerDrummerId", services.jammerEngine.state.drummerId);
    actions.persistSetting("jammerFeel", services.jammerEngine.state.feel);
    actions.persistSetting("jammerIntensity", String(services.jammerEngine.state.intensity));
    actions.persistSetting("jammerDensity", String(services.jammerEngine.state.density));
    actions.persistSetting("jammerSwing", String(services.jammerEngine.state.swing));
    actions.persistSetting("jammerHumanize", String(services.jammerEngine.state.humanize));
    actions.refreshJammerUi();
    actions.syncJammerPlayback();
    actions.log(`Jammer profile: ${services.jammerEngine.getProfile().name}`);
  });
  refs.jammerDetectionToggleButton.addEventListener("click", async () => {
    actions.setDetectionEnabled(!state.getDetectionEnabled());
    actions.persistSetting("jammerDetectionEnabled", state.getDetectionEnabled());

    if (state.getDetectionEnabled()) {
      await actions.ensureVisualizer();
      await actions.ensureEssentiaListener();
      await actions.ensureAubioListener();
      actions.syncEssentiaSource();
      actions.syncAubioSource();
      actions.refreshJammerUi();
      actions.log("Detection started");
    } else {
      services.reactiveDrummerController.resetReactiveState();
      actions.updateDetectionSummary();
      if (!services.jammerEngine.state.enabled) {
        actions.setToneDrumBusSummary(services.toneDrumBus.stopPattern());
      }
      actions.refreshJammerUi();
      actions.updateStageLoopMonitor();
      actions.log("Detection stopped");
    }
  });
  refs.jammerTimingModelSelect.addEventListener("change", () => {
    const snapshot = services.adaptiveTiming.setTimingModel(refs.jammerTimingModelSelect.value);
    actions.persistSetting("jammerTimingModel", snapshot.timingModel);
    actions.updateDetectionSummary();
    services.jammerEngine.setListenerState(state.getDetectionSummary());
    actions.refreshJammerUi();
    actions.updateStageLoopMonitor();
    actions.log(`Detection timing model: ${snapshot.timingModel === "particle" ? "Particle Grid" : "Kalman PLL"}`);
  });
  refs.jammerPlayToggleButton.addEventListener("click", async () => {
    const nextEnabled = !services.jammerEngine.state.enabled;
    if (nextEnabled) {
      try {
        actions.setToneDrumBusSummary(await services.toneDrumBus.warmup());
        actions.renderInstrumentDeck();
        actions.setDetectionEnabled(true);
        actions.persistSetting("jammerDetectionEnabled", true);
        await actions.ensureVisualizer();
        await actions.ensureEssentiaListener();
        await actions.ensureAubioListener();
        actions.syncEssentiaSource();
        actions.syncAubioSource();
      } catch (error) {
        actions.log(`Tone.js warmup error: ${error.message}`);
        actions.refreshJammerUi();
        return;
      }
    }

    services.jammerEngine.setEnabled(nextEnabled);
    refs.jammerEnabledInput.checked = services.jammerEngine.state.enabled;
    actions.persistSetting("jammerEnabled", services.jammerEngine.state.enabled);
    actions.syncJammerControlsFromEngine();
    if (!nextEnabled) {
      actions.stopLabJam();
      actions.updateStageLoopMonitor();
      return;
    }

    const resolvedSource = services.jammerEngine.getResolvedSource();
    if (resolvedSource === "idle") {
      try {
        await actions.startAutonomousDrummerLoop();
      } catch (error) {
        actions.log(`Drummer start error: ${error.message}`);
      }
      return;
    }

    await actions.syncJammerPlayback();
  });
  refs.jammerEnabledInput.addEventListener("change", () => {
    services.jammerEngine.setEnabled(refs.jammerEnabledInput.checked);
    actions.persistSetting("jammerEnabled", services.jammerEngine.state.enabled);
    if (services.jammerEngine.state.enabled) {
      services.toneDrumBus.warmup()
        .then((summary) => {
          actions.setToneDrumBusSummary(summary);
          actions.refreshJammerUi();
          actions.log(`Tone.js ready (${summary.version})`);
        })
        .catch((error) => {
          actions.log(`Tone.js warmup error: ${error.message}`);
        });
    }
    actions.refreshJammerUi();
    actions.syncJammerPlayback();
  });
  refs.jammerFollowSourceSelect.addEventListener("change", () => {
    services.jammerEngine.setFollowSource(refs.jammerFollowSourceSelect.value);
    actions.persistSetting("jammerFollowSource", services.jammerEngine.state.followSource);
    actions.refreshJammerUi();
    actions.syncJammerPlayback();
  });
  refs.jammerFeelSelect.addEventListener("change", () => {
    services.jammerEngine.setFeel(refs.jammerFeelSelect.value);
    actions.persistSetting("jammerFeel", services.jammerEngine.state.feel);
    actions.refreshJammerUi();
  });
  [
    ["intensity", refs.jammerIntensityRange, "jammerIntensity"],
    ["density", refs.jammerDensityRange, "jammerDensity"],
    ["swing", refs.jammerSwingRange, "jammerSwing"],
    ["humanize", refs.jammerHumanizeRange, "jammerHumanize"],
  ].forEach(([paramKey, element, settingKey]) => {
    element.addEventListener("input", () => {
      services.jammerEngine.setVoicingParam(paramKey, element.value);
      actions.persistSetting(settingKey, String(services.jammerEngine.state[paramKey]));
      actions.refreshJammerUi();
      actions.syncJammerPlayback();
    });
  });
  refs.jammerTempoInput.addEventListener("change", () => {
    services.jammerEngine.setTempo(refs.jammerTempoInput.value);
    refs.jammerTempoInput.value = String(services.jammerEngine.state.tempo);
    actions.persistSetting("jammerTempo", String(services.jammerEngine.state.tempo));
    actions.refreshJammerUi();
    actions.syncJammerPlayback();
  });
  refs.jammerVolumeRange.addEventListener("input", () => {
    actions.setToneDrumBusSummary(services.toneDrumBus.setOutputGain(Number(refs.jammerVolumeRange.value) / 100));
    actions.persistSetting("jammerVolume", refs.jammerVolumeRange.value);
    actions.refreshJammerUi();
  });
  refs.jammerLabToggleButton.addEventListener("click", () => {
    actions.toggleJammerLab();
  });
  refs.jammerStrategyToggleButton.addEventListener("click", () => {
    actions.toggleJammerStrategies();
  });
  [
    refs.jammerLabBpmInput,
    refs.jammerLabBarsSelect,
    refs.jammerLabStyleSelect,
    refs.jammerLabDynamicsRange,
    refs.jammerLabKickPitch,
    refs.jammerLabKickDecay,
    refs.jammerLabSnareDecay,
    refs.jammerLabHatBrightness,
  ].forEach((element) => {
    element.addEventListener("input", () => {
      actions.syncToneLabShape();
      persistLabSettingsWithLog();
      actions.maybeRefreshRunningLabJam();
    });
  });
  refs.jammerLabRatingSelect.addEventListener("change", persistLabSettingsWithLog);
  refs.jammerLabNotes.addEventListener("change", persistLabSettingsWithLog);
  refs.jammerOpenLibraryButton.addEventListener("click", () => {
    actions.toggleJammerLibrary(!state.getJammerDeckLibraryOpen());
    actions.renderInstrumentLibrary();
  });
  refs.jammerSaveDeckPresetButton.addEventListener("click", () => {
    const name = window.prompt("Name this deck preset", `${services.jammerEngine.getProfile().name} Deck`);
    if (!name) {
      return;
    }

    services.saveJammerDeckPreset({
      name,
      settings: actions.getCurrentLabConfig(),
    })
      .then((savedState) => {
        actions.setJammerLabState(savedState);
        actions.renderJammerLabState();
        refs.jammerDeckPresetSelect.value = savedState.deckPresets[0]?.id || "";
        actions.log(`Deck preset saved: ${name}`);
      })
      .catch((error) => {
        actions.log(`Deck preset save error: ${error.message}`);
      });
  });
  refs.jammerLoadDeckPresetButton.addEventListener("click", () => {
    const presets = state.getJammerLabState()?.deckPresets || [];
    const preset = presets.find((entry) => entry.id === refs.jammerDeckPresetSelect.value);
    if (!preset) {
      actions.log("Choose a saved deck first");
      return;
    }

    actions.applyDeckPreset(preset);
    persistLabSettingsWithLog();
    actions.log(`Deck preset loaded: ${preset.name}`);
  });
  refs.jammerCloseLibraryButton.addEventListener("click", () => {
    actions.toggleJammerLibrary(false);
  });
  refs.jammerLabJamToggleButton.addEventListener("click", () => {
    actions.startLabJam().catch((error) => {
      actions.log(`Lab Jam start error: ${error.message}`);
    });
  });
  refs.jammerLabJamStopButton.addEventListener("click", () => {
    actions.stopLabJam();
  });
  refs.jammerLoadCurrentLabButton.addEventListener("click", () => {
    actions.syncToneLabShape();
    actions.log("Current drummer lab shape applied to Tone.js");
  });
  refs.jammerSaveFavoriteButton.addEventListener("click", () => {
    const payload = {
      drummerId: services.jammerEngine.state.drummerId,
      rating: refs.jammerLabRatingSelect.value,
      notes: refs.jammerLabNotes.value,
      settings: actions.getCurrentLabConfig(),
    };
    services.saveJammerLabFavorite(payload)
      .then((savedState) => {
        actions.setJammerLabState(savedState);
        actions.renderJammerLabState();
        actions.log("Drummer lab favorite saved");
      })
      .catch((error) => {
        actions.log(`Favorite save error: ${error.message}`);
      });
  });

  services.playerView.bindEvents();
  refs.canvasFrame.addEventListener("dblclick", () => {
    if (document.fullscreenElement === refs.stageShell) {
      actions.exitStageFullscreen({ collapse: true }).catch((error) => {
        actions.log(`Fullscreen exit error: ${error.message}`);
      });
      return;
    }

    if (state.getStageExpanded()) {
      actions.requestStageFullscreen().catch((error) => {
        actions.log(`Fullscreen request error: ${error.message}`);
      });
      return;
    }

    actions.toggleStageExpanded(true);
  });
  refs.canvasFrame.querySelectorAll(".resize-handle").forEach((handle) => {
    handle.addEventListener("pointerdown", (event) => {
      actions.startStageResize(event, handle.dataset.resize || "e");
    });
  });
  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && document.fullscreenElement === refs.stageShell) {
      actions.exitStageFullscreen({ collapse: true }).catch((error) => {
        actions.log(`Fullscreen exit error: ${error.message}`);
      });
      return;
    }

    if (event.key === "Escape" && state.getStageExpanded()) {
      actions.toggleStageExpanded(false);
    }
  });
  document.addEventListener("fullscreenchange", () => {
    actions.setStageFullscreenActive(document.fullscreenElement === refs.stageShell);
    refs.canvasFrame.classList.toggle("fullscreen-active", state.getStageFullscreenActive());
    if (!state.getStageFullscreenActive() && state.getStageExpanded()) {
      actions.toggleStageExpanded(false);
    }
  });
  window.addEventListener("resize", () => {
    const inlineWidth = state.getStageInlineWidth();
    if (!state.getStageExpanded() && inlineWidth) {
      actions.setStageWidth(parseFloat(inlineWidth));
    }
  });
}

async function initializeRecorderApp(context) {
  const {
    refs,
    state,
    actions,
    services,
  } = context;

  actions.renderSkinOptions();
  actions.setStageInlineWidth(`${Math.round(refs.stageShell.getBoundingClientRect().width)}px`);
  actions.placeJammerRuntimePanels();
  actions.setAppSettings(await services.loadSettings());
  actions.setJammerResearchCatalog(await services.syncJammerResearchCatalog());
  actions.setJammerLabState(await services.loadJammerLabState());
  actions.setReactiveBehaviorStrategies(await services.loadJammerReactiveStrategies());
  actions.applyStoredSettings(state.getAppSettings());
  actions.updateVisualizerToggleUi();
  actions.applyLabConfigToUi(state.getJammerLabState().settings);
  actions.syncToneLabShape();
  actions.renderReactiveStrategies();
  actions.toggleJammerStrategies(false);
  actions.renderJammerCatalog();
  actions.renderJammerResearchCatalog();
  actions.renderJammerLabState();
  actions.refreshLabJamButtons();
  actions.updateStageLoopMonitor();
  actions.setLoopMonitorTimer(window.setInterval(actions.updateStageLoopMonitor, 120));
  actions.setSkin(state.getAppSettings().skinId || services.defaultSkinId, false);
  actions.loadPresets();
  await actions.prepareMicrophoneAccess();
  await actions.restorePlayerSourceFromDb();
  if (state.getPlayerPlaylist().length === 0) {
    await actions.loadDefaultLibraryPlaylist().catch((error) => {
      actions.log(`Default library unavailable: ${error.message}`);
    });
  }
  actions.showPanel(state.getAppSettings().activeTab || "studio", false);
  actions.restartPresetCycle();
  actions.updateStageMeta();
  actions.refreshAudioSummary();
  actions.applyStandbyMeterState();
  actions.syncMicButtons();
  actions.updateJammerSourceState();
  actions.log("Ready");
}

export { bindAppEvents, initializeRecorderApp };
