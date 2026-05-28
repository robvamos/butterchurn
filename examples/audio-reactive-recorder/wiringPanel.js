function renderStatusChip(id, title) {
  return `
    <div id="${id}" class="wiring-chip">
      <span class="wiring-chip-label">${title}</span>
      <strong class="wiring-chip-value">Idle</strong>
    </div>
  `;
}

function renderNode(id, title, value = "Idle") {
  return `
    <div id="${id}" class="wiring-node" data-state="idle">
      <span class="wiring-node-label">${title}</span>
      <strong class="wiring-node-value">${value}</strong>
    </div>
  `;
}

export function renderWiringPanel() {
  return `
    <div class="settings-card wiring-card">
      <div class="jammer-detection-section-head">
        <div class="jammer-detection-headline-block">
          <div class="section-title">Wiring</div>
          <div id="wiringPanelStatus" class="jammer-panel-status">Idle</div>
          <div class="hint">Live map of the audio path: input, shared preprocessing, open-source detector lanes, adaptive grid building, phase alignment, structure memory, and drummer output.</div>
        </div>
        <button
          id="wiringPanelToggleButton"
          class="jammer-icon-toggle jammer-section-toggle active"
          type="button"
          aria-label="Collapse wiring"
          aria-expanded="true"
          title="Collapse wiring"
        >
          <span class="jammer-section-toggle-glyph" aria-hidden="true">▾</span>
        </button>
      </div>

      <div id="wiringPanelBody" class="wiring-panel-body">
        <div id="wiringSummary" class="wiring-summary">Studio idle. Open a source to watch the flow wake up.</div>

        <div class="wiring-flow-grid">
          ${renderNode("wiringInputNode", "Input")}
          <div class="wiring-flow-arrow" aria-hidden="true">→</div>
          ${renderNode("wiringPreprocessNode", "Shared Preprocess")}
          <div class="wiring-flow-arrow" aria-hidden="true">→</div>
          ${renderNode("wiringPluginNode", "Beat Lanes")}
          <div class="wiring-flow-arrow" aria-hidden="true">→</div>
          ${renderNode("wiringGridNode", "Adaptive Grid")}
        </div>

        <div class="wiring-detail-grid">
          <div class="wiring-detail-section">
            <div class="wiring-chip-section-title">Input</div>
            <div class="wiring-branch-grid">
              ${renderNode("wiringInputSourceNode", "Source")}
              ${renderNode("wiringInputRouteNode", "Route")}
              ${renderNode("wiringInputPowerNode", "Live")}
            </div>
          </div>

          <div class="wiring-detail-section">
            <div class="wiring-chip-section-title">Preprocessing</div>
            <div class="wiring-branch-grid">
              ${renderNode("wiringNormalizeNode", "Shared lane")}
              ${renderNode("wiringSignalCountNode", "Signals")}
              ${renderNode("wiringSignalWeightsNode", "Weights + raw")}
            </div>
            <div class="wiring-summary compact" id="wiringSignalSummary">No preprocessing signals active yet.</div>
          </div>

          <div class="wiring-detail-section">
            <div class="wiring-chip-section-title">Detector Lanes</div>
            <div class="wiring-branch-grid">
              ${renderNode("wiringAubioNode", "Aubio fast")}
              ${renderNode("wiringEssentiaNode", "Essentia deep")}
              ${renderNode("wiringFusionNode", "Grid brain")}
            </div>
          </div>

          <div class="wiring-detail-section">
            <div class="wiring-chip-section-title">Grid + Structure</div>
            <div class="wiring-branch-grid">
              ${renderNode("wiringClockNode", "Kalman / Particle")}
              ${renderNode("wiringPhaseNode", "Beat + bar phase")}
              ${renderNode("wiringStructureNode", "Song form")}
            </div>
            <div class="wiring-summary compact" id="wiringClockSummary">JamPal builds a Mixxx-style adaptive beatgrid from detector evidence, then Kalman or Particle stabilizes tempo, beat phase, and bar loop.</div>
          </div>
        </div>

        <div class="wiring-flow-grid secondary">
          ${renderNode("wiringFeedbackNode", "Feedback")}
          <div class="wiring-flow-arrow" aria-hidden="true">→</div>
          ${renderNode("wiringDrummerNode", "Drummer")}
          <div class="wiring-flow-arrow" aria-hidden="true">→</div>
          ${renderNode("wiringVisualNode", "Visuals")}
          <div class="wiring-flow-arrow" aria-hidden="true">→</div>
          ${renderNode("wiringRecorderNode", "Recorder")}
        </div>

        <div class="wiring-chip-section">
          <div class="wiring-chip-section-title">Panels</div>
          <div class="wiring-chip-grid">
            ${renderStatusChip("wiringStudioChip", "Studio")}
            ${renderStatusChip("wiringJammerChip", "Jam")}
            ${renderStatusChip("wiringSettingsChip", "Settings")}
            ${renderStatusChip("wiringDetectionChip", "Detection")}
            ${renderStatusChip("wiringExperimentChip", "Experiment")}
            ${renderStatusChip("wiringLabChip", "Drummer Lab")}
          </div>
        </div>
      </div>
    </div>
  `;
}

export function getWiringRefs(root = document) {
  return {
    wiringPanelStatus: root.getElementById("wiringPanelStatus"),
    wiringPanelToggleButton: root.getElementById("wiringPanelToggleButton"),
    wiringPanelBody: root.getElementById("wiringPanelBody"),
    wiringSummary: root.getElementById("wiringSummary"),
    wiringInputNode: root.getElementById("wiringInputNode"),
    wiringPreprocessNode: root.getElementById("wiringPreprocessNode"),
    wiringPluginNode: root.getElementById("wiringPluginNode"),
    wiringGridNode: root.getElementById("wiringGridNode"),
    wiringInputSourceNode: root.getElementById("wiringInputSourceNode"),
    wiringInputRouteNode: root.getElementById("wiringInputRouteNode"),
    wiringInputPowerNode: root.getElementById("wiringInputPowerNode"),
    wiringNormalizeNode: root.getElementById("wiringNormalizeNode"),
    wiringSignalCountNode: root.getElementById("wiringSignalCountNode"),
    wiringSignalWeightsNode: root.getElementById("wiringSignalWeightsNode"),
    wiringSignalSummary: root.getElementById("wiringSignalSummary"),
    wiringAubioNode: root.getElementById("wiringAubioNode"),
    wiringEssentiaNode: root.getElementById("wiringEssentiaNode"),
    wiringFusionNode: root.getElementById("wiringFusionNode"),
    wiringClockNode: root.getElementById("wiringClockNode"),
    wiringPhaseNode: root.getElementById("wiringPhaseNode"),
    wiringStructureNode: root.getElementById("wiringStructureNode"),
    wiringClockSummary: root.getElementById("wiringClockSummary"),
    wiringFeedbackNode: root.getElementById("wiringFeedbackNode"),
    wiringDrummerNode: root.getElementById("wiringDrummerNode"),
    wiringVisualNode: root.getElementById("wiringVisualNode"),
    wiringRecorderNode: root.getElementById("wiringRecorderNode"),
    wiringStudioChip: root.getElementById("wiringStudioChip"),
    wiringJammerChip: root.getElementById("wiringJammerChip"),
    wiringSettingsChip: root.getElementById("wiringSettingsChip"),
    wiringDetectionChip: root.getElementById("wiringDetectionChip"),
    wiringExperimentChip: root.getElementById("wiringExperimentChip"),
    wiringLabChip: root.getElementById("wiringLabChip"),
  };
}

function setNode(ref, label, state) {
  if (!ref) {
    return;
  }
  ref.dataset.state = state;
  const value = ref.querySelector(".wiring-node-value");
  if (value) {
    value.textContent = label;
  }
}

function setChip(ref, label, state) {
  if (!ref) {
    return;
  }
  ref.dataset.state = state;
  const value = ref.querySelector(".wiring-chip-value");
  if (value) {
    value.textContent = label;
  }
}

function getTimingModelLabel(model) {
  return model === "particle" ? "Particle" : "Kalman";
}

function getDetectorLabel(mode) {
  switch (mode) {
    case "aubio":
      return "Aubio fast";
    case "essentia":
      return "Essentia deep";
    default:
      return "Fusion";
  }
}

function getActiveSignalList(config = {}) {
  const signals = [];
  if (config.rawEnabled !== false) {
    signals.push("raw amp");
  }
  if (config.lowEnabled !== false) {
    signals.push("low");
  }
  if (config.midEnabled !== false) {
    signals.push("mid");
  }
  if (config.highEnabled !== false) {
    signals.push("high");
  }
  if (config.tonalEnabled !== false) {
    signals.push("tonal");
  }
  return signals;
}

function getSignalWeightSummary(config = {}) {
  const parts = [];
  if (config.rawEnabled !== false) {
    parts.push(`raw ${Number(config.rawWeight ?? 0).toFixed(2)}`);
  }
  if (config.lowEnabled !== false) {
    parts.push(`low ${Number(config.lowWeight ?? 0).toFixed(2)}`);
  }
  if (config.midEnabled !== false) {
    parts.push(`mid ${Number(config.midWeight ?? 0).toFixed(2)}`);
  }
  if (config.highEnabled !== false) {
    parts.push(`high ${Number(config.highWeight ?? 0).toFixed(2)}`);
  }
  if (config.tonalEnabled !== false) {
    parts.push(`tonal ${Number(config.tonalWeight ?? 0).toFixed(2)}`);
  }
  return parts.join(" - ");
}

export function createWiringPanelView({ refs, getState }) {
  function updateWiringPanel() {
    const state = getState();
    const sourceLabel = state.playerLive
      ? "Player live"
      : state.micLive
        ? "Mic live"
        : state.activeInputMode === "player"
          ? "Player armed"
          : state.activeInputMode === "microphone"
            ? "Mic armed"
            : "Idle";
    const preprocessActive = Boolean(
      state.detectionEnabled
      || state.songAnalysisRunning
      || state.bpmBenchmarkRunning
      || state.detectorCalibrationActive
      || state.detectionExperimentActive
    );
    const detectorLabel = getDetectorLabel(state.detectionSummary?.detectorMode);
    const timingLabel = getTimingModelLabel(state.detectionSummary?.timingModel);
    const lock = Math.round(Number(state.detectionSummary?.pllLock || 0) * 100);
    const beatLabel = Number(state.detectionSummary?.beatInBar || 0) > 0
      ? `${Number(state.detectionSummary?.beatInBar || 0)}/4`
      : "Waiting";
    const loopLabel = Number(state.detectionSummary?.phaseBars || 0) > 0
      ? `${Number(state.detectionSummary?.phase || 0) || 0} in ${Number(state.detectionSummary?.phaseBars || 0)}`
      : `${Number(state.detectionSummary?.phase || 0) || 0}/4`;
    const config = state.detectionExperimentConfig || {};
    const activeSignals = getActiveSignalList(config);
    const signalSummary = activeSignals.length ? activeSignals.join(", ") : "none";
    const inputMixPercent = Math.round(Number(state.detectionExperimentSnapshot?.weightedPulse || 0) * 100);
    const aubioTempo = Number(state.detectionSummary?.aubioTempo || state.aubioSummary?.tempo || 0);
    const essentiaTempo = Number(
      state.detectionSummary?.essentiaStableTempo
      || state.detectionSummary?.essentiaTempo
      || state.essentiaSummary?.stableTempo
      || state.essentiaSummary?.tempo
      || 0
    );
    const phaseConfidence = Math.round(Number(state.detectionSummary?.phaseConfidence || 0));
    const structureLabel = state.currentSongAnalysis?.structure?.currentSection
      || state.currentSongAnalysis?.formLabel
      || "Waiting";
    const outputSummary = [
      state.jammerEnabled ? "Drummer" : null,
      state.visualizerEnabled ? "Visuals" : null,
      state.recordingActive ? "Recording" : null,
    ].filter(Boolean);
    const feedbackLabel = state.micLive && state.jammerEnabled
      ? "Drummer masking on"
      : state.jammerEnabled
        ? "Reactive loop only"
        : "No feedback loop";

    if (refs.wiringPanelStatus) {
      refs.wiringPanelStatus.textContent = preprocessActive
        ? `${sourceLabel} -> ${detectorLabel} -> ${timingLabel}`
        : "Idle";
    }
    if (refs.wiringSummary) {
      refs.wiringSummary.textContent = preprocessActive
        ? `${sourceLabel} enters Web Audio preprocessing, opens ${activeSignals.length} signal lanes (${signalSummary}), feeds the ${detectorLabel.toLowerCase()} lane, then the JamPal adaptive grid core applies ${timingLabel.toLowerCase()} smoothing before the drummer reacts.`
        : "Studio idle. Open a source to watch the flow wake up.";
    }

    setNode(refs.wiringInputNode, sourceLabel, sourceLabel === "Idle" ? "idle" : "active");
    setNode(refs.wiringPreprocessNode, preprocessActive ? `${activeSignals.length} lanes active` : "Standby", preprocessActive ? "active" : "idle");
    setNode(refs.wiringPluginNode, preprocessActive ? detectorLabel : "Waiting", preprocessActive ? "active" : "idle");
    setNode(refs.wiringGridNode, preprocessActive ? `${timingLabel} - ${lock}% lock` : "Waiting", preprocessActive ? "focus" : "idle");

    setNode(refs.wiringInputSourceNode, state.activeInputMode === "none" ? "No route" : state.activeInputMode, state.activeInputMode === "none" ? "idle" : "active");
    setNode(refs.wiringInputRouteNode, sourceLabel, sourceLabel === "Idle" ? "idle" : "active");
    setNode(refs.wiringInputPowerNode, state.playerLive || state.micLive ? "Live" : "Armed/idle", state.playerLive || state.micLive ? "focus" : "idle");

    setNode(refs.wiringNormalizeNode, config.normalizeEnabled === false ? "Bypassed" : `Peak ${Number(config.normalizeTargetPeak || 0.94).toFixed(2)}`, config.normalizeEnabled === false ? "idle" : "active");
    setNode(refs.wiringSignalCountNode, `${activeSignals.length} signals`, activeSignals.length ? "active" : "idle");
    setNode(refs.wiringSignalWeightsNode, activeSignals.length ? `Mix ${inputMixPercent}%` : "No weights", activeSignals.length ? "focus" : "idle");
    if (refs.wiringSignalSummary) {
      refs.wiringSignalSummary.textContent = activeSignals.length
        ? `Signals in play: ${signalSummary}. Weights: ${getSignalWeightSummary(config)}. Shared preprocessing is browser-side and can include raw amp, low, mid, high, and tonal lanes. Low range ${Number(config.lowBandMinHz || 35)}-${Number(config.lowCutoffHz || 140)} Hz, mid/high split ${Number(config.midCutoffHz || 2400)} Hz.`
        : "No preprocessing signals active yet.";
    }

    const aubioState = state.detectionEnabled || aubioTempo > 0 ? "active" : "idle";
    const essentiaState = state.detectionEnabled || essentiaTempo > 0 ? "active" : "idle";
    const fusionState = state.detectionEnabled && state.detectionSummary?.detectorMode === "fusion" ? "focus" : (state.detectionEnabled ? "active" : "idle");
    setNode(refs.wiringAubioNode, aubioTempo > 0 ? `${Math.round(aubioTempo)} BPM` : (state.aubioSummary?.statusLabel || "Idle"), state.detectionSummary?.detectorMode === "aubio" ? "focus" : aubioState);
    setNode(refs.wiringEssentiaNode, essentiaTempo > 0 ? `${Math.round(essentiaTempo)} BPM` : (state.essentiaSummary?.statusLabel || "Idle"), state.detectionSummary?.detectorMode === "essentia" ? "focus" : essentiaState);
    setNode(refs.wiringFusionNode, state.detectionEnabled ? `${detectorLabel} mode` : "Off", fusionState);

    setNode(refs.wiringClockNode, `${timingLabel} filter`, preprocessActive ? "focus" : "idle");
    setNode(refs.wiringPhaseNode, preprocessActive ? `Beat ${beatLabel} - phase ${phaseConfidence}%` : "Waiting", preprocessActive ? "active" : "idle");
    setNode(refs.wiringStructureNode, structureLabel, state.songAnalysisRunning || state.currentSongAnalysis ? "active" : "idle");
    if (refs.wiringClockSummary) {
      refs.wiringClockSummary.textContent = preprocessActive
        ? `JamPal's adaptive grid core is inspired by Mixxx-style beatgrid coordinates: local BPM, offset, and beat/bar phase. ${timingLabel} runs after detector evidence is collected, not inside preprocessing. Current grid ${Number(state.detectionSummary?.tempo || 0) > 0 ? `${Math.round(Number(state.detectionSummary.tempo))} BPM` : "waiting"}, lock ${lock}%, beat ${beatLabel}, loop ${loopLabel}. Offline truth can be refined separately through Essentia, librosa, and madmom-style analysis.`
        : "JamPal builds an adaptive beatgrid from detector evidence, then Kalman or Particle stabilizes tempo, beat phase, and bar loop.";
    }

    setNode(refs.wiringFeedbackNode, feedbackLabel, state.jammerEnabled ? "active" : "idle");
    setNode(refs.wiringDrummerNode, state.jammerEnabled ? "Following grid" : "Standby", state.jammerEnabled ? "focus" : "idle");
    setNode(refs.wiringVisualNode, state.visualizerEnabled ? "Stage on" : "Stage off", state.visualizerEnabled ? "active" : "idle");
    setNode(refs.wiringRecorderNode, state.recordingActive ? "Capturing" : "Idle", state.recordingActive ? "focus" : "idle");

    setChip(refs.wiringStudioChip, state.activePanel === "studio" ? "Active" : "Ready", state.activePanel === "studio" ? "focus" : "idle");
    setChip(refs.wiringJammerChip, state.activePanel === "jammer" ? "Active" : "Ready", state.activePanel === "jammer" ? "focus" : "idle");
    setChip(refs.wiringSettingsChip, state.activePanel === "settings" ? "Active" : "Ready", state.activePanel === "settings" ? "focus" : "idle");
    setChip(refs.wiringDetectionChip, state.detectionEnabled ? `${detectorLabel} on` : "Off", state.detectionEnabled ? "active" : "idle");
    setChip(refs.wiringExperimentChip, state.detectionExperimentActive ? `${config.pluginMode === "aubio" ? "Aubio" : "Essentia"} tuned` : "Idle", state.detectionExperimentActive ? "active" : "idle");
    setChip(refs.wiringLabChip, state.jammerLabOpen ? "Open" : "Closed", state.jammerLabOpen ? "active" : "idle");

    if (refs.wiringPanelToggleButton) {
      const collapsed = Boolean(state.wiringPanelCollapsed);
      refs.wiringPanelToggleButton.classList.toggle("active", !collapsed);
      refs.wiringPanelToggleButton.setAttribute("aria-expanded", String(!collapsed));
      refs.wiringPanelToggleButton.setAttribute("aria-label", collapsed ? "Expand wiring" : "Collapse wiring");
      refs.wiringPanelToggleButton.title = collapsed ? "Expand wiring" : "Collapse wiring";
    }
    if (refs.wiringPanelBody) {
      refs.wiringPanelBody.classList.toggle("hidden", Boolean(state.wiringPanelCollapsed));
    }
  }

  return {
    updateWiringPanel,
  };
}
