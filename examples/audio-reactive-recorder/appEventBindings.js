function bindShellEvents(context) {
  const { refs, state, actions } = context;

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
  refs.sunoTabButton.addEventListener("click", (event) => {
    event.stopPropagation();
    actions.showPanel(refs.sunoPanel.classList.contains("active") ? "studio" : "suno");
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
  refs.stagePanelToggleButton?.addEventListener("click", () => {
    actions.toggleStagePanel();
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
}

function bindSunoControls(context) {
  const { refs, actions } = context;

  refs.sunoRefreshButton?.addEventListener("click", () => {
    actions.loadSunoProductionsCatalog({ preserveSelection: true }).catch((error) => {
      actions.log(`Suno refresh error: ${error.message}`);
    });
  });
  refs.sunoSearchInput?.addEventListener("input", () => {
    actions.setSunoSearchQuery(refs.sunoSearchInput.value);
    actions.renderSunoProductions();
  });
  refs.sunoVisibilityFilter?.addEventListener("change", () => {
    actions.setSunoVisibilityFilter(refs.sunoVisibilityFilter.value);
    actions.renderSunoProductions();
  });
  refs.sunoSongList?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-song-id]");
    if (!button) {
      return;
    }

    actions.selectSunoProduction(button.dataset.songId).catch((error) => {
      actions.log(`Suno song load error: ${error.message}`);
    });
  });
}

function bindJammerControls(context) {
  const { refs, state, actions, services } = context;

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
  refs.jammerLabPanelToggleButton?.addEventListener("click", () => {
    actions.toggleJammerLab();
  });
  refs.jammerMainPanelToggleButton?.addEventListener("click", () => {
    actions.toggleJammerMainPanel();
  });
  refs.jammerStrategyToggleButton.addEventListener("click", () => {
    actions.toggleJammerStrategies();
  });
}

function bindDetectionControls(context) {
  const { refs, state, actions, services } = context;

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
  refs.jammerDetectorModeSelect.addEventListener("change", () => {
    const snapshot = services.adaptiveTiming.setDetectorMode(refs.jammerDetectorModeSelect.value);
    actions.persistSetting("jammerDetectorMode", snapshot.detectorMode);
    actions.updateDetectionSummary();
    services.jammerEngine.setListenerState(state.getDetectionSummary());
    actions.refreshJammerUi();
    actions.updateStageLoopMonitor();
    actions.log(`Detection source model: ${snapshot.detectorMode}`);
  });
  refs.jammerModuleContributionsToggleButton?.addEventListener("click", () => {
    actions.toggleModuleContributionsPanel();
  });
  refs.jammerCalibrationTrackSelect.addEventListener("change", () => {
    actions.setDetectorCalibrationTrackId(refs.jammerCalibrationTrackSelect.value);
    actions.loadCurrentSongAnalysisFromDb().catch((error) => {
      actions.log(`Calibration track load error: ${error.message}`);
    });
  });
  refs.jammerCalibrationToggleButton?.addEventListener("click", () => {
    actions.toggleDetectorCalibrationPanel();
  });
  refs.jammerSongAnalyzeButton.addEventListener("click", () => {
    actions.analyzeCurrentPlayerTrack().catch((error) => {
      actions.log(`Song analysis error: ${error.message}`);
    });
  });
  refs.jammerCalibrationRunTestButton.addEventListener("click", () => {
    actions.startDetectorCalibrationTest().catch((error) => {
      actions.log(`Playback calibration error: ${error.message}`);
    });
  });
  refs.jammerCalibrationRetestAubioButton.addEventListener("click", () => {
    actions.repeatModuleCalibrationTest("aubio", {
      applySuggestions: refs.jammerCalibrationApplyAubioCheckbox.checked,
    }).catch((error) => {
      actions.log(`Aubio calibration retest error: ${error.message}`);
    });
  });
  refs.jammerCalibrationRetestEssentiaButton.addEventListener("click", () => {
    actions.repeatModuleCalibrationTest("essentia", {
      applySuggestions: refs.jammerCalibrationApplyEssentiaCheckbox.checked,
    }).catch((error) => {
      actions.log(`Essentia calibration retest error: ${error.message}`);
    });
  });
  refs.jammerCalibrationRepeatSelectedButton.addEventListener("click", () => {
    actions.repeatSelectedCalibrationTests({
      applyAubio: refs.jammerCalibrationApplyAubioCheckbox.checked,
      applyEssentia: refs.jammerCalibrationApplyEssentiaCheckbox.checked,
    }).catch((error) => {
      actions.log(`Calibration repeat error: ${error.message}`);
    });
  });
  refs.jammerDetectionPanelToggleButton?.addEventListener("click", () => {
    actions.toggleDetectionPanel();
  });
  refs.jammerDetectionExperimentToggleButton?.addEventListener("click", () => {
    actions.toggleDetectionExperimentPanel();
  });
  refs.jammerDetectionExperimentWindowDownButton?.addEventListener("click", () => {
    actions.adjustDetectionExperimentChartWindow(-1);
  });
  refs.jammerDetectionExperimentWindowUpButton?.addEventListener("click", () => {
    actions.adjustDetectionExperimentChartWindow(1);
  });
  refs.jammerDetectionExperimentSoloButton?.addEventListener("click", () => {
    actions.updateDetectionExperimentConfig({
      soloEnabled: !(state.getDetectionExperimentConfig?.()?.soloEnabled === true),
    });
  });
  refs.jammerDetectionExperimentPresetSelect?.addEventListener("change", () => {
    const presetId = refs.jammerDetectionExperimentPresetSelect.value || "";
    actions.setDetectionExperimentLastPresetId?.(presetId);
    actions.persistSetting("detectionExperimentLastPresetId", presetId);
    if (refs.jammerDetectionExperimentPresetName) {
      const selectedPreset = state.getDetectionExperimentPresets?.().find((preset) => preset.id === presetId);
      refs.jammerDetectionExperimentPresetName.value = selectedPreset?.name || "";
    }
    refs.jammerDetectionExperimentRenamePresetButton && (refs.jammerDetectionExperimentRenamePresetButton.disabled = !presetId);
    refs.jammerDetectionExperimentLoadPresetButton && (refs.jammerDetectionExperimentLoadPresetButton.disabled = !presetId);
    refs.jammerDetectionExperimentDeletePresetButton && (refs.jammerDetectionExperimentDeletePresetButton.disabled = !presetId);
  });
  refs.jammerDetectionExperimentSavePresetButton?.addEventListener("click", () => {
    actions.saveDetectionExperimentPreset();
  });
  refs.jammerDetectionExperimentRenamePresetButton?.addEventListener("click", () => {
    actions.renameDetectionExperimentPreset?.(refs.jammerDetectionExperimentPresetSelect?.value || "", refs.jammerDetectionExperimentPresetName?.value || "");
  });
  refs.jammerDetectionExperimentLoadPresetButton?.addEventListener("click", () => {
    actions.loadDetectionExperimentPreset(refs.jammerDetectionExperimentPresetSelect?.value || "");
  });
  refs.jammerDetectionExperimentDeletePresetButton?.addEventListener("click", () => {
    actions.deleteDetectionExperimentPreset(refs.jammerDetectionExperimentPresetSelect?.value || "");
  });
  refs.jammerDetectionExperimentPluginSelect?.addEventListener("change", () => {
    actions.selectDetectionExperimentPluginMode?.(refs.jammerDetectionExperimentPluginSelect.value || "essentia");
  });
  refs.wiringPanelToggleButton?.addEventListener("click", () => {
    actions.toggleWiringPanel();
  });

  const experimentFields = [
    refs.jammerDetectionExperimentNormalizeEnabled,
    refs.jammerDetectionExperimentNormalizeTarget,
    refs.jammerDetectionExperimentLowBandMin,
    refs.jammerDetectionExperimentLowCutoff,
    refs.jammerDetectionExperimentMidCutoff,
    refs.jammerDetectionExperimentRawEnabled,
    refs.jammerDetectionExperimentLowEnabled,
    refs.jammerDetectionExperimentMidEnabled,
    refs.jammerDetectionExperimentHighEnabled,
    refs.jammerDetectionExperimentTonalEnabled,
    refs.jammerDetectionExperimentRawWeight,
    refs.jammerDetectionExperimentLowWeight,
    refs.jammerDetectionExperimentMidWeight,
    refs.jammerDetectionExperimentHighWeight,
    refs.jammerDetectionExperimentTonalWeight,
    refs.jammerDetectionExperimentOnsetThreshold,
    refs.jammerDetectionExperimentTempoMin,
    refs.jammerDetectionExperimentTempoMax,
    refs.jammerDetectionExperimentAubioTransientBias,
    refs.jammerDetectionExperimentAubioLowBias,
    refs.jammerDetectionExperimentEssentiaTickBias,
    refs.jammerDetectionExperimentEssentiaHarmonicBias,
  ].filter(Boolean);
  const syncDetectionExperimentConfigFromUi = () => {
    actions.updateDetectionExperimentConfig({
      normalizeEnabled: refs.jammerDetectionExperimentNormalizeEnabled.checked,
      normalizeTargetPeak: Number(refs.jammerDetectionExperimentNormalizeTarget.value || 0.94),
      lowBandMinHz: Number(refs.jammerDetectionExperimentLowBandMin.value || 35),
      lowCutoffHz: Number(refs.jammerDetectionExperimentLowCutoff.value || 140),
      midCutoffHz: Number(refs.jammerDetectionExperimentMidCutoff.value || 2400),
      rawEnabled: refs.jammerDetectionExperimentRawEnabled.checked,
      lowEnabled: refs.jammerDetectionExperimentLowEnabled.checked,
      midEnabled: refs.jammerDetectionExperimentMidEnabled.checked,
      highEnabled: refs.jammerDetectionExperimentHighEnabled.checked,
      tonalEnabled: refs.jammerDetectionExperimentTonalEnabled.checked,
      rawWeight: Number(refs.jammerDetectionExperimentRawWeight.value || 0.18),
      lowWeight: Number(refs.jammerDetectionExperimentLowWeight.value || 0.48),
      midWeight: Number(refs.jammerDetectionExperimentMidWeight.value || 0.2),
      highWeight: Number(refs.jammerDetectionExperimentHighWeight.value || 0.16),
      tonalWeight: Number(refs.jammerDetectionExperimentTonalWeight.value || 0.16),
      onsetThreshold: Number(refs.jammerDetectionExperimentOnsetThreshold.value || 0.085),
      bpmMin: Number(refs.jammerDetectionExperimentTempoMin.value || 70),
      bpmMax: Number(refs.jammerDetectionExperimentTempoMax.value || 180),
      aubioSettings: {
        transientBias: Number(refs.jammerDetectionExperimentAubioTransientBias.value || 0.64),
        lowPulseBias: Number(refs.jammerDetectionExperimentAubioLowBias.value || 0.42),
      },
      essentiaSettings: {
        stableTickBias: Number(refs.jammerDetectionExperimentEssentiaTickBias.value || 0.46),
        harmonicAnchorWeight: Number(refs.jammerDetectionExperimentEssentiaHarmonicBias.value || 0.26),
      },
    });
  };
  experimentFields.forEach((field) => {
    const eventName = field.type === "checkbox" || field.tagName === "SELECT" ? "change" : "input";
    field.addEventListener(eventName, syncDetectionExperimentConfigFromUi);
  });
}

function bindBenchmarkControls(context) {
  const { refs, state, actions } = context;

  refs.jammerBpmBenchmarkTrackSelect.addEventListener("change", () => {
    actions.setBpmBenchmarkTrackIds(Array.from(refs.jammerBpmBenchmarkTrackSelect.selectedOptions).map((option) => option.value).filter(Boolean));
    actions.loadCurrentBpmBenchmarkState().catch((error) => {
      actions.log(`BPM benchmark load error: ${error.message}`);
    });
  });
  refs.jammerBpmBenchmarkReloadButton?.addEventListener("click", () => {
    actions.loadBpmBenchmarkCatalogFromServer().catch((error) => {
      actions.log(`BPM benchmark catalog reload error: ${error.message}`);
    });
  });
  refs.jammerBpmBenchmarkToggleButton?.addEventListener("click", () => {
    actions.toggleBpmBenchmarkPanel();
  });
  refs.jammerBpmBenchmarkRunButton.addEventListener("click", () => {
    actions.runBpmBenchmark().catch((error) => {
      actions.log(`BPM benchmark error: ${error.message}`);
    });
  });
  refs.jammerBpmBenchmarkRetestAubioButton.addEventListener("click", () => {
    actions.runBpmBenchmark({
      moduleKeys: ["aubio"],
      applySuggestions: { aubio: refs.jammerBpmBenchmarkApplyAubioCheckbox.checked },
    }).catch((error) => {
      actions.log(`Aubio benchmark retest error: ${error.message}`);
    });
  });
  refs.jammerBpmBenchmarkEvolveAubioButton?.addEventListener("click", () => {
    actions.evolveBpmBenchmarkModule({
      moduleKey: "aubio",
      steps: 10,
      trackIds: state.getBpmBenchmarkTrackIds(),
    }).catch((error) => {
      actions.log(`Aubio benchmark evolve error: ${error.message}`);
    });
  });
  refs.jammerBpmBenchmarkRetestEssentiaButton.addEventListener("click", () => {
    actions.runBpmBenchmark({
      moduleKeys: ["essentia"],
      applySuggestions: { essentia: refs.jammerBpmBenchmarkApplyEssentiaCheckbox.checked },
    }).catch((error) => {
      actions.log(`Essentia benchmark retest error: ${error.message}`);
    });
  });
  refs.jammerBpmBenchmarkEvolveEssentiaButton?.addEventListener("click", () => {
    actions.evolveBpmBenchmarkModule({
      moduleKey: "essentia",
      steps: 10,
      trackIds: state.getBpmBenchmarkTrackIds(),
    }).catch((error) => {
      actions.log(`Essentia benchmark evolve error: ${error.message}`);
    });
  });
  refs.jammerBpmBenchmarkRepeatSelectedButton.addEventListener("click", () => {
    actions.runBpmBenchmark({
      moduleKeys: [
        ...(refs.jammerBpmBenchmarkApplyAubioCheckbox.checked ? ["aubio"] : []),
        ...(refs.jammerBpmBenchmarkApplyEssentiaCheckbox.checked ? ["essentia"] : []),
      ].length > 0
        ? [
          ...(refs.jammerBpmBenchmarkApplyAubioCheckbox.checked ? ["aubio"] : []),
          ...(refs.jammerBpmBenchmarkApplyEssentiaCheckbox.checked ? ["essentia"] : []),
        ]
        : ["aubio", "essentia"],
      applySuggestions: {
        aubio: refs.jammerBpmBenchmarkApplyAubioCheckbox.checked,
        essentia: refs.jammerBpmBenchmarkApplyEssentiaCheckbox.checked,
      },
    }).catch((error) => {
      actions.log(`BPM benchmark repeat error: ${error.message}`);
    });
  });
  refs.jammerBpmBenchmarkResults?.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-bpm-action]");
    if (!button) {
      return;
    }

    const fileId = button.dataset.bpmFileId || "";
    const moduleKey = button.dataset.moduleKey || "";
    const rerun = button.dataset.bpmAction === "apply-retest";
    const evolve = button.dataset.bpmAction === "evolve-x10";
    if (!fileId || !moduleKey) {
      return;
    }

    const scopeSelector = `[data-bpm-file-id="${fileId}"][data-module-key="${moduleKey}"] input[data-suggestion-key]:checked`;
    const suggestionKeys = Array.from(refs.jammerBpmBenchmarkResults.querySelectorAll(scopeSelector))
      .map((input) => input.dataset.suggestionKey)
      .filter(Boolean);

    if (evolve) {
      actions.evolveBpmBenchmarkModule({
        moduleKey,
        steps: 10,
        trackIds: [fileId],
      }).catch((error) => {
        actions.log(`BPM benchmark evolve error: ${error.message}`);
      });
      return;
    }

    actions.applyBpmBenchmarkSuggestionsForFile({
      fileId,
      moduleKey,
      suggestionKeys,
      rerun,
    }).catch((error) => {
      actions.log(`BPM benchmark apply error: ${error.message}`);
    });
  });
}

function bindLabControls(context) {
  const { refs, state, actions, services } = context;

  const persistLabSettingsWithLog = () => {
    actions.persistJammerLabSettings().catch((error) => {
      actions.log(`Drummer lab save error: ${error.message}`);
    });
  };

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
}

function bindStageEvents(context) {
  const { refs, state, actions, services } = context;

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

export function bindRecorderEventGroups(context) {
  bindShellEvents(context);
  bindSunoControls(context);
  bindJammerControls(context);
  bindDetectionControls(context);
  bindBenchmarkControls(context);
  bindLabControls(context);
  bindStageEvents(context);
}
