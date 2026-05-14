export function renderDetectorCalibrationPanel() {
  return `
    <div class="jammer-detection-section-head">
      <div class="jammer-detection-headline">
        <div class="jammer-detection-subtitle">Detector Calibration</div>
        <div id="jammerCalibrationPanelStatus" class="jammer-panel-status">Idle</div>
      </div>
      <button
        id="jammerCalibrationToggleButton"
        class="jammer-icon-toggle jammer-section-toggle"
        type="button"
        aria-label="Collapse detector calibration"
        aria-expanded="true"
        title="Collapse detector calibration"
      >
        <span class="jammer-section-toggle-glyph" aria-hidden="true">▾</span>
      </button>
    </div>
    <div id="jammerCalibrationPanelBody" class="jammer-detection-analysis-card">
      <div class="jammer-detection-calibration-top">
        <div class="jammer-detection-stat">
          <div class="jammer-detection-label">Track Reference</div>
          <select id="jammerCalibrationTrackSelect" class="jammer-inline-select" aria-label="Calibration track">
            <option value="">Choose a player track</option>
          </select>
        </div>
        <div class="jammer-detection-calibration-actions">
          <button id="jammerSongAnalyzeButton" class="jammer-inline-action" type="button">Analyze Full File</button>
          <button id="jammerCalibrationRunTestButton" class="jammer-inline-action" type="button">Start Playback Test</button>
        </div>
      </div>
      <div class="jammer-detection-summary-stat">
        <div class="jammer-detection-label">Status</div>
        <div id="jammerSongAnalysisStatus" class="jammer-detection-value">No analysis yet</div>
      </div>
      <div class="jammer-detection-meter">
        <div class="jammer-detection-meter-head">
          <span class="jammer-detection-meter-label">Analysis Progress</span>
          <span id="jammerCalibrationProgressValue" class="jammer-detection-meter-value">0%</span>
        </div>
        <div class="jammer-detection-meter-bar"><div id="jammerCalibrationProgressFill" class="jammer-detection-meter-fill"></div></div>
      </div>
      <div class="jammer-detection-calibration-grid">
        <div class="jammer-detection-stat">
          <div class="jammer-detection-label">Reference Tempo</div>
          <div id="jammerSongAnalysisTempo" class="jammer-detection-value">0 BPM</div>
        </div>
        <div class="jammer-detection-stat">
          <div class="jammer-detection-label">Bars</div>
          <div id="jammerSongAnalysisBars" class="jammer-detection-value">0</div>
        </div>
        <div class="jammer-detection-stat">
          <div class="jammer-detection-label">Phrase</div>
          <div id="jammerSongAnalysisPhrase" class="jammer-detection-value">0 bars</div>
        </div>
        <div class="jammer-detection-stat">
          <div class="jammer-detection-label">Form</div>
          <div id="jammerSongAnalysisForm" class="jammer-detection-value">Unknown</div>
        </div>
        <div class="jammer-detection-stat">
          <div class="jammer-detection-label">Test Score</div>
          <div id="jammerCalibrationScore" class="jammer-detection-value">0 / 100</div>
        </div>
        <div class="jammer-detection-stat">
          <div class="jammer-detection-label">Suggested Module</div>
          <div id="jammerCalibrationSuggestedModule" class="jammer-detection-value">Waiting</div>
        </div>
        <div class="jammer-detection-stat">
          <div class="jammer-detection-label">Suggested Timing</div>
          <div id="jammerCalibrationSuggestedTiming" class="jammer-detection-value">Waiting</div>
        </div>
      </div>
      <div class="jammer-detection-summary-stat">
        <div class="jammer-detection-label">Reference Summary</div>
        <div id="jammerSongAnalysisSummary" class="jammer-detection-value">Load or choose a track, then analyze the full file.</div>
      </div>
      <div class="jammer-detection-calibration-grid compact">
        <div class="jammer-detection-stat">
          <div class="jammer-detection-label">Test Mode</div>
          <div id="jammerCalibrationTestMode" class="jammer-detection-value">Aubio + Essentia side by side</div>
        </div>
        <div class="jammer-detection-stat">
          <div class="jammer-detection-label">Samples</div>
          <div id="jammerCalibrationSamples" class="jammer-detection-value">0</div>
        </div>
        <div class="jammer-detection-stat">
          <div class="jammer-detection-label">Avg Tempo Delta</div>
          <div id="jammerCalibrationTempoDelta" class="jammer-detection-value">0 BPM</div>
        </div>
      </div>
      <div class="jammer-detection-summary-stat">
        <div class="jammer-detection-label">Playback Test</div>
        <div id="jammerSongAnalysisCompare" class="jammer-detection-value">No plugin comparison yet.</div>
      </div>
      <ul id="jammerSongAnalysisRecommendations" class="jammer-favorite-list compact"></ul>
      <div class="jammer-detection-calibration-grid compact module-cards">
        <div class="jammer-detection-stat module-card">
          <div class="jammer-detection-label">Aubio Rating</div>
          <div id="jammerCalibrationAubioScore" class="jammer-detection-value">0 / 100</div>
          <div id="jammerCalibrationAubioMeta" class="jammer-detection-meta">No test yet</div>
          <ul id="jammerCalibrationAubioSuggestions" class="jammer-favorite-list compact"></ul>
          <div class="jammer-detection-calibration-actions module-actions">
            <label class="checkbox-row jammer-inline-checkbox" for="jammerCalibrationApplyAubioCheckbox">
              <input id="jammerCalibrationApplyAubioCheckbox" type="checkbox">
              <span>Apply suggestions</span>
            </label>
            <button id="jammerCalibrationRetestAubioButton" class="jammer-inline-action" type="button">Repeat Aubio Test</button>
          </div>
          <div id="jammerCalibrationAubioHistorySummary" class="jammer-detection-meta">No Aubio history yet.</div>
          <ul id="jammerCalibrationAubioHistoryList" class="jammer-favorite-list compact"></ul>
        </div>
        <div class="jammer-detection-stat module-card">
          <div class="jammer-detection-label">Essentia Rating</div>
          <div id="jammerCalibrationEssentiaScore" class="jammer-detection-value">0 / 100</div>
          <div id="jammerCalibrationEssentiaMeta" class="jammer-detection-meta">No test yet</div>
          <ul id="jammerCalibrationEssentiaSuggestions" class="jammer-favorite-list compact"></ul>
          <div class="jammer-detection-calibration-actions module-actions">
            <label class="checkbox-row jammer-inline-checkbox" for="jammerCalibrationApplyEssentiaCheckbox">
              <input id="jammerCalibrationApplyEssentiaCheckbox" type="checkbox">
              <span>Apply suggestions</span>
            </label>
            <button id="jammerCalibrationRetestEssentiaButton" class="jammer-inline-action" type="button">Repeat Essentia Test</button>
          </div>
          <div id="jammerCalibrationEssentiaHistorySummary" class="jammer-detection-meta">No Essentia history yet.</div>
          <ul id="jammerCalibrationEssentiaHistoryList" class="jammer-favorite-list compact"></ul>
        </div>
      </div>
      <div class="jammer-detection-calibration-actions module-actions wide">
        <button id="jammerCalibrationRepeatSelectedButton" class="jammer-inline-action" type="button">Repeat Selected Tests</button>
      </div>
      <div class="jammer-detection-summary-stat">
        <div class="jammer-detection-label">Test History</div>
        <div id="jammerCalibrationHistorySummary" class="jammer-detection-value">No tests saved yet.</div>
      </div>
      <ul id="jammerCalibrationHistoryList" class="jammer-favorite-list compact"></ul>
    </div>
  `;
}

export function getDetectorCalibrationRefs(root = document) {
  return {
    jammerCalibrationToggleButton: root.getElementById("jammerCalibrationToggleButton"),
    jammerCalibrationPanelStatus: root.getElementById("jammerCalibrationPanelStatus"),
    jammerCalibrationPanelBody: root.getElementById("jammerCalibrationPanelBody"),
    jammerSongAnalyzeButton: root.getElementById("jammerSongAnalyzeButton"),
    jammerCalibrationTrackSelect: root.getElementById("jammerCalibrationTrackSelect"),
    jammerCalibrationRunTestButton: root.getElementById("jammerCalibrationRunTestButton"),
    jammerCalibrationProgressValue: root.getElementById("jammerCalibrationProgressValue"),
    jammerCalibrationProgressFill: root.getElementById("jammerCalibrationProgressFill"),
    jammerSongAnalysisStatus: root.getElementById("jammerSongAnalysisStatus"),
    jammerSongAnalysisTempo: root.getElementById("jammerSongAnalysisTempo"),
    jammerSongAnalysisBars: root.getElementById("jammerSongAnalysisBars"),
    jammerSongAnalysisPhrase: root.getElementById("jammerSongAnalysisPhrase"),
    jammerSongAnalysisForm: root.getElementById("jammerSongAnalysisForm"),
    jammerCalibrationScore: root.getElementById("jammerCalibrationScore"),
    jammerCalibrationTestMode: root.getElementById("jammerCalibrationTestMode"),
    jammerCalibrationSamples: root.getElementById("jammerCalibrationSamples"),
    jammerCalibrationTempoDelta: root.getElementById("jammerCalibrationTempoDelta"),
    jammerCalibrationSuggestedModule: root.getElementById("jammerCalibrationSuggestedModule"),
    jammerCalibrationSuggestedTiming: root.getElementById("jammerCalibrationSuggestedTiming"),
    jammerSongAnalysisSummary: root.getElementById("jammerSongAnalysisSummary"),
    jammerSongAnalysisCompare: root.getElementById("jammerSongAnalysisCompare"),
    jammerSongAnalysisRecommendations: root.getElementById("jammerSongAnalysisRecommendations"),
    jammerCalibrationAubioScore: root.getElementById("jammerCalibrationAubioScore"),
    jammerCalibrationAubioMeta: root.getElementById("jammerCalibrationAubioMeta"),
    jammerCalibrationAubioSuggestions: root.getElementById("jammerCalibrationAubioSuggestions"),
    jammerCalibrationApplyAubioCheckbox: root.getElementById("jammerCalibrationApplyAubioCheckbox"),
    jammerCalibrationRetestAubioButton: root.getElementById("jammerCalibrationRetestAubioButton"),
    jammerCalibrationAubioHistorySummary: root.getElementById("jammerCalibrationAubioHistorySummary"),
    jammerCalibrationAubioHistoryList: root.getElementById("jammerCalibrationAubioHistoryList"),
    jammerCalibrationEssentiaScore: root.getElementById("jammerCalibrationEssentiaScore"),
    jammerCalibrationEssentiaMeta: root.getElementById("jammerCalibrationEssentiaMeta"),
    jammerCalibrationEssentiaSuggestions: root.getElementById("jammerCalibrationEssentiaSuggestions"),
    jammerCalibrationApplyEssentiaCheckbox: root.getElementById("jammerCalibrationApplyEssentiaCheckbox"),
    jammerCalibrationRetestEssentiaButton: root.getElementById("jammerCalibrationRetestEssentiaButton"),
    jammerCalibrationEssentiaHistorySummary: root.getElementById("jammerCalibrationEssentiaHistorySummary"),
    jammerCalibrationEssentiaHistoryList: root.getElementById("jammerCalibrationEssentiaHistoryList"),
    jammerCalibrationRepeatSelectedButton: root.getElementById("jammerCalibrationRepeatSelectedButton"),
    jammerCalibrationHistorySummary: root.getElementById("jammerCalibrationHistorySummary"),
    jammerCalibrationHistoryList: root.getElementById("jammerCalibrationHistoryList"),
  };
}
