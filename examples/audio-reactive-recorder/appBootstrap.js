import { bindRecorderEventGroups } from "./appEventBindings.js";

function startBpmBenchmarkCatalogLoad(actions) {
  return actions.loadBpmBenchmarkCatalogFromServer().catch((error) => {
    actions.log(`BPM benchmark catalog unavailable: ${error.message}`);
  });
}

async function loadInitialAppState(context) {
  const { state, actions, services } = context;

  actions.setAppSettings(await services.loadSettings());
  actions.setJammerResearchCatalog(await services.syncJammerResearchCatalog());
  actions.setJammerLabState(await services.loadJammerLabState());
  actions.setReactiveBehaviorStrategies(await services.loadJammerReactiveStrategies());

  actions.applyStoredSettings(state.getAppSettings());
  actions.updateVisualizerToggleUi();
  actions.applyLabConfigToUi(state.getJammerLabState().settings);
  actions.syncToneLabShape();
}

function renderInitialUi(context) {
  const { refs, state, actions, services } = context;

  actions.renderSkinOptions();
  actions.setStageInlineWidth(`${Math.round(refs.stageShell.getBoundingClientRect().width)}px`);
  actions.placeJammerRuntimePanels();
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
}

async function restoreInitialSources(context) {
  const { state, actions } = context;

  await actions.prepareMicrophoneAccess();
  await actions.restorePlayerSourceFromDb();
  if (state.getPlayerPlaylist().length === 0) {
    await actions.loadDefaultLibraryPlaylist().catch((error) => {
      actions.log(`Default library unavailable: ${error.message}`);
    });
  }
}

function scheduleBpmBenchmarkRetry(context) {
  const { state, actions } = context;

  if (state.getBpmBenchmarkTracks().length > 0) {
    return;
  }

  window.setTimeout(() => {
    actions.loadBpmBenchmarkCatalogFromServer().catch((error) => {
      actions.log(`BPM benchmark catalog retry failed: ${error.message}`);
    });
  }, 1200);
}

function finalizeStartup(context) {
  const { state, actions } = context;

  actions.showPanel(state.getAppSettings().activeTab || "studio", false);
  actions.restartPresetCycle();
  actions.updateStageMeta();
  actions.refreshAudioSummary();
  actions.applyStandbyMeterState();
  actions.syncMicButtons();
  actions.updateJammerSourceState();
  actions.log("Ready");
}

function bindAppEvents(context) {
  bindRecorderEventGroups(context);
}

async function initializeRecorderApp(context) {
  const { actions } = context;
  const bpmBenchmarkCatalogPromise = startBpmBenchmarkCatalogLoad(actions);

  await loadInitialAppState(context);
  renderInitialUi(context);
  await restoreInitialSources(context);
  await bpmBenchmarkCatalogPromise;
  scheduleBpmBenchmarkRetry(context);
  finalizeStartup(context);
}

export { bindAppEvents, initializeRecorderApp };
