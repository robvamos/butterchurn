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

          if (detectionActive && currentFlatIndex >= 0 && flatIndex === currentFlatIndex) {
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
    refs.jammerDetectionFlux.textContent = !detectionActive
      ? "0%"
      : `${Math.round(Number(state.detectionSummary.preprocessFlux || 0))}%`;
    refs.jammerDetectionLowBand.textContent = !detectionActive
      ? "0%"
      : `${Math.round(Number(state.detectionSummary.preprocessLow || 0))}%`;
    refs.jammerDetectionMidBand.textContent = !detectionActive
      ? "0%"
      : `${Math.round(Number(state.detectionSummary.preprocessMid || 0))}%`;
    refs.jammerDetectionHighBand.textContent = !detectionActive
      ? "0%"
      : `${Math.round(Number(state.detectionSummary.preprocessHigh || 0))}%`;
    refs.jammerDetectionBandPulse.textContent = !detectionActive
      ? "L 0 / M 0 / H 0"
      : `L ${Math.round(Number(state.detectionSummary.preprocessLowOnset || 0))} / M ${Math.round(Number(state.detectionSummary.preprocessMidOnset || 0))} / H ${Math.round(Number(state.detectionSummary.preprocessHighOnset || 0))}`;
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
      : formatSectionLabel(adaptiveState.sectionState);
    refs.jammerDecisionBars.textContent = `${Number(adaptiveState.bars || 4)} bars`;
    refs.jammerDetectionGridHint.textContent = !detectionActive
      ? "Detection is off."
      : state.detectionSummary.tempo > 0
        ? `Grid around ${state.detectionSummary.tempo} BPM, beat ${state.detectionSummary.beatInBar || state.detectionSummary.phase || 0} of 4, anchor ${Math.round(Number(state.detectionSummary.barAnchorConfidence || 0))}%, stability ${Math.round(Number(state.detectionSummary.stability || 0) * 100)}%, PLL ${state.detectionSummary.pllState || "Searching"} at ${Math.round(Number(state.detectionSummary.pllLock || 0))}% lock. F ${state.detectionSummary.fastTempo || 0} / M ${state.detectionSummary.mediumTempo || 0} / L ${state.detectionSummary.longTempo || 0}, mode ${state.detectionSummary.activeHypothesis || "normal"}, window ${state.detectionSummary.windowMode || "wide-listen"}, phase error ${state.detectionSummary.phaseErrorMs || 0} ms, innovation ${state.detectionSummary.innovationMs || 0} ms${state.detectionSummary.outlierRejected ? ", outlier rejected" : ""}.`
        : "Listening for a stable beat grid.";
    renderDetectionBeatGrid(state);
  }

  return {
    placeJammerRuntimePanels,
    refreshRuntimeFields,
    updateStageLoopMonitor,
  };
}
