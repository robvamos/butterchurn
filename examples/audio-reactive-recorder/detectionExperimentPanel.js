export function renderDetectionExperimentPanel() {
  return `
    <div class="jammer-detection-section-head">
      <div class="jammer-detection-headline">
        <div class="jammer-detection-subtitle">Detection Experiment</div>
        <div id="jammerDetectionExperimentPanelStatus" class="jammer-panel-status">Idle</div>
      </div>
      <button
        id="jammerDetectionExperimentToggleButton"
        class="jammer-icon-toggle jammer-section-toggle"
        type="button"
        aria-label="Collapse detection experiment"
        aria-expanded="true"
        title="Collapse detection experiment"
      >
        <span class="jammer-section-toggle-glyph" aria-hidden="true">▾</span>
      </button>
    </div>
    <div id="jammerDetectionExperimentPanelBody" class="jammer-detection-analysis-card">
      <div class="jammer-detection-meta">
        This panel shapes the input before BPM analysis. Here you tune a dedicated preprocessing profile for the selected detector lane (Aubio or Essentia): normalization, low/mid/high frequency split, source amplitude, tonal-change cues, and lane-specific bias before the main detection model takes over.
      </div>
      <div class="jammer-detection-experiment-topbar">
      <div class="jammer-detection-experiment-topline primary">
        <div class="jammer-detection-stat">
          <div class="jammer-detection-label" title="Choose which detector lane receives this experimental filtered input. This panel tunes the raw lane before the main Kalman or Particle clock model in Detection.">Experiment Lane</div>
          <select id="jammerDetectionExperimentPluginSelect" class="jammer-inline-select" aria-label="Detection experiment lane" title="Aubio reacts more to transient hits. Essentia gives more weight to stable ticks and structure.">
            <option value="essentia">Essentia lane</option>
            <option value="aubio">Aubio lane</option>
          </select>
        </div>
        <div class="jammer-detection-stat">
          <div class="jammer-detection-label">Estimated BPM</div>
          <div id="jammerDetectionExperimentTempo" class="jammer-detection-value">0 BPM</div>
        </div>
        <div class="jammer-detection-stat">
          <div class="jammer-detection-label">Lock</div>
          <div id="jammerDetectionExperimentConfidence" class="jammer-detection-value">0%</div>
        </div>
        <div class="jammer-detection-stat">
          <div class="jammer-detection-label">Weighted Pulse</div>
          <div id="jammerDetectionExperimentPulse" class="jammer-detection-value">0%</div>
        </div>
        <div class="jammer-detection-stat">
          <div class="jammer-detection-label">Beat Phase</div>
          <div id="jammerDetectionExperimentBeatPhase" class="jammer-detection-value">0 / 4</div>
        </div>
        <div class="jammer-detection-stat">
          <div class="jammer-detection-label">Loop Bar</div>
          <div id="jammerDetectionExperimentLoopBar" class="jammer-detection-value">0 / 4</div>
        </div>
        <div class="jammer-detection-stat">
          <div class="jammer-detection-label">Chart Window</div>
          <div class="jammer-experiment-window-control">
            <button
              id="jammerDetectionExperimentWindowDownButton"
              class="jammer-mini-stepper"
              type="button"
              aria-label="Decrease chart time window"
              title="Show a shorter time range"
            >
              -
            </button>
            <div id="jammerDetectionExperimentWindowLabel" class="jammer-detection-value jammer-experiment-window-value">8.0 s</div>
            <button
              id="jammerDetectionExperimentWindowUpButton"
              class="jammer-mini-stepper"
              type="button"
              aria-label="Increase chart time window"
              title="Show a longer time range"
            >
              +
            </button>
          </div>
        </div>
      </div>
      <div class="jammer-detection-experiment-topline secondary">
        <div class="jammer-detection-stat">
          <div class="jammer-detection-label">Fast Window</div>
          <div id="jammerDetectionExperimentFastTempo" class="jammer-detection-value">0 BPM</div>
        </div>
        <div class="jammer-detection-stat">
          <div class="jammer-detection-label">Medium Window</div>
          <div id="jammerDetectionExperimentMediumTempo" class="jammer-detection-value">0 BPM</div>
        </div>
        <div class="jammer-detection-stat">
          <div class="jammer-detection-label">Long Window</div>
          <div id="jammerDetectionExperimentLongTempo" class="jammer-detection-value">0 BPM</div>
        </div>
        <div class="jammer-detection-stat">
          <div class="jammer-detection-label">Phase Lock</div>
          <div id="jammerDetectionExperimentPhaseLock" class="jammer-detection-value">0%</div>
        </div>
        <div class="jammer-detection-summary-stat jammer-detection-experiment-summary-stat">
          <div class="jammer-detection-label">Experiment Summary</div>
          <div id="jammerDetectionExperimentSummary" class="jammer-detection-value">Waiting for a live source.</div>
        </div>
      </div>
      <div class="jammer-detection-experiment-config-row">
        <div class="jammer-detection-summary-stat jammer-detection-experiment-config-stat">
          <div class="jammer-detection-label">Config Snapshot</div>
          <div id="jammerDetectionExperimentConfigSummary" class="jammer-detection-value">Essentia | mix and sweep ready</div>
        </div>
      </div>
      <div class="jammer-detection-experiment-config-row">
        <div class="jammer-detection-summary-stat jammer-detection-experiment-config-stat">
          <div class="jammer-detection-label">Understanding</div>
          <div id="jammerDetectionExperimentEvaluationSummary" class="jammer-detection-value">BPM chase listening | beat 1 idle | phase map unknown</div>
        </div>
      </div>
      </div>

      <div class="jammer-detection-experiment-chart-grid top">
        <div class="jammer-detection-chart-card">
          <div class="jammer-detection-chart-head"><span>Raw input</span><span id="jammerDetectionExperimentRawMeta">0%</span></div>
          <canvas id="jammerDetectionExperimentRawCanvas" width="520" height="78"></canvas>
        </div>
        <div class="jammer-detection-chart-card">
          <div class="jammer-detection-chart-head"><span>Low band</span><span id="jammerDetectionExperimentLowMeta">0%</span></div>
          <canvas id="jammerDetectionExperimentLowCanvas" width="520" height="78"></canvas>
        </div>
        <div class="jammer-detection-chart-card">
          <div class="jammer-detection-chart-head"><span>Mid band</span><span id="jammerDetectionExperimentMidMeta">0%</span></div>
          <canvas id="jammerDetectionExperimentMidCanvas" width="520" height="78"></canvas>
        </div>
        <div class="jammer-detection-chart-card">
          <div class="jammer-detection-chart-head"><span>High band</span><span id="jammerDetectionExperimentHighMeta">0%</span></div>
          <canvas id="jammerDetectionExperimentHighCanvas" width="520" height="78"></canvas>
        </div>
        <div class="jammer-detection-chart-card">
          <div class="jammer-detection-chart-head"><span>Tonal change</span><span id="jammerDetectionExperimentTonalMeta">0%</span></div>
          <canvas id="jammerDetectionExperimentTonalCanvas" width="520" height="78"></canvas>
        </div>
        <div class="jammer-detection-chart-card">
          <div class="jammer-detection-chart-head"><span>Weighted pulse</span><span id="jammerDetectionExperimentWeightedMeta">0%</span></div>
          <canvas id="jammerDetectionExperimentWeightedCanvas" width="520" height="78"></canvas>
        </div>
      </div>

      <div class="jammer-detection-experiment-grid compact">
        <div class="jammer-detection-experiment-section jammer-detection-experiment-preset-section">
          <div class="jammer-detection-label">Saved Setups</div>
          <div class="jammer-detection-meta">Save a whole preprocessing recipe and recall it later. The last values you used stay remembered automatically.</div>
          <div class="jammer-detection-experiment-controls setup">
            <label class="jammer-experiment-field">
              <span>Preset</span>
              <select id="jammerDetectionExperimentPresetSelect" class="jammer-inline-select" aria-label="Saved preprocessing setup">
                <option value="">Current setup only</option>
              </select>
            </label>
            <label class="jammer-experiment-field">
              <span>Name</span>
              <input id="jammerDetectionExperimentPresetName" type="text" maxlength="48" placeholder="Kick focus, calm mix...">
            </label>
            <button id="jammerDetectionExperimentSavePresetButton" class="jammer-compact-action" type="button">Save setup</button>
            <button id="jammerDetectionExperimentRenamePresetButton" class="jammer-compact-action" type="button">Rename</button>
            <button id="jammerDetectionExperimentLoadPresetButton" class="jammer-compact-action" type="button">Load setup</button>
            <button id="jammerDetectionExperimentDeletePresetButton" class="jammer-compact-action subtle" type="button">Delete</button>
          </div>
        </div>

        <div class="jammer-detection-experiment-section">
          <div class="jammer-detection-label">Preprocessing</div>
          <div class="jammer-detection-meta">This block prepares the raw audio before BPM detection: normalize level, then split the signal into low, mid, and high ranges.</div>
          <div class="jammer-detection-experiment-controls">
            <label class="jammer-experiment-toggle" title="Keeps loud and quiet material in a more comparable range so the detector is not fooled by volume alone.">
              <input id="jammerDetectionExperimentNormalizeEnabled" type="checkbox" checked>
              <span>Normalize input</span>
            </label>
            <label class="jammer-experiment-field" title="Target peak after normalization. Higher values push the signal closer to full scale.">
              <span>Target peak</span>
              <input id="jammerDetectionExperimentNormalizeTarget" type="number" min="0.4" max="1" step="0.01" value="0.94">
            </label>
            <label class="jammer-experiment-field" title="Lower edge of the low band. Frequencies below this are excluded from the low-range pulse analysis.">
              <span>Low band min (Hz)</span>
              <input id="jammerDetectionExperimentLowBandMin" type="number" min="20" max="200" step="5" value="35">
            </label>
            <label class="jammer-experiment-field" title="Upper edge of the low band. This is the cutoff used to isolate kick and low-end pulse content.">
              <span>Low band max (Hz)</span>
              <input id="jammerDetectionExperimentLowCutoff" type="number" min="40" max="600" step="5" value="140">
            </label>
            <label class="jammer-experiment-field" title="Split point between the mid and high ranges. Mid ends here, high starts above it.">
              <span>Mid/high split (Hz)</span>
              <input id="jammerDetectionExperimentMidCutoff" type="number" min="600" max="6000" step="25" value="2400">
            </label>
          </div>
        </div>

          <div class="jammer-detection-experiment-section">
          <div class="jammer-detection-label">Signal Weights</div>
          <div class="jammer-detection-meta">Enable or mute each lane before it reaches the detector, then decide how much source amplitude, low, mid, high, and tonal cues count in the final BPM pulse.</div>
          <div class="jammer-detection-lane-toggle-row">
            <label class="jammer-experiment-lane-toggle" title="Raw source amplitude before normalization. Useful when overall dynamics help point to the pulse.">
              <input id="jammerDetectionExperimentRawEnabled" type="checkbox" checked>
              <span>Raw Amp</span>
            </label>
            <label class="jammer-experiment-lane-toggle" title="Low band: kick drum, bass pulse, downbeat weight.">
              <input id="jammerDetectionExperimentLowEnabled" type="checkbox" checked>
              <span>Low</span>
            </label>
            <label class="jammer-experiment-lane-toggle" title="Mid band: snare, body, rhythmic articulation in the center of the mix.">
              <input id="jammerDetectionExperimentMidEnabled" type="checkbox" checked>
              <span>Mid</span>
            </label>
            <label class="jammer-experiment-lane-toggle" title="High band: hats, clicks, transient brightness, fine pulse detail.">
              <input id="jammerDetectionExperimentHighEnabled" type="checkbox" checked>
              <span>High</span>
            </label>
            <label class="jammer-experiment-lane-toggle" title="Tonal change: harmonic movement and section changes that can help indicate bar boundaries.">
              <input id="jammerDetectionExperimentTonalEnabled" type="checkbox" checked>
              <span>Tonal</span>
            </label>
            <button
              id="jammerDetectionExperimentSoloButton"
              class="jammer-compact-action jammer-experiment-solo-button"
              type="button"
              aria-pressed="false"
              title="Listen to the enabled low, mid, and high filter mix. Player output is muted while solo is active."
            >
              SOLO
            </button>
          </div>
          <div class="jammer-detection-experiment-controls weights">
            <label class="jammer-experiment-field" title="How strongly the unnormalized source amplitude contributes to the BPM pulse. Useful when dynamics themselves hint at the beat.">
              <span>Raw amp</span>
              <input id="jammerDetectionExperimentRawWeight" type="number" min="0" max="1.5" step="0.01" value="0.18">
            </label>
            <label class="jammer-experiment-field" title="How strongly the low band contributes to the BPM pulse. Higher values favor kick and downbeat energy.">
              <span>Low band</span>
              <input id="jammerDetectionExperimentLowWeight" type="number" min="0" max="1.5" step="0.01" value="0.48">
            </label>
            <label class="jammer-experiment-field" title="How strongly the mid band contributes to the BPM pulse. Useful for snare-led grooves.">
              <span>Mid band</span>
              <input id="jammerDetectionExperimentMidWeight" type="number" min="0" max="1.5" step="0.01" value="0.20">
            </label>
            <label class="jammer-experiment-field" title="How strongly the high band contributes to the BPM pulse. Useful for hat-driven material or sharper transients.">
              <span>High band</span>
              <input id="jammerDetectionExperimentHighWeight" type="number" min="0" max="1.5" step="0.01" value="0.16">
            </label>
            <label class="jammer-experiment-field" title="How much harmonic change influences the BPM pulse and bar anchoring.">
              <span>Tonal change</span>
              <input id="jammerDetectionExperimentTonalWeight" type="number" min="0" max="1.5" step="0.01" value="0.16">
            </label>
          </div>
        </div>

        <div class="jammer-detection-experiment-section">
          <div class="jammer-detection-label">Detector Range</div>
          <div class="jammer-detection-meta">This block defines how easily a pulse is accepted and the BPM range the experiment is allowed to search.</div>
          <div class="jammer-detection-experiment-controls">
            <label class="jammer-experiment-field" title="Minimum pulse strength required before a bump is treated as a rhythmic event. Higher values reject more weak hits.">
              <span>Onset gate</span>
              <input id="jammerDetectionExperimentOnsetThreshold" type="number" min="0.01" max="1" step="0.005" value="0.085">
            </label>
            <label class="jammer-experiment-field" title="Lowest BPM the experiment will consider while searching for tempo.">
              <span>Tempo floor</span>
              <input id="jammerDetectionExperimentTempoMin" type="number" min="40" max="160" step="1" value="70">
            </label>
            <label class="jammer-experiment-field" title="Highest BPM the experiment will consider while searching for tempo.">
              <span>Tempo ceiling</span>
              <input id="jammerDetectionExperimentTempoMax" type="number" min="80" max="220" step="1" value="180">
            </label>
          </div>
        </div>

        <div class="jammer-detection-experiment-section">
          <div class="jammer-detection-label">Plugin Bias</div>
          <div class="jammer-detection-meta">These weights shape how each detector lane interprets the preprocessed signal. Aubio leans on transients and low pulse; Essentia leans on stable ticks and harmonic anchors. The main Kalman or Particle clock is still applied later in the Detection panel.</div>
          <div class="jammer-detection-experiment-controls weights">
            <label class="jammer-experiment-field" title="Extra weight for sudden transient attacks in the Aubio lane. Higher values make Aubio react faster to sharp hits.">
              <span>Aubio transient</span>
              <input id="jammerDetectionExperimentAubioTransientBias" type="number" min="0" max="1.5" step="0.01" value="0.64">
            </label>
            <label class="jammer-experiment-field" title="Extra weight for low-band pulse in the Aubio lane. Higher values make Aubio trust the kick and low-end more.">
              <span>Aubio low pulse</span>
              <input id="jammerDetectionExperimentAubioLowBias" type="number" min="0" max="1.5" step="0.01" value="0.42">
            </label>
            <label class="jammer-experiment-field" title="Extra weight for stable repeated ticks in the Essentia lane. Higher values prefer a steadier clock over fast transients.">
              <span>Ess stable ticks</span>
              <input id="jammerDetectionExperimentEssentiaTickBias" type="number" min="0" max="1.5" step="0.01" value="0.46">
            </label>
            <label class="jammer-experiment-field" title="Extra weight for tonal and harmonic anchors in the Essentia lane. Useful when chord or section changes line up with bar changes.">
              <span>Ess harmonic anchor</span>
              <input id="jammerDetectionExperimentEssentiaHarmonicBias" type="number" min="0" max="1.5" step="0.01" value="0.26">
            </label>
          </div>
        </div>
      </div>

    </div>
  `;
}

export function getDetectionExperimentRefs(root = document) {
  return {
    jammerDetectionExperimentToggleButton: root.getElementById("jammerDetectionExperimentToggleButton"),
    jammerDetectionExperimentPanelStatus: root.getElementById("jammerDetectionExperimentPanelStatus"),
    jammerDetectionExperimentPanelBody: root.getElementById("jammerDetectionExperimentPanelBody"),
    jammerDetectionExperimentPluginSelect: root.getElementById("jammerDetectionExperimentPluginSelect"),
    jammerDetectionExperimentPresetSelect: root.getElementById("jammerDetectionExperimentPresetSelect"),
    jammerDetectionExperimentPresetName: root.getElementById("jammerDetectionExperimentPresetName"),
    jammerDetectionExperimentSavePresetButton: root.getElementById("jammerDetectionExperimentSavePresetButton"),
    jammerDetectionExperimentRenamePresetButton: root.getElementById("jammerDetectionExperimentRenamePresetButton"),
    jammerDetectionExperimentLoadPresetButton: root.getElementById("jammerDetectionExperimentLoadPresetButton"),
    jammerDetectionExperimentDeletePresetButton: root.getElementById("jammerDetectionExperimentDeletePresetButton"),
    jammerDetectionExperimentNormalizeEnabled: root.getElementById("jammerDetectionExperimentNormalizeEnabled"),
    jammerDetectionExperimentNormalizeTarget: root.getElementById("jammerDetectionExperimentNormalizeTarget"),
    jammerDetectionExperimentLowBandMin: root.getElementById("jammerDetectionExperimentLowBandMin"),
    jammerDetectionExperimentLowCutoff: root.getElementById("jammerDetectionExperimentLowCutoff"),
    jammerDetectionExperimentMidCutoff: root.getElementById("jammerDetectionExperimentMidCutoff"),
    jammerDetectionExperimentRawEnabled: root.getElementById("jammerDetectionExperimentRawEnabled"),
    jammerDetectionExperimentLowEnabled: root.getElementById("jammerDetectionExperimentLowEnabled"),
    jammerDetectionExperimentMidEnabled: root.getElementById("jammerDetectionExperimentMidEnabled"),
    jammerDetectionExperimentHighEnabled: root.getElementById("jammerDetectionExperimentHighEnabled"),
    jammerDetectionExperimentTonalEnabled: root.getElementById("jammerDetectionExperimentTonalEnabled"),
    jammerDetectionExperimentSoloButton: root.getElementById("jammerDetectionExperimentSoloButton"),
    jammerDetectionExperimentRawWeight: root.getElementById("jammerDetectionExperimentRawWeight"),
    jammerDetectionExperimentLowWeight: root.getElementById("jammerDetectionExperimentLowWeight"),
    jammerDetectionExperimentMidWeight: root.getElementById("jammerDetectionExperimentMidWeight"),
    jammerDetectionExperimentHighWeight: root.getElementById("jammerDetectionExperimentHighWeight"),
    jammerDetectionExperimentTonalWeight: root.getElementById("jammerDetectionExperimentTonalWeight"),
    jammerDetectionExperimentOnsetThreshold: root.getElementById("jammerDetectionExperimentOnsetThreshold"),
    jammerDetectionExperimentTempoMin: root.getElementById("jammerDetectionExperimentTempoMin"),
    jammerDetectionExperimentTempoMax: root.getElementById("jammerDetectionExperimentTempoMax"),
    jammerDetectionExperimentAubioTransientBias: root.getElementById("jammerDetectionExperimentAubioTransientBias"),
    jammerDetectionExperimentAubioLowBias: root.getElementById("jammerDetectionExperimentAubioLowBias"),
    jammerDetectionExperimentEssentiaTickBias: root.getElementById("jammerDetectionExperimentEssentiaTickBias"),
    jammerDetectionExperimentEssentiaHarmonicBias: root.getElementById("jammerDetectionExperimentEssentiaHarmonicBias"),
    jammerDetectionExperimentTempo: root.getElementById("jammerDetectionExperimentTempo"),
    jammerDetectionExperimentConfidence: root.getElementById("jammerDetectionExperimentConfidence"),
    jammerDetectionExperimentPulse: root.getElementById("jammerDetectionExperimentPulse"),
    jammerDetectionExperimentBeatPhase: root.getElementById("jammerDetectionExperimentBeatPhase"),
    jammerDetectionExperimentLoopBar: root.getElementById("jammerDetectionExperimentLoopBar"),
    jammerDetectionExperimentWindowDownButton: root.getElementById("jammerDetectionExperimentWindowDownButton"),
    jammerDetectionExperimentWindowLabel: root.getElementById("jammerDetectionExperimentWindowLabel"),
    jammerDetectionExperimentWindowUpButton: root.getElementById("jammerDetectionExperimentWindowUpButton"),
    jammerDetectionExperimentSummary: root.getElementById("jammerDetectionExperimentSummary"),
    jammerDetectionExperimentConfigSummary: root.getElementById("jammerDetectionExperimentConfigSummary"),
    jammerDetectionExperimentEvaluationSummary: root.getElementById("jammerDetectionExperimentEvaluationSummary"),
    jammerDetectionExperimentFastTempo: root.getElementById("jammerDetectionExperimentFastTempo"),
    jammerDetectionExperimentMediumTempo: root.getElementById("jammerDetectionExperimentMediumTempo"),
    jammerDetectionExperimentLongTempo: root.getElementById("jammerDetectionExperimentLongTempo"),
    jammerDetectionExperimentPhaseLock: root.getElementById("jammerDetectionExperimentPhaseLock"),
    jammerDetectionExperimentRawCanvas: root.getElementById("jammerDetectionExperimentRawCanvas"),
    jammerDetectionExperimentLowCanvas: root.getElementById("jammerDetectionExperimentLowCanvas"),
    jammerDetectionExperimentMidCanvas: root.getElementById("jammerDetectionExperimentMidCanvas"),
    jammerDetectionExperimentHighCanvas: root.getElementById("jammerDetectionExperimentHighCanvas"),
    jammerDetectionExperimentTonalCanvas: root.getElementById("jammerDetectionExperimentTonalCanvas"),
    jammerDetectionExperimentWeightedCanvas: root.getElementById("jammerDetectionExperimentWeightedCanvas"),
    jammerDetectionExperimentRawMeta: root.getElementById("jammerDetectionExperimentRawMeta"),
    jammerDetectionExperimentLowMeta: root.getElementById("jammerDetectionExperimentLowMeta"),
    jammerDetectionExperimentMidMeta: root.getElementById("jammerDetectionExperimentMidMeta"),
    jammerDetectionExperimentHighMeta: root.getElementById("jammerDetectionExperimentHighMeta"),
    jammerDetectionExperimentTonalMeta: root.getElementById("jammerDetectionExperimentTonalMeta"),
    jammerDetectionExperimentWeightedMeta: root.getElementById("jammerDetectionExperimentWeightedMeta"),
  };
}
