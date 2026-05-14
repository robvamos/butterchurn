export function renderBpmBenchmarkPanel() {
  return `
    <div class="jammer-detection-section-head">
      <div class="jammer-detection-headline">
        <div class="jammer-detection-subtitle">BPM Benchmark</div>
        <div id="jammerBpmBenchmarkPanelStatus" class="jammer-panel-status">Idle</div>
      </div>
      <button
        id="jammerBpmBenchmarkToggleButton"
        class="jammer-icon-toggle jammer-section-toggle"
        type="button"
        aria-label="Collapse BPM benchmark"
        aria-expanded="true"
        title="Collapse BPM benchmark"
      >
        <span class="jammer-section-toggle-glyph" aria-hidden="true">▾</span>
      </button>
    </div>
    <div id="jammerBpmBenchmarkPanelBody" class="jammer-detection-analysis-card">
      <div class="jammer-detection-calibration-top">
        <div class="jammer-detection-stat">
          <div class="jammer-detection-label">Known BPM Files</div>
          <select id="jammerBpmBenchmarkTrackSelect" class="jammer-inline-select jammer-inline-multiselect" aria-label="BPM benchmark tracks" multiple size="6">
            <option value="">Choose one or more benchmark files</option>
          </select>
        </div>
        <div class="jammer-detection-calibration-actions">
          <button id="jammerBpmBenchmarkReloadButton" class="jammer-inline-action" type="button">Reload Files</button>
          <button id="jammerBpmBenchmarkRunButton" class="jammer-inline-action" type="button">Run Benchmark</button>
        </div>
      </div>
      <div class="jammer-detection-summary-stat">
        <div class="jammer-detection-label">Status</div>
        <div id="jammerBpmBenchmarkStatus" class="jammer-detection-value">No benchmark yet</div>
      </div>
      <div class="jammer-detection-summary-stat">
        <div class="jammer-detection-label">Selection</div>
        <div id="jammerBpmBenchmarkSelectionSummary" class="jammer-detection-value">No benchmark files selected</div>
      </div>
      <div class="jammer-detection-meter">
        <div class="jammer-detection-meter-head">
          <span class="jammer-detection-meter-label">Benchmark Progress</span>
          <span id="jammerBpmBenchmarkProgressValue" class="jammer-detection-meter-value">0%</span>
        </div>
        <div class="jammer-detection-meter-bar"><div id="jammerBpmBenchmarkProgressFill" class="jammer-detection-meter-fill"></div></div>
      </div>
      <div class="jammer-detection-calibration-grid compact">
        <div class="jammer-detection-stat">
          <div class="jammer-detection-label">Known BPM</div>
          <div id="jammerBpmBenchmarkKnownTempo" class="jammer-detection-value">0 BPM</div>
        </div>
        <div class="jammer-detection-stat">
          <div class="jammer-detection-label">Offline Scan</div>
          <div id="jammerBpmBenchmarkReferenceTempo" class="jammer-detection-value">0 BPM</div>
        </div>
        <div class="jammer-detection-stat">
          <div class="jammer-detection-label">Bars</div>
          <div id="jammerBpmBenchmarkBars" class="jammer-detection-value">0</div>
        </div>
        <div class="jammer-detection-stat">
          <div class="jammer-detection-label">Phrase</div>
          <div id="jammerBpmBenchmarkPhrase" class="jammer-detection-value">0 bars</div>
        </div>
      </div>
      <div class="jammer-detection-summary-stat">
        <div class="jammer-detection-label">Reference Summary</div>
        <div id="jammerBpmBenchmarkSummary" class="jammer-detection-value">Choose a file from BPMtest to compare the plugins against a declared BPM.</div>
      </div>
      <div class="jammer-detection-calibration-grid compact module-cards">
        <div class="jammer-detection-stat module-card">
          <div class="jammer-detection-label">Aubio Benchmark</div>
          <div id="jammerBpmBenchmarkAubioScore" class="jammer-detection-value">0 / 100</div>
          <div id="jammerBpmBenchmarkAubioMeta" class="jammer-detection-meta">No Aubio benchmark yet</div>
          <ul id="jammerBpmBenchmarkAubioSuggestions" class="jammer-favorite-list compact"></ul>
          <div class="jammer-detection-calibration-actions module-actions">
            <label class="checkbox-row jammer-inline-checkbox" for="jammerBpmBenchmarkApplyAubioCheckbox">
              <input id="jammerBpmBenchmarkApplyAubioCheckbox" type="checkbox">
              <span>Apply suggestions</span>
            </label>
            <button id="jammerBpmBenchmarkRetestAubioButton" class="jammer-inline-action" type="button">Retest Aubio</button>
            <button id="jammerBpmBenchmarkEvolveAubioButton" class="jammer-inline-action" type="button">Evolve x10</button>
          </div>
          <div id="jammerBpmBenchmarkAubioHistorySummary" class="jammer-detection-meta">No Aubio benchmark history yet.</div>
          <ul id="jammerBpmBenchmarkAubioHistoryList" class="jammer-favorite-list compact"></ul>
        </div>
        <div class="jammer-detection-stat module-card">
          <div class="jammer-detection-label">Essentia Benchmark</div>
          <div id="jammerBpmBenchmarkEssentiaScore" class="jammer-detection-value">0 / 100</div>
          <div id="jammerBpmBenchmarkEssentiaMeta" class="jammer-detection-meta">No Essentia benchmark yet</div>
          <ul id="jammerBpmBenchmarkEssentiaSuggestions" class="jammer-favorite-list compact"></ul>
          <div class="jammer-detection-calibration-actions module-actions">
            <label class="checkbox-row jammer-inline-checkbox" for="jammerBpmBenchmarkApplyEssentiaCheckbox">
              <input id="jammerBpmBenchmarkApplyEssentiaCheckbox" type="checkbox">
              <span>Apply suggestions</span>
            </label>
            <button id="jammerBpmBenchmarkRetestEssentiaButton" class="jammer-inline-action" type="button">Retest Essentia</button>
            <button id="jammerBpmBenchmarkEvolveEssentiaButton" class="jammer-inline-action" type="button">Evolve x10</button>
          </div>
          <div id="jammerBpmBenchmarkEssentiaHistorySummary" class="jammer-detection-meta">No Essentia benchmark history yet.</div>
          <ul id="jammerBpmBenchmarkEssentiaHistoryList" class="jammer-favorite-list compact"></ul>
        </div>
      </div>
      <div class="jammer-detection-calibration-actions module-actions wide">
        <button id="jammerBpmBenchmarkRepeatSelectedButton" class="jammer-inline-action" type="button">Retest Selected</button>
      </div>
      <div class="jammer-detection-summary-stat">
        <div class="jammer-detection-label">Benchmark History</div>
        <div id="jammerBpmBenchmarkHistorySummary" class="jammer-detection-value">No benchmark history yet.</div>
      </div>
      <ul id="jammerBpmBenchmarkHistoryList" class="jammer-favorite-list compact"></ul>
    </div>
  `;
}

export function getBpmBenchmarkRefs(root = document) {
  return {
    jammerBpmBenchmarkToggleButton: root.getElementById("jammerBpmBenchmarkToggleButton"),
    jammerBpmBenchmarkPanelStatus: root.getElementById("jammerBpmBenchmarkPanelStatus"),
    jammerBpmBenchmarkPanelBody: root.getElementById("jammerBpmBenchmarkPanelBody"),
    jammerBpmBenchmarkTrackSelect: root.getElementById("jammerBpmBenchmarkTrackSelect"),
    jammerBpmBenchmarkReloadButton: root.getElementById("jammerBpmBenchmarkReloadButton"),
    jammerBpmBenchmarkRunButton: root.getElementById("jammerBpmBenchmarkRunButton"),
    jammerBpmBenchmarkStatus: root.getElementById("jammerBpmBenchmarkStatus"),
    jammerBpmBenchmarkSelectionSummary: root.getElementById("jammerBpmBenchmarkSelectionSummary"),
    jammerBpmBenchmarkProgressValue: root.getElementById("jammerBpmBenchmarkProgressValue"),
    jammerBpmBenchmarkProgressFill: root.getElementById("jammerBpmBenchmarkProgressFill"),
    jammerBpmBenchmarkKnownTempo: root.getElementById("jammerBpmBenchmarkKnownTempo"),
    jammerBpmBenchmarkReferenceTempo: root.getElementById("jammerBpmBenchmarkReferenceTempo"),
    jammerBpmBenchmarkBars: root.getElementById("jammerBpmBenchmarkBars"),
    jammerBpmBenchmarkPhrase: root.getElementById("jammerBpmBenchmarkPhrase"),
    jammerBpmBenchmarkSummary: root.getElementById("jammerBpmBenchmarkSummary"),
    jammerBpmBenchmarkAubioScore: root.getElementById("jammerBpmBenchmarkAubioScore"),
    jammerBpmBenchmarkAubioMeta: root.getElementById("jammerBpmBenchmarkAubioMeta"),
    jammerBpmBenchmarkAubioSuggestions: root.getElementById("jammerBpmBenchmarkAubioSuggestions"),
    jammerBpmBenchmarkApplyAubioCheckbox: root.getElementById("jammerBpmBenchmarkApplyAubioCheckbox"),
    jammerBpmBenchmarkRetestAubioButton: root.getElementById("jammerBpmBenchmarkRetestAubioButton"),
    jammerBpmBenchmarkEvolveAubioButton: root.getElementById("jammerBpmBenchmarkEvolveAubioButton"),
    jammerBpmBenchmarkAubioHistorySummary: root.getElementById("jammerBpmBenchmarkAubioHistorySummary"),
    jammerBpmBenchmarkAubioHistoryList: root.getElementById("jammerBpmBenchmarkAubioHistoryList"),
    jammerBpmBenchmarkEssentiaScore: root.getElementById("jammerBpmBenchmarkEssentiaScore"),
    jammerBpmBenchmarkEssentiaMeta: root.getElementById("jammerBpmBenchmarkEssentiaMeta"),
    jammerBpmBenchmarkEssentiaSuggestions: root.getElementById("jammerBpmBenchmarkEssentiaSuggestions"),
    jammerBpmBenchmarkApplyEssentiaCheckbox: root.getElementById("jammerBpmBenchmarkApplyEssentiaCheckbox"),
    jammerBpmBenchmarkRetestEssentiaButton: root.getElementById("jammerBpmBenchmarkRetestEssentiaButton"),
    jammerBpmBenchmarkEvolveEssentiaButton: root.getElementById("jammerBpmBenchmarkEvolveEssentiaButton"),
    jammerBpmBenchmarkEssentiaHistorySummary: root.getElementById("jammerBpmBenchmarkEssentiaHistorySummary"),
    jammerBpmBenchmarkEssentiaHistoryList: root.getElementById("jammerBpmBenchmarkEssentiaHistoryList"),
    jammerBpmBenchmarkRepeatSelectedButton: root.getElementById("jammerBpmBenchmarkRepeatSelectedButton"),
    jammerBpmBenchmarkHistorySummary: root.getElementById("jammerBpmBenchmarkHistorySummary"),
    jammerBpmBenchmarkHistoryList: root.getElementById("jammerBpmBenchmarkHistoryList"),
  };
}
