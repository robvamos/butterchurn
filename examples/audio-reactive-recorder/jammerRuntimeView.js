export function createJammerRuntimeView({ refs, getState, formatters }) {
  const {
    formatMonitorDelta,
    formatPhaseLabel,
    formatSectionLabel,
    formatSignedValue,
  } = formatters;

  function setMonitorMetric(valueElement, fillElement, value, max, suffix = "") {
    const safeValue = Math.max(0, Math.min(max, Number(value || 0)));
    valueElement.textContent = `${Math.round(safeValue)}${suffix}`;
    fillElement.style.width = `${(safeValue / max) * 100}%`;
  }

  function roleMatchesStep(stepEvents, role) {
    if (role === "snare") {
      return stepEvents.includes("snare") || stepEvents.includes("ghost-snare");
    }

    return stepEvents.includes(role);
  }

  function renderStageLoopRhythm(loopState) {
    refs.stageLoopRhythm.innerHTML = "";

    if (!loopState.active || !Array.isArray(loopState.loopSteps) || loopState.loopSteps.length === 0) {
      const empty = document.createElement("div");
      empty.className = "stage-loop-card-value";
      empty.textContent = "No rhythm map yet";
      refs.stageLoopRhythm.appendChild(empty);
      return;
    }

    const totalSteps = loopState.loopSteps.length;
    const totalBars = Math.max(1, Number(loopState.totalBars || Math.ceil(totalSteps / 16) || 1));

    ["kick", "snare", "hat", "perc"].forEach((role) => {
      const row = document.createElement("div");
      row.className = "stage-loop-rhythm-row";
      row.style.gridTemplateColumns = `42px repeat(${totalSteps}, minmax(0, 1fr))`;

      const label = document.createElement("div");
      label.className = "stage-loop-rhythm-label";
      label.textContent = role === "perc" ? "Perc" : role.charAt(0).toUpperCase() + role.slice(1);
      row.appendChild(label);

      for (let index = 0; index < totalSteps; index += 1) {
        const cell = document.createElement("div");
        const stepEvents = loopState.loopSteps[index] || [];
        cell.className = "stage-loop-step";
        if (roleMatchesStep(stepEvents, role)) {
          cell.classList.add("active");
        }
        if (index % 16 === 0) {
          cell.classList.add("bar-edge");
        }
        if ((loopState.currentStep - 1) === index) {
          cell.classList.add("current");
        }
        const barNumber = Math.floor(index / 16) + 1;
        const stepInBar = (index % 16) + 1;
        cell.title = `Bar ${barNumber}/${totalBars} - Step ${stepInBar}`;
        row.appendChild(cell);
      }

      refs.stageLoopRhythm.appendChild(row);
    });
  }

  function renderStageLoopDeck(deckSnapshot) {
    const activeDeck = deckSnapshot.filter((entry) => entry.enabled);
    refs.stageLoopDeckList.innerHTML = "";
    refs.stageLoopDeck.textContent = activeDeck.length > 0
      ? activeDeck.map((entry) => entry.name).join(" - ")
      : "No active instruments";

    if (activeDeck.length === 0) {
      return;
    }

    activeDeck.slice(0, 8).forEach((entry) => {
      const chip = document.createElement("div");
      chip.className = "stage-loop-chip";
      chip.textContent = `${entry.role}: ${entry.name}`;
      refs.stageLoopDeckList.appendChild(chip);
    });
  }

  function updateStageLoopPhaseRail(phase) {
    if (!refs.stageLoopPhaseRail) {
      return;
    }

    const phaseOrder = ["listening", "entering", "building", "supporting"];
    const activeIndex = Math.max(0, phaseOrder.indexOf(phase));
    const chips = Array.from(refs.stageLoopPhaseRail.children);
    chips.forEach((chip, index) => {
      chip.classList.toggle("active", phaseOrder[index] === phase);
      chip.classList.toggle("complete", index < activeIndex);
    });
  }

  function renderDetectionBeatGrid(state) {
    if (!refs.jammerDetectionGrid) {
      return;
    }

    refs.jammerDetectionGrid.innerHTML = "";
    const detectionActive = state.detectionActive;
    const bars = Math.max(1, Number(state.detectionSummary.phraseBars || state.detectionSummary.essentiaPhraseBars || 4));
    const beatInBar = Number(state.detectionSummary.beatInBar || state.detectionSummary.phase || 0);
    const anchorOffset = beatInBar > 0 ? beatInBar - 1 : 0;
    const currentFlatIndex = beatInBar > 0 ? anchorOffset : -1;
    const rows = [
      {
        key: "fusion",
        label: "Grid",
        meta: `${state.detectionSummary.tempo > 0 ? `${state.detectionSummary.tempo} BPM` : "Tempo scan"} - anchor ${Math.round(Number(state.detectionSummary.barAnchorConfidence || 0))}%`,
        active: true,
      },
      {
        key: "aubio",
        label: "Aubio",
        meta: `${state.detectionSummary.aubioTempo > 0 ? `${state.detectionSummary.aubioTempo} BPM` : "Pulse"} - ${Math.round(Number(state.detectionSummary.aubioConfidence || 0))}%`,
        active: Number(state.detectionSummary.aubioConfidence || 0) > 0 || Boolean(state.detectionSummary.aubioBeatPulse),
      },
      {
        key: "essentia",
        label: "Essentia",
        meta: `${state.detectionSummary.essentiaStableTempo > 0 ? `${state.detectionSummary.essentiaStableTempo} BPM stable` : `${state.detectionSummary.essentiaTempo || 0} BPM`} - ${Math.round(Number(state.detectionSummary.essentiaAnchorConfidence || 0))}%`,
        active: Number(state.detectionSummary.essentiaConfidence || 0) > 0 || Number(state.detectionSummary.essentiaStableConfidence || 0) > 0,
      },
    ];

    rows.forEach((row) => {
      const rowEl = document.createElement("div");
      rowEl.className = "jammer-detection-beat-row";
      rowEl.classList.add(row.key === "fusion" ? "is-primary" : "is-secondary");

      const head = document.createElement("div");
      head.className = "jammer-detection-beat-row-head";
      const label = document.createElement("div");
      label.className = "jammer-detection-beat-row-label";
      label.textContent = row.label;
      const meta = document.createElement("div");
      meta.className = "jammer-detection-beat-row-meta";
      meta.textContent = row.meta;
      head.appendChild(label);
      head.appendChild(meta);

      const cells = document.createElement("div");
      cells.className = "jammer-detection-beat-cells";
      cells.style.gridTemplateColumns = `repeat(${bars * 4}, minmax(0, 1fr))`;

      for (let barIndex = 0; barIndex < bars; barIndex += 1) {
        for (let beatIndex = 0; beatIndex < 4; beatIndex += 1) {
          const flatIndex = (barIndex * 4) + beatIndex;
          const cell = document.createElement("div");
          cell.className = "jammer-detection-beat-cell";
          const text = document.createElement("span");
          text.textContent = String(beatIndex + 1);
          cell.appendChild(text);

          if (beatIndex === 0) {
            cell.classList.add("is-anchor");
          }

          if (detectionActive && row.active) {
            if (row.key === "fusion") {
              cell.classList.add("is-active");
            } else if (row.key === "aubio" && (beatIndex !== 0 || state.detectionSummary.aubioBeatPulse || Number(state.detectionSummary.aubioConfidence || 0) >= 25)) {
              cell.classList.add("is-active");
            } else if (row.key === "essentia" && (beatIndex !== 0 || Number(state.detectionSummary.essentiaAnchorConfidence || 0) >= 25)) {
              cell.classList.add("is-active");
            }
          }

          if (row.key === "fusion" && detectionActive && currentFlatIndex >= 0 && flatIndex === currentFlatIndex) {
            cell.classList.add("is-current");
          }

          cell.title = `Bar ${barIndex + 1} - Beat ${beatIndex + 1}`;
          cells.appendChild(cell);
        }
      }

      rowEl.appendChild(head);
      rowEl.appendChild(cells);
      refs.jammerDetectionGrid.appendChild(rowEl);
    });
  }

  function renderSongAnalysis(state) {
    if (!refs.jammerSongAnalysisStatus) {
      return;
    }

    if (refs.jammerCalibrationToggleButton) {
      const collapsed = Boolean(state.detectorCalibrationCollapsed);
      refs.jammerCalibrationToggleButton.setAttribute("aria-expanded", String(!collapsed));
      refs.jammerCalibrationToggleButton.setAttribute("aria-label", collapsed ? "Expand detector calibration" : "Collapse detector calibration");
      refs.jammerCalibrationToggleButton.title = collapsed ? "Expand detector calibration" : "Collapse detector calibration";
      refs.jammerCalibrationToggleButton.classList.toggle("active", !collapsed);
    }
    if (refs.jammerCalibrationPanelBody) {
      refs.jammerCalibrationPanelBody.classList.toggle("hidden", Boolean(state.detectorCalibrationCollapsed));
    }

    const analysis = state.currentSongAnalysis;
    const calibrationTest = state.detectorCalibrationTest || {};
    const calibrationHistory = Array.isArray(state.detectorCalibrationHistory) ? state.detectorCalibrationHistory : [];
    const trackLabel = analysis?.trackName || state.songAnalysisStatus || "";
    if (refs.jammerCalibrationPanelStatus) {
      refs.jammerCalibrationPanelStatus.textContent = state.songAnalysisRunning
        ? "Running"
        : analysis
          ? `${trackLabel || "Track"} ready`
          : (trackLabel ? `${trackLabel}` : "Idle");
    }
    const aubioHistory = calibrationHistory.filter((entry) => entry.kind === "module" && entry.moduleKey === "aubio");
    const essentiaHistory = calibrationHistory.filter((entry) => entry.kind === "module" && entry.moduleKey === "essentia");
    const aubioModuleState = calibrationTest.moduleStats?.aubio || {};
    const essentiaModuleState = calibrationTest.moduleStats?.essentia || {};
    const samples = Math.max(0, Number(calibrationTest.samples || 0));
    const aubioSamples = Math.max(0, Number(aubioModuleState.samples || 0));
    const essentiaSamples = Math.max(0, Number(essentiaModuleState.samples || 0));
    const progress = Math.max(0, Math.min(100, Number(state.detectorCalibrationProgress || 0)));
    const avgTempoDelta = samples > 0 ? (Number(calibrationTest.tempoDeltaTotal || 0) / samples) : 0;
    const avgAnchor = samples > 0 ? (Number(calibrationTest.anchorTotal || 0) / samples) : 0;
    const avgAgreement = samples > 0 ? (Number(calibrationTest.agreementTotal || 0) / samples) : 0;
    const avgStability = samples > 0 ? (Number(calibrationTest.stabilityTotal || 0) / samples) : 0;
    const aubioAvgDelta = aubioSamples > 0 ? Number(aubioModuleState.tempoDeltaTotal || 0) / aubioSamples : 0;
    const aubioAvgConfidence = aubioSamples > 0 ? Number(aubioModuleState.confidenceTotal || 0) / aubioSamples : 0;
    const aubioAvgAnchor = aubioSamples > 0 ? Number(aubioModuleState.anchorTotal || 0) / aubioSamples : 0;
    const aubioAvgPulse = aubioSamples > 0 ? Number(aubioModuleState.beatPulseCount || 0) / aubioSamples : 0;
    const essentiaAvgDelta = essentiaSamples > 0 ? Number(essentiaModuleState.tempoDeltaTotal || 0) / essentiaSamples : 0;
    const essentiaAvgConfidence = essentiaSamples > 0 ? Number(essentiaModuleState.confidenceTotal || 0) / essentiaSamples : 0;
    const essentiaAvgAnchor = essentiaSamples > 0 ? Number(essentiaModuleState.anchorTotal || 0) / essentiaSamples : 0;
    const score = samples > 0 && analysis
      ? Math.round(Math.max(1, Math.min(100,
        (Math.max(0, 100 - (Math.abs(avgTempoDelta) * 8)) * 0.34)
        + (avgAnchor * 0.26)
        + (avgAgreement * 0.18)
        + (avgStability * 0.22)
        - ((Number(state.detectionSummary.phraseBars || 0) === Number(analysis.phraseBars || 0)) ? 0 : 12)
      )))
      : 0;
    const referenceGrid = analysis?.referenceGrid || null;
    const referenceCandidates = Array.isArray(referenceGrid?.topTempoCandidates) ? referenceGrid.topTempoCandidates : [];
    refs.jammerSongAnalysisStatus.textContent = state.songAnalysisRunning
      ? (state.detectorCalibrationProgressLabel || "Analyzing full track...")
      : (state.songAnalysisStatus || (analysis ? "Ready" : "No analysis yet"));
    refs.jammerSongAnalyzeButton.disabled = state.songAnalysisRunning;
    refs.jammerCalibrationRunTestButton.disabled = state.songAnalysisRunning || !analysis;
    refs.jammerCalibrationRunTestButton.textContent = calibrationTest.active ? "Testing..." : "Start Playback Test";
    refs.jammerCalibrationProgressValue.textContent = `${Math.round(progress)}%`;
    refs.jammerCalibrationProgressFill.style.width = `${progress}%`;
    refs.jammerCalibrationTestMode.textContent = calibrationTest.mode
      ? ({
        comparison: "Aubio + Essentia side by side",
        aubio: "Aubio only",
        essentia: "Essentia only",
        fusion: "Aubio + Essentia side by side",
      }[calibrationTest.mode] || "Aubio + Essentia side by side")
      : "Aubio + Essentia side by side";
    refs.jammerCalibrationSamples.textContent = String(samples);
    refs.jammerCalibrationTempoDelta.textContent = samples > 0
      ? `${avgTempoDelta > 0 ? "+" : ""}${Math.round(avgTempoDelta * 10) / 10} BPM`
      : "0 BPM";

    if (!analysis) {
      refs.jammerSongAnalysisTempo.textContent = "0 BPM";
      refs.jammerSongAnalysisBars.textContent = "0";
      refs.jammerSongAnalysisPhrase.textContent = "0 bars";
      refs.jammerSongAnalysisForm.textContent = "Unknown";
      refs.jammerCalibrationScore.textContent = "0 / 100";
      refs.jammerCalibrationSuggestedModule.textContent = "Waiting";
      refs.jammerCalibrationSuggestedTiming.textContent = "Waiting";
      refs.jammerSongAnalysisSummary.textContent = "Load or choose a track, then analyze the full file.";
      refs.jammerSongAnalysisCompare.textContent = "No plugin comparison yet.";
      refs.jammerSongAnalysisRecommendations.innerHTML = "";
      refs.jammerCalibrationAubioScore.textContent = "0 / 100";
      refs.jammerCalibrationAubioMeta.textContent = "No Aubio test yet";
      refs.jammerCalibrationAubioSuggestions.innerHTML = "";
      refs.jammerCalibrationAubioHistorySummary.textContent = "No Aubio history yet.";
      refs.jammerCalibrationAubioHistoryList.innerHTML = "";
      refs.jammerCalibrationEssentiaScore.textContent = "0 / 100";
      refs.jammerCalibrationEssentiaMeta.textContent = "No Essentia test yet";
      refs.jammerCalibrationEssentiaSuggestions.innerHTML = "";
      refs.jammerCalibrationEssentiaHistorySummary.textContent = "No Essentia history yet.";
      refs.jammerCalibrationEssentiaHistoryList.innerHTML = "";
      refs.jammerCalibrationApplyAubioCheckbox.checked = false;
      refs.jammerCalibrationApplyEssentiaCheckbox.checked = false;
      refs.jammerCalibrationHistorySummary.textContent = "No tests saved yet.";
      refs.jammerCalibrationHistoryList.innerHTML = "";
      return;
    }

    refs.jammerSongAnalysisTempo.textContent = analysis.tempo > 0 ? `${analysis.tempo} BPM` : "0 BPM";
    refs.jammerSongAnalysisBars.textContent = String(analysis.totalBars || 0);
    refs.jammerSongAnalysisPhrase.textContent = `${analysis.phraseBars || 0} bars`;
    refs.jammerSongAnalysisForm.textContent = analysis.structure?.formHypothesis || "Unknown";
    refs.jammerCalibrationScore.textContent = `${score} / 100`;
    const dominantLeader = Object.entries(calibrationTest.leaderCounts || {})
      .sort((left, right) => right[1] - left[1])[0]?.[0] || "fusion";
    refs.jammerCalibrationSuggestedModule.textContent = samples > 0
      ? ({
        aubio: "Aubio",
        essentia: "Essentia",
        fusion: "Aubio",
      }[dominantLeader] || "Aubio")
      : "Waiting";
    refs.jammerCalibrationSuggestedTiming.textContent = samples > 0
      ? ((avgStability < 56 || avgAnchor < 52 || Math.abs(avgTempoDelta) > 4.5) ? "Kalman PLL" : "Particle Grid")
      : "Waiting";
    refs.jammerSongAnalysisSummary.textContent = `${analysis.name || "Track"} - ${analysis.durationSeconds || 0}s - offline grid ${analysis.tempo || 0} BPM, ${analysis.totalBars || 0} bars, phrase ${analysis.phraseBars || 0}.`;

    const liveTempo = Number(state.detectionSummary.tempo || 0);
    const liveAubioTempo = Number(state.detectionSummary.aubioTempo || 0);
    const liveEssentiaTempo = Number(state.detectionSummary.essentiaStableTempo || state.detectionSummary.essentiaTempo || 0);
    const livePhrase = Number(state.detectionSummary.phraseBars || 0);
    const tempoDelta = liveTempo > 0 ? liveTempo - Number(analysis.tempo || 0) : 0;
    refs.jammerSongAnalysisCompare.textContent = samples > 0
      ? `Aubio ${liveAubioTempo || 0} BPM, Essentia ${liveEssentiaTempo || 0} BPM, phrase ${livePhrase || 0}/${analysis.phraseBars || 0}, anchor ${Math.round(Number(state.detectionSummary.barAnchorConfidence || 0))}%.`
      : (liveAubioTempo > 0 || liveEssentiaTempo > 0)
        ? `Aubio ${liveAubioTempo || 0} BPM, Essentia ${liveEssentiaTempo || 0} BPM, waiting to rate them separately against the offline grid.`
        : "Analyze the file first, then run the playback test to rate Aubio and Essentia separately against the offline reference grid.";

    refs.jammerSongAnalysisRecommendations.innerHTML = "";
    const referenceNotes = [
      referenceGrid
        ? `Reference grid selected offline: ${referenceGrid.tempo} BPM in ${referenceGrid.beatsPerBar}/4, about ${referenceGrid.totalBars} bars with phrases of ${referenceGrid.phraseBars} bars.`
        : `Reference grid selected offline: ${analysis.tempo || 0} BPM, about ${analysis.totalBars || 0} bars, phrase ${analysis.phraseBars || 0}.`,
      referenceGrid
        ? `Beat 1 evidence from the full-file scan: downbeat ${referenceGrid.downbeatBias}%, backbeat ${referenceGrid.backbeatBias || 0}%, tick alignment ${referenceGrid.tickAlignment}%, confidence ${referenceGrid.confidence}%.`
        : `Beat 1 evidence from the full-file scan is being summarized from the offline analysis.`,
      referenceCandidates.length > 0
        ? `Tempo candidates checked offline: ${referenceCandidates.map((candidate) => `${candidate.tempo} BPM (${candidate.score})`).join(" - ")}.`
        : "Tempo candidates will appear here after the whole-file scan finishes.",
      `Song form guess from the full-file scan: ${analysis.structure?.formHypothesis || "Unknown"} - current ${analysis.structure?.currentSection || "unknown"} - next ${analysis.structure?.nextLikelySection || "unknown"}.`,
    ];
    if (analysis.benchmark?.provider) {
      const sourceCount = Array.isArray(analysis.externalReferences) ? analysis.externalReferences.length : 1;
      referenceNotes.push(
        `External benchmark${sourceCount > 1 ? "s" : ""} saved (${sourceCount}): latest from ${analysis.benchmark.provider} -> ${analysis.benchmark.bpm} BPM, key ${analysis.benchmark.key || "?"}${analysis.benchmark.altKey ? ` (${analysis.benchmark.altKey})` : ""}.`
      );
    }
    referenceNotes.forEach((entry) => {
      const item = document.createElement("li");
      item.textContent = entry;
      refs.jammerSongAnalysisRecommendations.appendChild(item);
    });

    const aubioLatest = aubioHistory[0];
    const essentiaLatest = essentiaHistory[0];
    const aubioScore = aubioSamples > 0
      ? Math.round(Math.max(1, Math.min(100,
        (Math.max(0, 100 - (Math.abs(aubioAvgDelta) * 8)) * 0.38)
        + (Math.max(0, Math.min(100, aubioAvgConfidence)) * 0.18)
        + (Math.max(0, Math.min(100, Math.max(aubioAvgAnchor, aubioAvgPulse * 100))) * 0.24)
        + (Math.max(0, Math.min(100, avgStability)) * 0.2)
      )))
      : (aubioLatest?.score || 0);
    const essentiaScore = essentiaSamples > 0
      ? Math.round(Math.max(1, Math.min(100,
        (Math.max(0, 100 - (Math.abs(essentiaAvgDelta) * 8)) * 0.38)
        + (Math.max(0, Math.min(100, essentiaAvgConfidence)) * 0.18)
        + (Math.max(0, Math.min(100, essentiaAvgAnchor)) * 0.24)
        + (Math.max(0, Math.min(100, avgStability)) * 0.2)
      )))
      : (essentiaLatest?.score || 0);
    refs.jammerCalibrationAubioScore.textContent = `${aubioScore} / 100`;
    refs.jammerCalibrationAubioMeta.textContent = aubioSamples > 0
      ? `${Math.round(aubioAvgConfidence)}% conf - ${Math.round(aubioAvgAnchor)}% anchor - ${Math.round(aubioAvgPulse * 100)}% pulse - ${Math.round((aubioModuleState.tempoHitCount || 0) / Math.max(1, aubioSamples) * 100)}% tempo lock`
      : (aubioLatest ? `Last saved ${aubioLatest.score}/100` : "No Aubio test yet");
    refs.jammerCalibrationEssentiaScore.textContent = `${essentiaScore} / 100`;
    refs.jammerCalibrationEssentiaMeta.textContent = essentiaSamples > 0
      ? `${Math.round(essentiaAvgConfidence)}% conf - ${Math.round(essentiaAvgAnchor)}% anchor - ${Math.round((essentiaModuleState.tempoHitCount || 0) / Math.max(1, essentiaSamples) * 100)}% tempo lock`
      : (essentiaLatest ? `Last saved ${essentiaLatest.score}/100` : "No Essentia test yet");

    refs.jammerCalibrationAubioSuggestions.innerHTML = "";
    [
      aubioSamples > 0
        ? `Tempo ${aubioAvgDelta > 0 ? "+" : ""}${Math.round(aubioAvgDelta * 10) / 10} BPM vs reference`
        : "Run a live test to rate Aubio alone.",
      ...(aubioSamples > 0
        ? (((aubioModuleState.tempoHitCount || 0) / Math.max(1, aubioSamples)) < 0.42
          ? ["Aubio sta sentendo impulsi ma aggancia poco il tempo: allunga l'ascolto iniziale e rendi più severi i trigger isolati."]
          : aubioAvgConfidence < 48
            ? ["Allunga l'ascolto iniziale e rendi più severi i trigger isolati."]
            : ["Aubio è già abbastanza leggibile: puoi rifinire solo l'inerzia del lock."])
        : []),
    ].forEach((text) => {
      const item = document.createElement("li");
      item.textContent = text;
      refs.jammerCalibrationAubioSuggestions.appendChild(item);
    });

    refs.jammerCalibrationEssentiaSuggestions.innerHTML = "";
    [
      essentiaSamples > 0
        ? `Tempo ${essentiaAvgDelta > 0 ? "+" : ""}${Math.round(essentiaAvgDelta * 10) / 10} BPM vs reference`
        : "Run a live test to rate Essentia alone.",
      ...(essentiaSamples > 0
        ? (((essentiaModuleState.tempoHitCount || 0) / Math.max(1, essentiaSamples)) < 0.42
          ? ["Essentia sta raccogliendo struttura ma non ancora un tempo stabile: aumenta memoria di frase e anchor prima del lock."]
          : essentiaAvgAnchor < 56
            ? ["Rafforza anchor, phrase memory e peso armonico lento."]
            : ["Essentia è già abbastanza credibile: puoi lavorare sui dettagli di stabilità."])
        : []),
    ].forEach((text) => {
      const item = document.createElement("li");
      item.textContent = text;
      refs.jammerCalibrationEssentiaSuggestions.appendChild(item);
    });

    refs.jammerCalibrationApplyAubioCheckbox.disabled = state.songAnalysisRunning || !analysis || aubioSamples <= 0;
    refs.jammerCalibrationRetestAubioButton.disabled = state.songAnalysisRunning || !analysis;
    refs.jammerCalibrationApplyEssentiaCheckbox.disabled = state.songAnalysisRunning || !analysis || essentiaSamples <= 0;
    refs.jammerCalibrationRetestEssentiaButton.disabled = state.songAnalysisRunning || !analysis;
    refs.jammerCalibrationRepeatSelectedButton.disabled = state.songAnalysisRunning || !analysis;

    refs.jammerCalibrationHistoryList.innerHTML = "";
    refs.jammerCalibrationHistorySummary.textContent = calibrationHistory.length > 0
      ? `${calibrationHistory.length} saved test${calibrationHistory.length === 1 ? "" : "s"}`
      : "No tests saved yet.";
    calibrationHistory.slice(0, 8).forEach((entry) => {
      const item = document.createElement("li");
      const savedAt = entry.savedAt ? new Date(entry.savedAt).toLocaleString("it-IT", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "saved";
      const detectorLabel = ({
        aubio: "Aubio",
        essentia: "Essentia",
        fusion: "Side by side",
        comparison: "Side by side",
      }[entry.detectorMode]) || "Side by side";
      const timingLabel = entry.timingModel === "particle" ? "Particle" : "Kalman";
      item.textContent = `${savedAt} - score ${entry.score || 0}/100 - ${detectorLabel} + ${timingLabel} - ${Math.round(entry.averages?.tempoDelta || 0)} BPM`;
      refs.jammerCalibrationHistoryList.appendChild(item);
    });
    refs.jammerCalibrationAubioHistoryList.innerHTML = "";
    refs.jammerCalibrationAubioHistorySummary.textContent = aubioHistory.length > 0
      ? `${aubioHistory.length} Aubio test${aubioHistory.length === 1 ? "" : "s"}`
      : "No Aubio history yet.";
    aubioHistory.slice(0, 4).forEach((entry) => {
      const item = document.createElement("li");
      const savedAt = entry.savedAt ? new Date(entry.savedAt).toLocaleString("it-IT", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "saved";
      const timingLabel = entry.suggestedTimingModel === "particle" ? "Particle" : "Kalman";
      item.textContent = `${savedAt} - ${entry.score || 0}/100 - ${timingLabel} - ${Math.round(entry.averages?.tempoDelta || 0)} BPM`;
      refs.jammerCalibrationAubioHistoryList.appendChild(item);
    });
    refs.jammerCalibrationEssentiaHistoryList.innerHTML = "";
    refs.jammerCalibrationEssentiaHistorySummary.textContent = essentiaHistory.length > 0
      ? `${essentiaHistory.length} Essentia test${essentiaHistory.length === 1 ? "" : "s"}`
      : "No Essentia history yet.";
    essentiaHistory.slice(0, 4).forEach((entry) => {
      const item = document.createElement("li");
      const savedAt = entry.savedAt ? new Date(entry.savedAt).toLocaleString("it-IT", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "saved";
      const timingLabel = entry.suggestedTimingModel === "particle" ? "Particle" : "Kalman";
      item.textContent = `${savedAt} - ${entry.score || 0}/100 - ${timingLabel} - ${Math.round(entry.averages?.tempoDelta || 0)} BPM`;
      refs.jammerCalibrationEssentiaHistoryList.appendChild(item);
    });
  }

  function formatBenchmarkTimestamp(value) {
    if (!value) {
      return "saved";
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return "saved";
    }
    return date.toLocaleString("it-IT", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function formatBenchmarkConfigValue(value) {
    if (typeof value === "number" && Number.isFinite(value)) {
      return Math.round(value * 100) / 100;
    }
    return String(value);
  }

  function formatBenchmarkTempoDelta(value) {
    const safeValue = Number(value || 0);
    const rounded = Math.round(safeValue * 10) / 10;
    return `${rounded > 0 ? "+" : ""}${rounded} BPM`;
  }

  function formatBenchmarkConfigKey(key) {
    return ({
      onsetThreshold: "Onset threshold",
      silenceDb: "Silence gate",
      halfTimeBias: "Half-time bias",
      lowWeight: "Low band weight",
      midWeight: "Mid band weight",
      highWeight: "High band weight",
      barSyncWeight: "Bar sync weight",
      harmonicAnchorWeight: "Harmonic anchor weight",
      rhythmWeight: "Rhythm weight",
      tickWeight: "Tick weight",
      lowEnvelopeWeight: "Low envelope weight",
      midEnvelopeWeight: "Mid envelope weight",
      mixedEnvelopeWeight: "Mixed envelope weight",
      sectionSyncWeight: "Section sync weight",
    }[key] || key);
  }

  function getBenchmarkConfigChanges(moduleRun) {
    if (!moduleRun?.config || !moduleRun?.suggestedConfig) {
      return [];
    }

    return Object.keys(moduleRun.suggestedConfig)
      .filter((key) => moduleRun.suggestedConfig[key] !== moduleRun.config[key])
      .map((key) => ({
        key,
        current: moduleRun.config[key],
        next: moduleRun.suggestedConfig[key],
      }));
  }

  function buildBenchmarkModuleHistory(history, moduleKey) {
    return history.filter((entry) => (
      (entry.kind === "config-update" && entry.moduleKey === moduleKey)
      || Boolean(entry[moduleKey])
    ));
  }

  function getBenchmarkModuleTrend(history, moduleKey) {
    const moduleRuns = history.filter((entry) => entry?.[moduleKey]).slice(0, 2);
    if (moduleRuns.length < 2) {
      return null;
    }

    const currentRun = moduleRuns[0][moduleKey] || {};
    const previousRun = moduleRuns[1][moduleKey] || {};
    return {
      scoreDelta: Number(currentRun.score || 0) - Number(previousRun.score || 0),
      bpmDelta: Number(currentRun.delta || 0) - Number(previousRun.delta || 0),
      tempoDelta: Number(currentRun.tempo || 0) - Number(previousRun.tempo || 0),
    };
  }

  function getLatestBenchmarkConfigUpdate(history, moduleKey) {
    return history.find((entry) => entry?.kind === "config-update" && entry?.moduleKey === moduleKey) || null;
  }

  function formatAppliedBenchmarkChange(entry) {
    if (!entry) {
      return "No applied parameter changes yet.";
    }
    const appliedKeys = Array.isArray(entry.appliedSuggestionKeys) ? entry.appliedSuggestionKeys : [];
    if (appliedKeys.length === 0) {
      return `Applied changes at ${formatBenchmarkTimestamp(entry.savedAt)}.`;
    }
    return `Applied in this cycle: ${appliedKeys.map((key) => formatBenchmarkConfigKey(key)).join(", ")}.`;
  }

  function formatBenchmarkOutcome(trend) {
    if (!trend) {
      return "No previous retest to compare yet.";
    }
    if (trend.scoreDelta > 0) {
      return `Outcome: improved by +${trend.scoreDelta} points, error shift ${formatBenchmarkTempoDelta(trend.bpmDelta)}.`;
    }
    if (trend.scoreDelta < 0) {
      return `Outcome: worsened by ${trend.scoreDelta} points, error shift ${formatBenchmarkTempoDelta(trend.bpmDelta)}.`;
    }
    return `Outcome: no measurable score change, error shift ${formatBenchmarkTempoDelta(trend.bpmDelta)}.`;
  }

  function appendBenchmarkSuggestionBlock(listElement, moduleRun, fallbackText) {
    listElement.innerHTML = "";
    const narrativeSuggestions = Array.isArray(moduleRun?.suggestions) && moduleRun.suggestions.length > 0
      ? moduleRun.suggestions
      : [fallbackText];

    narrativeSuggestions.forEach((text) => {
      const item = document.createElement("li");
      item.textContent = text;
      listElement.appendChild(item);
    });

    const configChanges = getBenchmarkConfigChanges(moduleRun);
    configChanges.forEach((change) => {
      const item = document.createElement("li");
      item.textContent = `${formatBenchmarkConfigKey(change.key)}: ${formatBenchmarkConfigValue(change.current)} -> ${formatBenchmarkConfigValue(change.next)}`;
      listElement.appendChild(item);
    });
  }

  function renderBenchmarkModuleSuggestions(moduleContainer, moduleRun, moduleKey, fileId, running) {
    const descriptionList = document.createElement("ul");
    descriptionList.className = "jammer-favorite-list compact";
    appendBenchmarkSuggestionBlock(
      descriptionList,
      moduleRun,
      `Run ${moduleKey === "aubio" ? "Aubio" : "Essentia"} on this file to get focused suggestions.`,
    );
    moduleContainer.appendChild(descriptionList);

    const changeList = document.createElement("div");
    changeList.className = "jammer-benchmark-suggestion-list";
    const configChanges = getBenchmarkConfigChanges(moduleRun);
    if (configChanges.length === 0) {
      const hint = document.createElement("div");
      hint.className = "jammer-detection-meta";
      hint.textContent = moduleRun
        ? "No parameter changes suggested right now."
        : "No module test on this file yet.";
      changeList.appendChild(hint);
    } else {
      configChanges.forEach((change) => {
        const label = document.createElement("label");
        label.className = "jammer-benchmark-suggestion-item checkbox-row";
        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.checked = true;
        checkbox.disabled = running;
        checkbox.dataset.suggestionKey = change.key;
        const text = document.createElement("span");
        text.textContent = `${formatBenchmarkConfigKey(change.key)}: ${formatBenchmarkConfigValue(change.current)} -> ${formatBenchmarkConfigValue(change.next)}`;
        label.appendChild(checkbox);
        label.appendChild(text);
        changeList.appendChild(label);
      });
    }
    moduleContainer.appendChild(changeList);

    const actions = document.createElement("div");
    actions.className = "jammer-detection-calibration-actions module-actions";
    const applyButton = document.createElement("button");
    applyButton.type = "button";
    applyButton.className = "jammer-inline-action";
    applyButton.textContent = "Apply";
    applyButton.disabled = running || configChanges.length === 0;
    applyButton.dataset.bpmAction = "apply";
    applyButton.dataset.bpmFileId = fileId;
    applyButton.dataset.moduleKey = moduleKey;
    const applyRetestButton = document.createElement("button");
    applyRetestButton.type = "button";
    applyRetestButton.className = "jammer-inline-action";
    applyRetestButton.textContent = "Apply + Retest";
    applyRetestButton.disabled = running || configChanges.length === 0;
    applyRetestButton.dataset.bpmAction = "apply-retest";
    applyRetestButton.dataset.bpmFileId = fileId;
    applyRetestButton.dataset.moduleKey = moduleKey;
    const evolveButton = document.createElement("button");
    evolveButton.type = "button";
    evolveButton.className = "jammer-inline-action";
    evolveButton.textContent = "Evolve x10";
    evolveButton.disabled = running;
    evolveButton.dataset.bpmAction = "evolve-x10";
    evolveButton.dataset.bpmFileId = fileId;
    evolveButton.dataset.moduleKey = moduleKey;
    actions.appendChild(applyButton);
    actions.appendChild(applyRetestButton);
    actions.appendChild(evolveButton);
    moduleContainer.appendChild(actions);
  }

  function renderBenchmarkModuleHistory(moduleContainer, history, moduleKey) {
    const historyTitle = document.createElement("div");
    historyTitle.className = "jammer-detection-meta";
    historyTitle.textContent = history.length > 0
      ? `${history.length} saved change${history.length === 1 ? "" : "s"}`
      : "No saved changes yet.";
    moduleContainer.appendChild(historyTitle);

    const historyList = document.createElement("div");
    historyList.className = "jammer-benchmark-history-list";
    history.slice(0, 5).forEach((entry) => {
      const row = document.createElement("div");
      row.className = "jammer-detection-meta";
      if (entry.kind === "config-update") {
        const appliedKeys = Array.isArray(entry.appliedSuggestionKeys)
          ? entry.appliedSuggestionKeys.map((key) => formatBenchmarkConfigKey(key)).join(", ")
          : "changes";
        row.textContent = `${formatBenchmarkTimestamp(entry.savedAt)} - applied ${appliedKeys}`;
      } else if (entry.kind === "evolution-summary") {
        row.textContent = `${formatBenchmarkTimestamp(entry.savedAt)} - ${entry.note || `saved best ${moduleKey} evolution run`}`;
      } else {
        const moduleRun = entry[moduleKey] || {};
        row.textContent = `${formatBenchmarkTimestamp(entry.savedAt)} - ${moduleRun.score || 0}/100 - ${moduleRun.tempo || 0} BPM - scostamento ${formatBenchmarkTempoDelta(moduleRun.delta || 0)}`;
      }
      historyList.appendChild(row);
    });
    moduleContainer.appendChild(historyList);
  }

  function renderBenchmarkFileResults(state, benchmarkStates) {
    if (!refs.jammerBpmBenchmarkResults || !refs.jammerBpmBenchmarkResultsSummary) {
      return;
    }

    refs.jammerBpmBenchmarkResults.innerHTML = "";
    const normalizedStates = Array.isArray(benchmarkStates) && benchmarkStates.length > 0
      ? benchmarkStates
      : (state.bpmBenchmarkState?.latestRun ? [state.bpmBenchmarkState] : []);

    if (!normalizedStates.length) {
      refs.jammerBpmBenchmarkResultsSummary.textContent = "No file results yet.";
      return;
    }

    const aubioScores = [];
    const essentiaScores = [];
    normalizedStates.forEach((entry) => {
      if (entry?.latestRun?.aubio?.score) {
        aubioScores.push(Number(entry.latestRun.aubio.score));
      }
      if (entry?.latestRun?.essentia?.score) {
        essentiaScores.push(Number(entry.latestRun.essentia.score));
      }
    });
    const aubioAverage = aubioScores.length > 0
      ? Math.round(aubioScores.reduce((sum, value) => sum + value, 0) / aubioScores.length)
      : 0;
    const essentiaAverage = essentiaScores.length > 0
      ? Math.round(essentiaScores.reduce((sum, value) => sum + value, 0) / essentiaScores.length)
      : 0;
    refs.jammerBpmBenchmarkResultsSummary.textContent = `${normalizedStates.length} files - Aubio avg ${aubioAverage}/100 - Essentia avg ${essentiaAverage}/100`;

    normalizedStates.forEach((entry) => {
      const latestRun = entry?.latestRun || {};
      const history = Array.isArray(entry?.history) ? entry.history : [];
      const knownBpm = Number(entry?.knownBpm || latestRun?.knownBpm || 0);
      const referenceTempo = Number(latestRun?.reference?.tempo || 0);
      const referenceDelta = knownBpm > 0 && referenceTempo > 0 ? referenceTempo - knownBpm : 0;
      const aubio = latestRun?.aubio || null;
      const essentia = latestRun?.essentia || null;

      const fileCard = document.createElement("div");
      fileCard.className = "jammer-benchmark-file-card";

      const head = document.createElement("div");
      head.className = "jammer-benchmark-file-head";
      const headLeft = document.createElement("div");
      const title = document.createElement("div");
      title.className = "jammer-benchmark-file-title";
      title.textContent = entry.trackName || entry.fileId || "Benchmark file";
      const meta = document.createElement("div");
      meta.className = "jammer-benchmark-file-meta";
      meta.textContent = `Known ${knownBpm || "?"} BPM - offline ${referenceTempo || 0} BPM - phrase ${latestRun?.reference?.phraseBars || 0} bars`;
      headLeft.appendChild(title);
      headLeft.appendChild(meta);
      const headRight = document.createElement("div");
      headRight.className = "jammer-benchmark-file-meta";
      headRight.textContent = latestRun?.analyzedAt ? `Last run ${formatBenchmarkTimestamp(latestRun.analyzedAt)}` : "Not tested yet";
      head.appendChild(headLeft);
      head.appendChild(headRight);
      fileCard.appendChild(head);

      const grid = document.createElement("div");
      grid.className = "jammer-benchmark-file-grid";
      [
        ["Known BPM", knownBpm > 0 ? `${knownBpm} BPM` : "Unknown"],
        ["Offline Grid", referenceTempo > 0 ? `${referenceTempo} BPM` : "0 BPM"],
        ["Offline Delta", knownBpm > 0 && referenceTempo > 0 ? formatBenchmarkTempoDelta(referenceDelta) : "n/a"],
        ["Bars", String(latestRun?.reference?.totalBars || 0)],
        ["Phrase", `${latestRun?.reference?.phraseBars || 0} bars`],
        ["Aubio Delta", aubio ? formatBenchmarkTempoDelta(aubio.delta || 0) : "n/a"],
        ["Essentia Delta", essentia ? formatBenchmarkTempoDelta(essentia.delta || 0) : "n/a"],
      ].forEach(([labelText, valueText]) => {
        const stat = document.createElement("div");
        stat.className = "jammer-detection-stat";
        const label = document.createElement("div");
        label.className = "jammer-detection-label";
        label.textContent = labelText;
        const value = document.createElement("div");
        value.className = "jammer-detection-value";
        value.textContent = valueText;
        stat.appendChild(label);
        stat.appendChild(value);
        grid.appendChild(stat);
      });
      fileCard.appendChild(grid);

      const moduleGrid = document.createElement("div");
      moduleGrid.className = "jammer-benchmark-module-grid";
      [
        ["aubio", "Aubio", aubio],
        ["essentia", "Essentia", essentia],
      ].forEach(([moduleKey, labelText, moduleRun]) => {
        const moduleHistory = buildBenchmarkModuleHistory(history, moduleKey);
        const trend = getBenchmarkModuleTrend(history, moduleKey);
        const latestConfigUpdate = getLatestBenchmarkConfigUpdate(history, moduleKey);
        const moduleCard = document.createElement("div");
        moduleCard.className = "jammer-benchmark-module-card";
        moduleCard.dataset.bpmFileId = entry.fileId || "";
        moduleCard.dataset.moduleKey = moduleKey;

        const label = document.createElement("div");
        label.className = "jammer-detection-label";
        label.textContent = `${labelText} rating`;
        const score = document.createElement("div");
        score.className = "jammer-detection-value";
        score.textContent = moduleRun ? `${moduleRun.score || 0} / 100` : "0 / 100";
        const meta = document.createElement("div");
        meta.className = "jammer-detection-meta";
        meta.textContent = moduleRun
          ? `${moduleRun.tempo || 0} BPM - scostamento ${formatBenchmarkTempoDelta(moduleRun.delta || 0)} - ${moduleRun.confidence || 0}% conf`
          : `No ${labelText} test yet`;
        moduleCard.appendChild(label);
        moduleCard.appendChild(score);
        moduleCard.appendChild(meta);

        const trendLine = document.createElement("div");
        trendLine.className = "jammer-detection-meta";
        if (!trend) {
          trendLine.textContent = moduleRun ? "No previous retest to compare yet." : "No benchmark trend yet.";
        } else if (trend.scoreDelta > 0) {
          trendLine.textContent = `Trend: improved by +${trend.scoreDelta} points; BPM error shift ${formatBenchmarkTempoDelta(trend.bpmDelta)}.`;
        } else if (trend.scoreDelta < 0) {
          trendLine.textContent = `Trend: worsened by ${trend.scoreDelta} points; BPM error shift ${formatBenchmarkTempoDelta(trend.bpmDelta)}.`;
        } else {
          trendLine.textContent = `Trend: no score change; BPM error shift ${formatBenchmarkTempoDelta(trend.bpmDelta)}.`;
        }
        moduleCard.appendChild(trendLine);

        const appliedLine = document.createElement("div");
        appliedLine.className = "jammer-detection-meta";
        appliedLine.textContent = formatAppliedBenchmarkChange(latestConfigUpdate);
        moduleCard.appendChild(appliedLine);

        const outcomeLine = document.createElement("div");
        outcomeLine.className = "jammer-detection-meta";
        outcomeLine.textContent = formatBenchmarkOutcome(trend);
        moduleCard.appendChild(outcomeLine);

        renderBenchmarkModuleSuggestions(moduleCard, moduleRun, moduleKey, entry.fileId || "", state.bpmBenchmarkRunning);
        renderBenchmarkModuleHistory(moduleCard, moduleHistory, moduleKey);
        moduleGrid.appendChild(moduleCard);
      });
      fileCard.appendChild(moduleGrid);
      refs.jammerBpmBenchmarkResults.appendChild(fileCard);
    });
  }

  function renderBpmBenchmark(state) {
    if (!refs.jammerBpmBenchmarkStatus) {
      return;
    }

    if (refs.jammerBpmBenchmarkToggleButton) {
      const collapsed = Boolean(state.bpmBenchmarkCollapsed);
      refs.jammerBpmBenchmarkToggleButton.setAttribute("aria-expanded", String(!collapsed));
      refs.jammerBpmBenchmarkToggleButton.setAttribute("aria-label", collapsed ? "Expand BPM benchmark" : "Collapse BPM benchmark");
      refs.jammerBpmBenchmarkToggleButton.title = collapsed ? "Expand BPM benchmark" : "Collapse BPM benchmark";
      refs.jammerBpmBenchmarkToggleButton.classList.toggle("active", !collapsed);
    }
    if (refs.jammerBpmBenchmarkPanelBody) {
      refs.jammerBpmBenchmarkPanelBody.classList.toggle("hidden", Boolean(state.bpmBenchmarkCollapsed));
    }

    const benchmarkState = state.bpmBenchmarkState;
    const selectedTrack = Array.isArray(state.bpmBenchmarkTracks)
      ? state.bpmBenchmarkTracks.find((track) => track.id === state.bpmBenchmarkTrackId)
      : null;
    const selectedTrackIds = Array.isArray(state.bpmBenchmarkTrackIds) ? state.bpmBenchmarkTrackIds : [];
    const selectionSummary = state.bpmBenchmarkSelectionSummary || null;
    const benchmarkStates = Array.isArray(state.bpmBenchmarkStates) ? state.bpmBenchmarkStates.filter(Boolean) : [];
    const latestRun = benchmarkState?.latestRun || null;
    const history = Array.isArray(benchmarkState?.history) ? benchmarkState.history : [];
    const aubioHistory = history.filter((entry) => entry.aubio);
    const essentiaHistory = history.filter((entry) => entry.essentia);
    const knownBpm = Number(benchmarkState?.knownBpm || latestRun?.knownBpm || 0);
    const referenceTempo = Number(latestRun?.reference?.tempo || benchmarkState?.latestRun?.reference?.tempo || 0);
    const bars = Number(latestRun?.reference?.totalBars || 0);
    const phraseBars = Number(latestRun?.reference?.phraseBars || 0);
    const progress = Math.max(0, Math.min(100, Number(state.bpmBenchmarkProgress || 0)));
    if (refs.jammerBpmBenchmarkPanelStatus) {
      refs.jammerBpmBenchmarkPanelStatus.textContent = state.bpmBenchmarkRunning
        ? `Running ${selectedTrackIds.length || 1}`
        : selectedTrackIds.length > 0
          ? `${selectedTrackIds.length} selected`
          : "Idle";
    }

    refs.jammerBpmBenchmarkStatus.textContent = state.bpmBenchmarkRunning
      ? (state.bpmBenchmarkProgressLabel || "Running benchmark...")
      : (state.bpmBenchmarkProgressLabel || (benchmarkState?.latestRun ? "Benchmark ready" : "No benchmark yet"));
    refs.jammerBpmBenchmarkProgressValue.textContent = `${Math.round(progress)}%`;
    refs.jammerBpmBenchmarkProgressFill.style.width = `${progress}%`;
    refs.jammerBpmBenchmarkRunButton.disabled = state.bpmBenchmarkRunning || selectedTrackIds.length === 0;
    if (refs.jammerBpmBenchmarkReloadButton) {
      refs.jammerBpmBenchmarkReloadButton.disabled = state.bpmBenchmarkRunning;
    }
    refs.jammerBpmBenchmarkRetestAubioButton.disabled = state.bpmBenchmarkRunning || selectedTrackIds.length === 0;
    if (refs.jammerBpmBenchmarkEvolveAubioButton) {
      refs.jammerBpmBenchmarkEvolveAubioButton.disabled = state.bpmBenchmarkRunning || selectedTrackIds.length === 0;
    }
    refs.jammerBpmBenchmarkRetestEssentiaButton.disabled = state.bpmBenchmarkRunning || selectedTrackIds.length === 0;
    if (refs.jammerBpmBenchmarkEvolveEssentiaButton) {
      refs.jammerBpmBenchmarkEvolveEssentiaButton.disabled = state.bpmBenchmarkRunning || selectedTrackIds.length === 0;
    }
    refs.jammerBpmBenchmarkRepeatSelectedButton.disabled = state.bpmBenchmarkRunning || selectedTrackIds.length === 0;
    refs.jammerBpmBenchmarkSelectionSummary.textContent = selectedTrackIds.length === 0
      ? "No benchmark files selected"
      : selectionSummary
        ? `${selectionSummary.trackCount} files selected - Aubio avg ${selectionSummary.averageAubioScore}/100 - Essentia avg ${selectionSummary.averageEssentiaScore}/100`
        : `${selectedTrackIds.length} files selected`;

    if (!benchmarkState) {
      refs.jammerBpmBenchmarkKnownTempo.textContent = selectedTrack?.knownBpm ? `${selectedTrack.knownBpm} BPM` : "0 BPM";
      refs.jammerBpmBenchmarkReferenceTempo.textContent = "0 BPM";
      refs.jammerBpmBenchmarkBars.textContent = "0";
      refs.jammerBpmBenchmarkPhrase.textContent = "0 bars";
      refs.jammerBpmBenchmarkSummary.textContent = selectedTrack
        ? `${selectedTrack.name} - declared BPM ${selectedTrack.knownBpm || "?"}. Run the benchmark to compare Aubio and Essentia on the full file.`
        : "Choose a file from BPMtest to compare the plugins against a declared BPM.";
      refs.jammerBpmBenchmarkAubioScore.textContent = "0 / 100";
      refs.jammerBpmBenchmarkAubioMeta.textContent = "No Aubio benchmark yet";
      refs.jammerBpmBenchmarkAubioSuggestions.innerHTML = "";
      refs.jammerBpmBenchmarkAubioHistorySummary.textContent = "No Aubio benchmark history yet.";
      refs.jammerBpmBenchmarkAubioHistoryList.innerHTML = "";
      refs.jammerBpmBenchmarkEssentiaScore.textContent = "0 / 100";
      refs.jammerBpmBenchmarkEssentiaMeta.textContent = "No Essentia benchmark yet";
      refs.jammerBpmBenchmarkEssentiaSuggestions.innerHTML = "";
      refs.jammerBpmBenchmarkEssentiaHistorySummary.textContent = "No Essentia benchmark history yet.";
      refs.jammerBpmBenchmarkEssentiaHistoryList.innerHTML = "";
      refs.jammerBpmBenchmarkHistorySummary.textContent = "No benchmark history yet.";
      refs.jammerBpmBenchmarkHistoryList.innerHTML = "";
      renderBenchmarkFileResults(state, benchmarkStates);
      return;
    }

    refs.jammerBpmBenchmarkKnownTempo.textContent = knownBpm > 0 ? `${knownBpm} BPM` : "Unknown";
    refs.jammerBpmBenchmarkReferenceTempo.textContent = referenceTempo > 0 ? `${referenceTempo} BPM` : "0 BPM";
    refs.jammerBpmBenchmarkBars.textContent = String(bars || 0);
    refs.jammerBpmBenchmarkPhrase.textContent = `${phraseBars || 0} bars`;
    refs.jammerBpmBenchmarkSummary.textContent = `${benchmarkState.trackName || "Benchmark file"} - known BPM from filename ${knownBpm || "?"} - offline scan ${referenceTempo || 0} BPM - use this as the stable reference before touching live detection.`;

    const aubio = latestRun?.aubio || null;
    const essentia = latestRun?.essentia || null;

    refs.jammerBpmBenchmarkAubioScore.textContent = aubio ? `${aubio.score || 0} / 100` : "0 / 100";
    refs.jammerBpmBenchmarkAubioMeta.textContent = aubio
      ? `${aubio.tempo || 0} BPM - ${aubio.delta > 0 ? "+" : ""}${aubio.delta || 0} - ${aubio.confidence || 0}% conf`
      : "No Aubio benchmark yet";
    appendBenchmarkSuggestionBlock(
      refs.jammerBpmBenchmarkAubioSuggestions,
      aubio,
      "Run the benchmark to evaluate Aubio against a known BPM file.",
    );

    refs.jammerBpmBenchmarkEssentiaScore.textContent = essentia ? `${essentia.score || 0} / 100` : "0 / 100";
    refs.jammerBpmBenchmarkEssentiaMeta.textContent = essentia
      ? `${essentia.tempo || 0} BPM - ${essentia.delta > 0 ? "+" : ""}${essentia.delta || 0} - ${essentia.confidence || 0}% conf`
      : "No Essentia benchmark yet";
    appendBenchmarkSuggestionBlock(
      refs.jammerBpmBenchmarkEssentiaSuggestions,
      essentia,
      "Run the benchmark to evaluate Essentia against a known BPM file.",
    );

    refs.jammerBpmBenchmarkAubioHistorySummary.textContent = aubioHistory.length > 0
      ? `${aubioHistory.length} Aubio benchmark${aubioHistory.length === 1 ? "" : "s"}`
      : "No Aubio benchmark history yet.";
    refs.jammerBpmBenchmarkAubioHistoryList.innerHTML = "";
    aubioHistory.slice(0, 4).forEach((entry) => {
      const item = document.createElement("li");
      item.textContent = `${entry.savedAt ? new Date(entry.savedAt).toLocaleString("it-IT", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "saved"} - ${entry.aubio?.score || 0}/100 - ${entry.aubio?.tempo || 0} BPM`;
      refs.jammerBpmBenchmarkAubioHistoryList.appendChild(item);
    });

    refs.jammerBpmBenchmarkEssentiaHistorySummary.textContent = essentiaHistory.length > 0
      ? `${essentiaHistory.length} Essentia benchmark${essentiaHistory.length === 1 ? "" : "s"}`
      : "No Essentia benchmark history yet.";
    refs.jammerBpmBenchmarkEssentiaHistoryList.innerHTML = "";
    essentiaHistory.slice(0, 4).forEach((entry) => {
      const item = document.createElement("li");
      item.textContent = `${entry.savedAt ? new Date(entry.savedAt).toLocaleString("it-IT", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "saved"} - ${entry.essentia?.score || 0}/100 - ${entry.essentia?.tempo || 0} BPM`;
      refs.jammerBpmBenchmarkEssentiaHistoryList.appendChild(item);
    });

    refs.jammerBpmBenchmarkHistorySummary.textContent = history.length > 0
      ? `${history.length} saved benchmark run${history.length === 1 ? "" : "s"}`
      : "No benchmark history yet.";
    refs.jammerBpmBenchmarkHistoryList.innerHTML = "";
    history.slice(0, 8).forEach((entry) => {
      const item = document.createElement("li");
      item.textContent = `${entry.savedAt ? new Date(entry.savedAt).toLocaleString("it-IT", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "saved"} - Aubio ${entry.aubio?.score || 0}/100 - Essentia ${entry.essentia?.score || 0}/100`;
      refs.jammerBpmBenchmarkHistoryList.appendChild(item);
    });

    renderBenchmarkFileResults(state, benchmarkStates);
  }

  function drawExperimentSeries(canvas, values, color) {
    if (!canvas?.getContext) {
      return;
    }

    const context = canvas.getContext("2d");
    const width = canvas.width;
    const height = canvas.height;
    context.clearRect(0, 0, width, height);
    context.fillStyle = "rgba(7, 10, 14, 0.94)";
    context.fillRect(0, 0, width, height);

    context.strokeStyle = "rgba(114, 160, 255, 0.12)";
    context.lineWidth = 1;
    for (let row = 1; row < 4; row += 1) {
      const y = (height / 4) * row;
      context.beginPath();
      context.moveTo(0, y);
      context.lineTo(width, y);
      context.stroke();
    }

    if (!Array.isArray(values) || values.length < 2) {
      return;
    }

    let peak = 0.0001;
    values.forEach((value) => {
      peak = Math.max(peak, Number(value || 0));
    });

    context.strokeStyle = color;
    context.lineWidth = 1.8;
    context.beginPath();
    values.forEach((value, index) => {
      const x = (index / Math.max(1, values.length - 1)) * width;
      const normalized = Math.max(0, Math.min(1, Number(value || 0) / peak));
      const y = height - (normalized * (height - 8)) - 4;
      if (index === 0) {
        context.moveTo(x, y);
      } else {
        context.lineTo(x, y);
      }
    });
    context.stroke();
  }

  function getExperimentWindowSeries(values, frameSeconds, chartWindowSeconds) {
    if (!Array.isArray(values) || values.length === 0) {
      return [];
    }

    const safeFrameSeconds = Math.max(0.001, Number(frameSeconds || 0));
    const safeWindowSeconds = Math.max(1, Number(chartWindowSeconds || 8));
    const maxPoints = Math.max(2, Math.round(safeWindowSeconds / safeFrameSeconds));
    return values.slice(-maxPoints);
  }

  function renderDetectionExperiment(state) {
    if (!refs.jammerDetectionExperimentTempo) {
      return;
    }

    const experiment = state.detectionExperimentSnapshot || {};
    const config = state.detectionExperimentConfig || {};
    if (refs.jammerDetectionExperimentPanelStatus) {
      const sourceLabel = experiment.sourceMode && experiment.sourceMode !== "none"
        ? experiment.sourceMode
        : "idle";
      refs.jammerDetectionExperimentPanelStatus.textContent = `${config.pluginMode === "aubio" ? "Aubio" : "Essentia"} - ${sourceLabel}`;
    }
    if (refs.jammerDetectionExperimentToggleButton) {
      const collapsed = Boolean(state.detectionExperimentCollapsed);
      refs.jammerDetectionExperimentToggleButton.setAttribute("aria-expanded", String(!collapsed));
      refs.jammerDetectionExperimentToggleButton.setAttribute("aria-label", collapsed ? "Expand detection experiment" : "Collapse detection experiment");
      refs.jammerDetectionExperimentToggleButton.title = collapsed ? "Expand detection experiment" : "Collapse detection experiment";
      refs.jammerDetectionExperimentToggleButton.classList.toggle("active", !collapsed);
    }
    if (refs.jammerDetectionExperimentPanelBody) {
      refs.jammerDetectionExperimentPanelBody.classList.toggle("hidden", Boolean(state.detectionExperimentCollapsed));
    }
    if (refs.jammerDetectionExperimentPluginSelect && config.pluginMode) {
      refs.jammerDetectionExperimentPluginSelect.value = config.pluginMode;
    }
    if (refs.jammerDetectionExperimentSoloButton) {
      const soloEnabled = config.soloEnabled === true;
      const soloSourceLabel = experiment.sourceMode && experiment.sourceMode !== "none"
        ? experiment.sourceMode
        : "no source";
      refs.jammerDetectionExperimentSoloButton.classList.toggle("active", soloEnabled);
      refs.jammerDetectionExperimentSoloButton.setAttribute("aria-pressed", String(soloEnabled));
      refs.jammerDetectionExperimentSoloButton.textContent = soloEnabled ? "SOLO On" : "SOLO";
      refs.jammerDetectionExperimentSoloButton.title = soloEnabled
        ? `Listening to the enabled filter mix from ${soloSourceLabel}.`
        : "Listen to the enabled low, mid, and high filter mix.";
    }

    refs.jammerDetectionExperimentTempo.textContent = experiment.bpm > 0 ? `${experiment.bpm} BPM` : "0 BPM";
    refs.jammerDetectionExperimentFastTempo.textContent = experiment.fastBpm > 0 ? `${experiment.fastBpm} BPM` : "0 BPM";
    refs.jammerDetectionExperimentMediumTempo.textContent = experiment.mediumBpm > 0 ? `${experiment.mediumBpm} BPM` : "0 BPM";
    refs.jammerDetectionExperimentLongTempo.textContent = experiment.longBpm > 0 ? `${experiment.longBpm} BPM` : "0 BPM";
    refs.jammerDetectionExperimentConfidence.textContent = `${Math.round(Number(experiment.confidence || 0))}%`;
    refs.jammerDetectionExperimentPulse.textContent = `${Math.round(Math.max(0, Math.min(100, Number(experiment.weightedPulse || 0) * 100)))}%`;
    refs.jammerDetectionExperimentBeatPhase.textContent = `${Number(experiment.beatInBar || 0)} / 4`;
    refs.jammerDetectionExperimentLoopBar.textContent = `${Number(experiment.loopBar || 0)} / 4`;
    refs.jammerDetectionExperimentPhaseLock.textContent = `${Math.round(Number(experiment.phaseConfidence || 0))}%`;
    if (refs.jammerDetectionExperimentWindowLabel) {
      refs.jammerDetectionExperimentWindowLabel.textContent = `${Number(config.chartWindowSeconds || 8).toFixed(1)} s`;
    }
    refs.jammerDetectionExperimentSummary.textContent = experiment.summary || "Waiting for a live source.";

    refs.jammerDetectionExperimentRawMeta.textContent = `${Math.round(Number(experiment.rawLevel || 0) * 100)}%`;
    refs.jammerDetectionExperimentLowMeta.textContent = `${Math.round(Number(experiment.lowLevel || 0) * 100)}%`;
    refs.jammerDetectionExperimentMidMeta.textContent = `${Math.round(Number(experiment.midLevel || 0) * 100)}%`;
    refs.jammerDetectionExperimentHighMeta.textContent = `${Math.round(Number(experiment.highLevel || 0) * 100)}%`;
    refs.jammerDetectionExperimentTonalMeta.textContent = `${Math.round(Number(experiment.tonalChange || 0) * 100)}%`;
    refs.jammerDetectionExperimentWeightedMeta.textContent = `${Math.round(Number(experiment.weightedPulse || 0) * 100)}%`;

    const chartWindowSeconds = Number(config.chartWindowSeconds || 8);
    const frameSeconds = Number(experiment.frameSeconds || 1024 / 44100);
    drawExperimentSeries(refs.jammerDetectionExperimentRawCanvas, getExperimentWindowSeries(experiment.charts?.raw, frameSeconds, chartWindowSeconds), "#d3ddf3");
    drawExperimentSeries(refs.jammerDetectionExperimentLowCanvas, getExperimentWindowSeries(experiment.charts?.low, frameSeconds, chartWindowSeconds), "#8ce35c");
    drawExperimentSeries(refs.jammerDetectionExperimentMidCanvas, getExperimentWindowSeries(experiment.charts?.mid, frameSeconds, chartWindowSeconds), "#7fc8ff");
    drawExperimentSeries(refs.jammerDetectionExperimentHighCanvas, getExperimentWindowSeries(experiment.charts?.high, frameSeconds, chartWindowSeconds), "#f6c255");
    drawExperimentSeries(refs.jammerDetectionExperimentTonalCanvas, getExperimentWindowSeries(experiment.charts?.tonal, frameSeconds, chartWindowSeconds), "#f28bff");
    drawExperimentSeries(refs.jammerDetectionExperimentWeightedCanvas, getExperimentWindowSeries(experiment.charts?.weighted, frameSeconds, chartWindowSeconds), "#ffffff");
  }

  function updateStageLoopMonitor() {
    const state = getState();
    const loopState = state.toneDrumBus.getLoopState();
    const adaptiveState = state.adaptiveState;
    const resolvedSource = state.jammerEngine.getResolvedSource();
    const isReactiveListening = state.jammerEngine.state.enabled
      && state.jammerEngine.getProfile().id === "reactive-kit"
      && (resolvedSource === "player" || resolvedSource === "microphone-live" || resolvedSource === "microphone-armed");

    if (!loopState.active) {
      if (isReactiveListening) {
        refs.stageLoopStatus.textContent = adaptiveState?.phase
          ? formatPhaseLabel(adaptiveState.phase)
          : "Listening";
        refs.stageLoopPattern.textContent = "Reactive Kit - listening";
        refs.stageLoopPosition.textContent = adaptiveState?.listenMs > 0
          ? `${Math.round(adaptiveState.listenMs / 100) / 10}s listen`
          : "Waiting for downbeat";
        refs.stageLoopEvents.textContent = adaptiveState?.entryLevel > 0
          ? `Entry level ${adaptiveState.entryLevel} primed - anchor ${adaptiveState.anchorPulseCount || 0}`
          : "Holding entry";
        refs.stageLoopEar.textContent = state.essentiaSummary.ready
          ? `${state.essentiaSummary.tempo > 0 ? `${state.essentiaSummary.tempo} BPM` : "Tempo scanning"} - ${state.essentiaSummary.confidence}% conf - ${Math.round((state.essentiaSummary.energy || 0) * 100)}% energy`
          : "Ear warming up";
        refs.stageLoopAdapt.textContent = `${formatSectionLabel(adaptiveState.sectionState)} - Tempo ${adaptiveState.tempo} - Int ${adaptiveState.intensity} - Den ${adaptiveState.density}`;
        updateStageLoopPhaseRail(adaptiveState.phase || "listening");
        refs.stageLoopPhaseHint.textContent = `${formatPhaseLabel(adaptiveState.phase || "listening")} - ${Math.round((adaptiveState.listenMs || 0) / 100) / 10}s of listening - anchor ${adaptiveState.anchorPulseCount || 0}/6`;
        refs.stageLoopVariationHint.textContent = `${Number(adaptiveState.bars || 4)}-bar loop - one small change only at the next loop boundary`;
        renderStageLoopDeck(state.toneDrumBus.getDeckSnapshot());
      } else {
        refs.stageLoopStatus.textContent = "Standby";
        refs.stageLoopPattern.textContent = "No loop running";
        refs.stageLoopPosition.textContent = "Bar 0 - Step 0";
        refs.stageLoopEvents.textContent = "Silence";
        refs.stageLoopEar.textContent = "Waiting for source";
        refs.stageLoopAdapt.textContent = "No adjustments";
        updateStageLoopPhaseRail("listening");
        refs.stageLoopPhaseHint.textContent = "Waiting for a source to analyze.";
        refs.stageLoopVariationHint.textContent = "4-bar loop - one small change at the boundary.";
        refs.stageLoopDeck.textContent = "No active instruments";
        refs.stageLoopDeckList.innerHTML = "";
      }
      refs.stageLoopFill.style.width = "0%";
      setMonitorMetric(refs.stageLoopTempoValue, refs.stageLoopTempoFill, state.jammerEngine.state.tempo, 180, "");
      setMonitorMetric(refs.stageLoopIntensityValue, refs.stageLoopIntensityFill, state.jammerEngine.state.intensity, 100, "");
      setMonitorMetric(refs.stageLoopDensityValue, refs.stageLoopDensityFill, state.jammerEngine.state.density, 100, "");
      setMonitorMetric(refs.stageLoopSwingValue, refs.stageLoopSwingFill, state.jammerEngine.state.swing, 100, "");
      setMonitorMetric(refs.stageLoopHumanizeValue, refs.stageLoopHumanizeFill, state.jammerEngine.state.humanize, 100, "");
      refs.stageLoopRhythm.innerHTML = "";
      return;
    }

    const patternLabel = loopState.pattern.startsWith("lab-jam:")
      ? loopState.pattern.replace("lab-jam:", "Lab Jam - ")
      : loopState.pattern;
    refs.stageLoopStatus.textContent = loopState.pattern.startsWith("lab-jam:") ? "Looping" : formatPhaseLabel(adaptiveState.phase || "supporting");
    refs.stageLoopPattern.textContent = patternLabel;
    refs.stageLoopPosition.textContent = `Bar ${loopState.currentBar} - Step ${loopState.stepInBar} / 16`;
    refs.stageLoopEvents.textContent = loopState.currentVoices.length > 0
      ? loopState.currentVoices.join(" - ")
      : loopState.currentEvents.length > 0
        ? loopState.currentEvents.join(" - ")
        : "Rest";
    refs.stageLoopEar.textContent = state.essentiaSummary.ready
      ? `${state.essentiaSummary.tempo > 0 ? `${state.essentiaSummary.tempo} BPM` : "Tempo scanning"} - ${state.essentiaSummary.confidence}% conf - ${Math.round((state.essentiaSummary.energy || 0) * 100)}% energy`
      : "Waiting for source";

    refs.stageLoopAdapt.textContent = state.toneDrumBusSummary.pattern === "reactive-kit"
      ? `${formatSectionLabel(adaptiveState.sectionState)} - Tempo ${adaptiveState.tempo} - Int ${adaptiveState.intensity} - Den ${adaptiveState.density} - Swing ${adaptiveState.swing} - Hum ${adaptiveState.humanize}`
      : "Manual lab shaping";
    updateStageLoopPhaseRail(loopState.pattern.startsWith("lab-jam:") ? "supporting" : (adaptiveState.phase || "supporting"));
    refs.stageLoopPhaseHint.textContent = loopState.pattern.startsWith("lab-jam:")
      ? `Free loop - bar ${loopState.currentBar} of ${Number(adaptiveState.bars || 4)} - steady lab playback`
      : `${formatPhaseLabel(adaptiveState.phase || "supporting")} - ${formatSectionLabel(adaptiveState.sectionState)} - entry level ${adaptiveState.entryLevel || 0} - anchor ${adaptiveState.anchorPulseCount || 0}/6`;
    refs.stageLoopVariationHint.textContent = `${Number(adaptiveState.bars || 4)}-bar loop - one small change only at the next loop boundary`;
    refs.stageLoopFill.style.width = `${Math.max(0, Math.min(100, loopState.progress * 100))}%`;
    refs.stageLoopTempoValue.textContent = formatMonitorDelta(state.jammerEngine.state.tempo, adaptiveState.tempo);
    refs.stageLoopIntensityValue.textContent = formatMonitorDelta(state.jammerEngine.state.intensity, adaptiveState.intensity);
    refs.stageLoopDensityValue.textContent = formatMonitorDelta(state.jammerEngine.state.density, adaptiveState.density);
    refs.stageLoopSwingValue.textContent = formatMonitorDelta(state.jammerEngine.state.swing, adaptiveState.swing);
    refs.stageLoopHumanizeValue.textContent = formatMonitorDelta(state.jammerEngine.state.humanize, adaptiveState.humanize);
    refs.stageLoopTempoFill.style.width = `${(Math.max(60, Math.min(180, adaptiveState.tempo)) / 180) * 100}%`;
    refs.stageLoopIntensityFill.style.width = `${Math.max(0, Math.min(100, adaptiveState.intensity))}%`;
    refs.stageLoopDensityFill.style.width = `${Math.max(0, Math.min(100, adaptiveState.density))}%`;
    refs.stageLoopSwingFill.style.width = `${Math.max(0, Math.min(100, adaptiveState.swing))}%`;
    refs.stageLoopHumanizeFill.style.width = `${Math.max(0, Math.min(100, adaptiveState.humanize))}%`;
    renderStageLoopRhythm(loopState);
    renderStageLoopDeck(state.toneDrumBus.getDeckSnapshot());
  }

  function placeJammerRuntimePanels() {
    if (!refs.jammerRuntimeSection) {
      return;
    }

    if (refs.jammerStrategyPanel && refs.jammerStrategyPanel.parentElement !== refs.jammerRuntimeSection) {
      refs.jammerRuntimeSection.appendChild(refs.jammerStrategyPanel);
    }

    if (refs.jammerDetectionExperimentMount && refs.jammerDetectionExperimentMount.parentElement !== refs.jammerRuntimeSection) {
      refs.jammerRuntimeSection.appendChild(refs.jammerDetectionExperimentMount);
    }

    if (refs.jammerDetectionCard && refs.jammerDetectionCard.parentElement !== refs.jammerRuntimeSection) {
      refs.jammerRuntimeSection.appendChild(refs.jammerDetectionCard);
    }

    if (refs.stageLoopMonitor && refs.stageLoopMonitor.parentElement !== refs.jammerRuntimeSection) {
      refs.jammerRuntimeSection.appendChild(refs.stageLoopMonitor);
    }

    if (refs.jammerLabPanel && refs.jammerLabPanel.parentElement !== refs.jammerRuntimeSection) {
      refs.jammerRuntimeSection.appendChild(refs.jammerLabPanel);
    }
  }

  function refreshRuntimeFields() {
    const state = getState();
    const snapshot = state.jammerEngine.getStatusSnapshot();
    const detectionActive = state.detectionActive;
    refs.jammerStatusPill.textContent = snapshot.readiness;
    refs.jammerSummary.textContent = snapshot.summary;
    if (refs.jammerDetectionPanelStatus) {
      const timingLabel = refs.jammerTimingModelSelect?.value === "particle" ? "Clock Particle" : "Clock Kalman";
      refs.jammerDetectionPanelStatus.textContent = detectionActive
        ? `On - ${timingLabel}`
        : `Off - ${timingLabel}`;
    }
    if (refs.jammerModuleContributionsStatus) {
      const detectorMode = refs.jammerDetectorModeSelect?.value || "fusion";
      const modeLabel = detectorMode === "aubio"
        ? "Aubio"
        : detectorMode === "essentia"
          ? "Essentia"
          : "Fusion";
      const gridLabel = detectionActive ? (state.detectionSummary.gridState || "Searching") : "Off";
      refs.jammerModuleContributionsStatus.textContent = `${modeLabel} - ${gridLabel}`;
    }
    if (refs.jammerLabPanelStatus) {
      const deckSnapshot = state.toneDrumBus.getDeckSnapshot();
      const activeDeck = deckSnapshot.filter((entry) => entry.enabled).length;
      refs.jammerLabPanelStatus.textContent = deckSnapshot.length === 0
        ? "Deck empty"
        : `${activeDeck}/${deckSnapshot.length} active`;
    }
    if (refs.jammerDrummerSelect) {
      refs.jammerDrummerSelect.title = snapshot.summary;
    }
    refs.jammerRouteValue.textContent = snapshot.routeLabel;
    refs.jammerPatternValue.textContent = snapshot.patternLabel;
    refs.jammerLaneValue.textContent = snapshot.laneLabel;
    refs.jammerToneValue.textContent = `v${state.toneDrumBusSummary.version} - ${state.toneDrumBusSummary.started ? "ready" : "installed"}`;
    refs.jammerEarValue.textContent = state.essentiaSummary.installed
      ? `Ess ${state.essentiaSummary.ready ? "ready" : "installed"} - Aub ${state.aubioSummary.installed ? (state.aubioSummary.ready ? "ready" : "installed") : "missing"}`
      : "Missing";
    refs.jammerPulseValue.textContent = state.detectionSummary.tempo > 0
      ? `${state.detectionSummary.tempo} BPM - ${state.detectionSummary.confidence}%`
      : state.detectionSummary.sourceMode !== "none"
        ? `${Math.round((state.detectionSummary.energy || 0) * 100)}% energy`
        : "Waiting";
    refs.jammerMaskValue.textContent = state.toneDrumBusSummary.analysisReferenceReady ? "Bus ready" : "Pending";
    refs.jammerDetectionToggleButton.classList.toggle("active", state.detectionEnabled || state.jammerEngine.state.enabled);
    if (refs.jammerTimingModelSelect) {
      refs.jammerTimingModelSelect.value = state.detectionSummary.timingModel || "kalman";
    }
    refs.jammerDetectionToggleButton.setAttribute("aria-pressed", String(state.detectionEnabled || state.jammerEngine.state.enabled));
    refs.jammerDetectionToggleButton.disabled = state.jammerEngine.state.enabled;
    refs.jammerDetectionToggleButton.setAttribute(
      "aria-label",
      state.jammerEngine.state.enabled
        ? "Detection linked to drummer"
        : state.detectionEnabled
          ? "Stop detection"
          : "Start detection"
    );
    refs.jammerDetectionToggleButton.title = state.jammerEngine.state.enabled
      ? "Detection linked to drummer"
      : state.detectionEnabled
        ? "Stop detection"
        : "Start detection";
    if (refs.jammerModuleContributionsToggleButton) {
      const collapsed = Boolean(state.moduleContributionsCollapsed);
      refs.jammerModuleContributionsToggleButton.setAttribute("aria-expanded", String(!collapsed));
      refs.jammerModuleContributionsToggleButton.setAttribute("aria-label", collapsed ? "Expand module contributions" : "Collapse module contributions");
      refs.jammerModuleContributionsToggleButton.title = collapsed ? "Expand module contributions" : "Collapse module contributions";
      refs.jammerModuleContributionsToggleButton.classList.toggle("active", !collapsed);
    }
    if (refs.jammerModuleContributionsPanelBody) {
      refs.jammerModuleContributionsPanelBody.classList.toggle("hidden", Boolean(state.moduleContributionsCollapsed));
    }
    refs.jammerDetectionState.textContent = !detectionActive
      ? "Off"
      : (state.detectionSummary.statusLabel || "Waiting");
    refs.jammerDetectionSource.textContent = state.detectionSummary.sourceMode || "none";
    refs.jammerDetectionTempo.textContent = state.detectionSummary.tempo > 0 ? `${state.detectionSummary.tempo} BPM` : "0 BPM";
    refs.jammerDetectionConfidence.textContent = `${Math.round(Number(state.detectionSummary.confidence || 0))}%`;
    refs.jammerDetectionZcr.textContent = Number(state.detectionSummary.grooveConvergence || 0).toFixed(0);
    refs.jammerDetectionSummary.textContent = !detectionActive
      ? "Detection is idle. Start Detection to listen without enabling the drummer."
      : (state.detectionSummary.summary || "Waiting for a live route.");
    refs.jammerDetectionAubio.textContent = !detectionActive
      ? "Off"
      : !state.aubioSummary.installed
        ? "Not available"
        : state.aubioSummary.ready
          ? `${state.detectionSummary.aubioTempo > 0 ? `${state.detectionSummary.aubioTempo} BPM` : "Pulse scan"} - ${Math.round(Number(state.detectionSummary.aubioConfidence || 0))}%`
          : state.aubioSummary.statusLabel === "Error"
            ? "Error"
            : "Warming up";
    refs.jammerDetectionEssentia.textContent = !detectionActive
      ? "Off"
      : !state.essentiaSummary.installed
        ? "Not available"
        : state.essentiaSummary.ready
          ? `${state.detectionSummary.essentiaStableTempo > 0 ? `${state.detectionSummary.essentiaStableTempo} BPM stable` : `${state.detectionSummary.essentiaTempo || 0} BPM`} - ${Math.round(Number(state.detectionSummary.essentiaAnchorConfidence || 0))}% anchor`
          : state.essentiaSummary.statusLabel === "Error"
            ? "Error"
            : "Warming up";
    refs.jammerDetectionFusion.textContent = !detectionActive
      ? "Off"
      : `${Math.round(Number(state.detectionSummary.tempoAgreement || 0))}% agreement - ${state.detectionSummary.pllState || "Searching"} - ${Math.round(Number(state.detectionSummary.pllLock || 0))}% lock - ${state.detectionSummary.windowMode || "wide-listen"}`;
    refs.jammerDetectionStability.textContent = !detectionActive
      ? "0%"
      : `${Math.round(Number(state.detectionSummary.stability || 0) * 100)}%`;
    refs.jammerDetectionAgreement.textContent = !detectionActive
      ? "0%"
      : `${Math.round(Number(state.detectionSummary.tempoAgreement || 0))}%`;
    refs.jammerDetectionGridState.textContent = !detectionActive
      ? "Off"
      : (state.detectionSummary.pllState || "Searching");

    const adaptiveState = state.adaptiveState;
    const energyPercent = detectionActive ? Math.max(0, Math.min(100, Math.round((state.detectionSummary.energy || 0) * 100))) : 0;
    const onsetPercent = detectionActive ? Math.max(0, Math.min(100, Math.round((state.detectionSummary.onset || 0) * 100))) : 0;
    const lockPercent = detectionActive
      ? Math.max(0, Math.min(100, Math.round(Number(state.detectionSummary.barAnchorConfidence || 0))))
      : 0;
    refs.jammerDetectionEnergyValue.textContent = `${energyPercent}%`;
    refs.jammerDetectionOnsetValue.textContent = `${onsetPercent}%`;
    refs.jammerDetectionLockValue.textContent = `${lockPercent}%`;
    refs.jammerDetectionEnergyFill.style.width = `${energyPercent}%`;
    refs.jammerDetectionOnsetFill.style.width = `${onsetPercent}%`;
    refs.jammerDetectionLockFill.style.width = `${lockPercent}%`;
    refs.jammerDetectionNormalize.textContent = !detectionActive
      ? "0%"
      : `${Math.round(Number(state.detectionSummary.preprocessNormalized || 0))}% x${Number(state.detectionSummary.preprocessGain || 1).toFixed(2)}`;
    refs.jammerDetectionNormalize.title = !detectionActive
      ? "Signal normalization is idle."
      : `Normalized level ${Math.round(Number(state.detectionSummary.preprocessNormalized || 0))}% with gain factor x${Number(state.detectionSummary.preprocessGain || 1).toFixed(2)} before beat analysis.`;
    refs.jammerDetectionFlux.textContent = !detectionActive
      ? "0%"
      : `${Math.round(Number(state.detectionSummary.preprocessFlux || 0))}%`;
    refs.jammerDetectionFlux.title = !detectionActive
      ? "Spectral flux is idle."
      : `Spectral flux ${Math.round(Number(state.detectionSummary.preprocessFlux || 0))}%. Higher values mean stronger frame-to-frame change in the spectrum.`;
    refs.jammerDetectionLowBand.textContent = !detectionActive
      ? "0%"
      : `${Math.round(Number(state.detectionSummary.preprocessLow || 0))}%`;
    refs.jammerDetectionLowBand.title = !detectionActive
      ? "Low band analysis is idle."
      : `Low band energy ${Math.round(Number(state.detectionSummary.preprocessLow || 0))}%. This is where kick and downbeat clues usually appear.`;
    refs.jammerDetectionMidBand.textContent = !detectionActive
      ? "0%"
      : `${Math.round(Number(state.detectionSummary.preprocessMid || 0))}%`;
    refs.jammerDetectionMidBand.title = !detectionActive
      ? "Mid band analysis is idle."
      : `Mid band energy ${Math.round(Number(state.detectionSummary.preprocessMid || 0))}%. This often carries snare and backbeat information.`;
    refs.jammerDetectionHighBand.textContent = !detectionActive
      ? "0%"
      : `${Math.round(Number(state.detectionSummary.preprocessHigh || 0))}%`;
    refs.jammerDetectionHighBand.title = !detectionActive
      ? "High band analysis is idle."
      : `High band energy ${Math.round(Number(state.detectionSummary.preprocessHigh || 0))}%. This helps detect hats and finer subdivisions.`;
    refs.jammerDetectionBandPulse.textContent = !detectionActive
      ? "L 0 / M 0 / H 0"
      : `L ${Math.round(Number(state.detectionSummary.preprocessLowOnset || 0))} / M ${Math.round(Number(state.detectionSummary.preprocessMidOnset || 0))} / H ${Math.round(Number(state.detectionSummary.preprocessHighOnset || 0))}`;
    refs.jammerDetectionBandPulse.title = !detectionActive
      ? "Band pulse is idle."
      : `Transient pulse by band. Low ${Math.round(Number(state.detectionSummary.preprocessLowOnset || 0))}, mid ${Math.round(Number(state.detectionSummary.preprocessMidOnset || 0))}, high ${Math.round(Number(state.detectionSummary.preprocessHighOnset || 0))}.`;
    const baseTempo = Number(state.jammerEngine.state.tempo || 104);
    const baseDensity = Number(state.jammerEngine.state.density || 48);
    const confidenceRatio = Math.max(0, Math.min(1, Number(state.detectionSummary.confidence || 0) / 100));
    const energyRatio = Math.max(0, Math.min(1, Number(state.detectionSummary.energy || 0)));
    const onsetRatio = Math.max(0, Math.min(1, Number(state.detectionSummary.onset || 0)));
    const resolvedSource = state.jammerEngine.getResolvedSource();
    const liveFollow = snapshot.profile.id === "reactive-kit"
      && state.jammerEngine.state.enabled
      && (resolvedSource === "player" || resolvedSource === "microphone-live");
    const tempoCorrection = adaptiveState.tempo - baseTempo;
    const densityBoost = adaptiveState.density - baseDensity;
    const fillProbability = liveFollow
      ? Math.max(0, Math.min(100, Math.round(
        (onsetRatio * 42)
        + (energyRatio * 26)
        + (confidenceRatio * 18)
        + (Math.max(0, densityBoost) * 0.45)
      )))
      : 0;
    const entryConfidence = liveFollow
      ? Math.max(0, Math.min(100, Math.round(
        (confidenceRatio * 72)
        + (energyRatio * 16)
        + (onsetRatio * 12)
      )))
      : 0;

    refs.jammerDecisionTempo.textContent = formatSignedValue(tempoCorrection, " BPM");
    refs.jammerDecisionDensity.textContent = formatSignedValue(densityBoost, "%");
    refs.jammerDecisionFill.textContent = `${fillProbability}%`;
    refs.jammerDecisionEntry.textContent = `${entryConfidence}%`;
    refs.jammerDecisionMode.textContent = !detectionActive
      ? "Detection off"
      : liveFollow
        ? (adaptiveState.phase ? formatPhaseLabel(adaptiveState.phase) : `${resolvedSource === "player" ? "Following player" : "Following mic"}`)
        : (state.jammerLabJamRunning ? "Free loop" : "Standby");
    refs.jammerDecisionSection.textContent = !detectionActive
      ? "Standby"
      : `${formatSectionLabel(state.detectionSummary.structureSection || "unknown")} -> ${formatSectionLabel(state.detectionSummary.structureNextSection || "unknown")}`;
    refs.jammerDecisionBars.textContent = `${Number(adaptiveState.bars || 4)} bars`;
    if (detectionActive && state.detectionSummary.structureExpectedLength) {
      refs.jammerDecisionBars.textContent = `${Number(state.detectionSummary.structureBarsIntoSection || 0)}/${Number(state.detectionSummary.structureExpectedLength || 8)} - ${Number(state.detectionSummary.structureBarsToTransition || 0)} to go`;
      refs.jammerDecisionBars.title = `${Math.round(Number(state.detectionSummary.structureTransitionConfidence || 0))}% chance of moving toward ${formatSectionLabel(state.detectionSummary.structureNextSection || "unknown")} - action ${String(state.detectionSummary.structureSuggestedAction || "steady_support").replaceAll("_", " ")}`;
    } else {
      refs.jammerDecisionBars.title = "Waiting for a stable structural reading.";
    }
    refs.jammerDetectionGridTempo.textContent = !detectionActive || !state.detectionSummary.tempo
      ? "0 BPM"
      : `${state.detectionSummary.tempo} BPM`;
    refs.jammerDetectionGridBeat.textContent = !detectionActive
      ? "0 / 4"
      : `${state.detectionSummary.beatInBar || state.detectionSummary.phase || 0} / 4`;
    refs.jammerDetectionGridAnchor.textContent = !detectionActive
      ? "0%"
      : `${Math.round(Number(state.detectionSummary.barAnchorConfidence || 0))}%`;
    refs.jammerDetectionGridStability.textContent = !detectionActive
      ? "0%"
      : `${Math.round(Number(state.detectionSummary.stability || 0) * 100)}%`;
    refs.jammerDetectionGridPll.textContent = !detectionActive
      ? "Waiting"
      : `${state.detectionSummary.pllState || "Searching"} - ${Math.round(Number(state.detectionSummary.pllLock || 0))}% lock`;
    refs.jammerDetectionGridWindows.textContent = !detectionActive
      ? "F 0 / M 0 / L 0"
      : `F ${state.detectionSummary.fastTempo || 0} / M ${state.detectionSummary.mediumTempo || 0} / L ${state.detectionSummary.longTempo || 0}`;
    refs.jammerDetectionGridTempo.title = !detectionActive
      ? "The fused beat grid is idle."
      : "Current tempo of the fused internal grid.";
    refs.jammerDetectionGridBeat.title = !detectionActive
      ? "Current beat position is idle."
      : "Current beat position inside the estimated 4-beat bar.";
    refs.jammerDetectionGridAnchor.title = !detectionActive
      ? "Bar anchor is idle."
      : "Confidence that the system has found beat 1 of the bar.";
    refs.jammerDetectionGridStability.title = !detectionActive
      ? "Grid stability is idle."
      : "How stable the internal rhythmic grid currently is.";
    refs.jammerDetectionGridPll.title = !detectionActive
      ? "PLL state is idle."
      : `Adaptive lock state, phase error ${state.detectionSummary.phaseErrorMs || 0} ms, innovation ${state.detectionSummary.innovationMs || 0} ms${state.detectionSummary.outlierRejected ? ", outlier rejected" : ""}.`;
    refs.jammerDetectionGridWindows.title = !detectionActive
      ? "Window analysis is idle."
      : `Tempo snapshots from fast, medium and long listening windows. Active hypothesis: ${state.detectionSummary.activeHypothesis || "normal"}, window mode ${state.detectionSummary.windowMode || "wide-listen"}.`;
    renderDetectionBeatGrid(state);
    renderSongAnalysis(state);
    renderBpmBenchmark(state);
    renderDetectionExperiment(state);
  }

  return {
    placeJammerRuntimePanels,
    refreshRuntimeFields,
    updateStageLoopMonitor,
  };
}
