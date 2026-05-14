function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export function createDetectorCalibrationModuleState(moduleKey = "aubio") {
  return {
    moduleKey,
    samples: 0,
    tempoHitCount: 0,
    tempoDeltaTotal: 0,
    confidenceTotal: 0,
    anchorTotal: 0,
    stabilityTotal: 0,
    agreementTotal: 0,
    beatPulseCount: 0,
  };
}

export function createDetectorCalibrationTestState({ mode = "comparison", songId = "" } = {}) {
  return {
    active: false,
    songId,
    mode,
    runType: "comparison",
    targetModule: "",
    samples: 0,
    tempoDeltaTotal: 0,
    aubioTempoDeltaTotal: 0,
    essentiaTempoDeltaTotal: 0,
    anchorTotal: 0,
    agreementTotal: 0,
    stabilityTotal: 0,
    leaderCounts: { aubio: 0, essentia: 0, fusion: 0 },
    startedAt: 0,
    completedAt: 0,
    savedToHistory: false,
    moduleStats: {
      aubio: createDetectorCalibrationModuleState("aubio"),
      essentia: createDetectorCalibrationModuleState("essentia"),
    },
  };
}

export function createDetectorCalibrationProgressState(label = "Idle") {
  return {
    progress: 0,
    label,
  };
}

export function getDetectorCalibrationAverages(test) {
  const samples = Math.max(1, Number(test?.samples || 0));
  return {
    tempoDelta: Number(test?.tempoDeltaTotal || 0) / samples,
    aubioTempoDelta: Number(test?.aubioTempoDeltaTotal || 0) / samples,
    essentiaTempoDelta: Number(test?.essentiaTempoDeltaTotal || 0) / samples,
    anchor: Number(test?.anchorTotal || 0) / samples,
    agreement: Number(test?.agreementTotal || 0) / samples,
    stability: Number(test?.stabilityTotal || 0) / samples,
  };
}

export function getDetectorCalibrationModuleAverages(moduleState) {
  const samples = Math.max(1, Number(moduleState?.samples || 0));
  return {
    tempoDelta: Number(moduleState?.tempoDeltaTotal || 0) / samples,
    tempoCoverage: (Number(moduleState?.tempoHitCount || 0) / samples) * 100,
    confidence: Number(moduleState?.confidenceTotal || 0) / samples,
    anchor: Number(moduleState?.anchorTotal || 0) / samples,
    agreement: Number(moduleState?.agreementTotal || 0) / samples,
    stability: Number(moduleState?.stabilityTotal || 0) / samples,
    beatPulse: Number(moduleState?.beatPulseCount || 0) / samples,
  };
}

export function computeDetectorCalibrationModuleScore({ analysis, moduleState, moduleKey, detectionSummary }) {
  if (!analysis || !moduleState?.samples) {
    return 0;
  }
  const averages = getDetectorCalibrationModuleAverages(moduleState);
  const tempoScore = clamp(100 - (Math.abs(averages.tempoDelta) * 8), 0, 100);
  const confidenceScore = clamp(averages.confidence, 0, 100);
  const anchorScore = clamp(
    moduleKey === "aubio"
      ? Math.max(averages.anchor, averages.beatPulse * 100)
      : averages.anchor,
    0,
    100,
  );
  const stabilityScore = clamp(averages.stability, 0, 100);
  const coverageScore = clamp(averages.tempoCoverage, 0, 100);
  const phrasePenalty = Number(detectionSummary?.phraseBars || 0) === Number(analysis?.phraseBars || 0) ? 0 : 10;
  return Math.round(clamp(
    (tempoScore * 0.3)
    + (confidenceScore * 0.18)
    + (anchorScore * 0.24)
    + (stabilityScore * 0.16)
    + (coverageScore * 0.12)
    - phrasePenalty,
    1,
    100,
  ));
}

export function computeDetectorCalibrationScore({ analysis, test, detectionSummary }) {
  if (!analysis || !test?.samples) {
    return 0;
  }
  const averages = getDetectorCalibrationAverages(test);
  const tempoScore = clamp(100 - (Math.abs(averages.tempoDelta) * 8), 0, 100);
  const anchorScore = clamp(averages.anchor, 0, 100);
  const agreementScore = clamp(averages.agreement, 0, 100);
  const stabilityScore = clamp(averages.stability, 0, 100);
  const phrasePenalty = Number(detectionSummary?.phraseBars || 0) === Number(analysis?.phraseBars || 0) ? 0 : 12;
  return Math.round(clamp(
    (tempoScore * 0.34)
    + (anchorScore * 0.26)
    + (agreementScore * 0.18)
    + (stabilityScore * 0.22)
    - phrasePenalty,
    1,
    100,
  ));
}

export function getDetectorCalibrationModuleSuggestionConfig({ analysis, moduleState, moduleKey }) {
  const averages = getDetectorCalibrationModuleAverages(moduleState);
  const detectorMode = moduleKey === "aubio" ? "aubio" : "essentia";
  const timingModel = (
    averages.stability < 56
    || averages.anchor < (moduleKey === "aubio" ? 42 : 52)
    || Math.abs(averages.tempoDelta) > 4.5
    || averages.tempoCoverage < 42
  ) ? "kalman" : "particle";
  const tweaks = moduleKey === "aubio"
    ? {
      listenBias: averages.confidence < 46 ? "longer" : "balanced",
      beatPulseWeight: averages.beatPulse < 0.38 ? "higher" : "steady",
      outlierRejection: averages.stability < 58 ? "stronger" : "steady",
    }
    : {
      anchorWeight: averages.anchor < 56 ? "higher" : "steady",
      phraseMemory: Math.abs(averages.tempoDelta) > 4 ? "longer" : "steady",
      harmonicWeight: averages.confidence < 52 ? "higher" : "steady",
    };
  return { detectorMode, timingModel, tweaks };
}

export function getDetectorCalibrationSuggestedModule({ analysis, test }) {
  if (!analysis || !test?.samples) {
    return "Waiting";
  }
  const averages = getDetectorCalibrationAverages(test);
  const aubioDelta = Math.abs(averages.aubioTempoDelta || 999);
  const essentiaDelta = Math.abs(averages.essentiaTempoDelta || 999);
  if (aubioDelta + 1.2 < essentiaDelta) {
    return "Aubio";
  }
  if (essentiaDelta + 1.2 < aubioDelta) {
    return "Essentia";
  }
  return averages.anchor >= 56 ? "Essentia" : "Aubio";
}

export function getDetectorCalibrationSuggestionConfig({ analysis, test }) {
  const suggestedModule = getDetectorCalibrationSuggestedModule({ analysis, test });
  const averages = getDetectorCalibrationAverages(test);
  const detectorMode = ({
    Aubio: "aubio",
    Essentia: "essentia",
  }[suggestedModule]) || "aubio";
  const timingModel = (
    averages.stability < 56
    || averages.anchor < 52
    || Math.abs(averages.tempoDelta) > 4.5
  ) ? "kalman" : "particle";
  return { detectorMode, timingModel };
}

export function buildLiveSongAnalysisRecommendations({ analysis, detectionSummary }) {
  if (!analysis) {
    return [];
  }

  const recommendations = [];
  const liveTempo = Number(detectionSummary?.tempo || 0);
  const referenceTempo = Number(analysis?.tempo || 0);
  if (liveTempo > 0 && referenceTempo > 0) {
    const delta = Math.abs(liveTempo - referenceTempo);
    if (delta > 6) {
      recommendations.push("Il tempo live sta inseguendo troppo o con troppo ritardo: conviene aumentare inerzia e peso della finestra media.");
    } else if (delta > 3) {
      recommendations.push("La griglia live è quasi vicina ma ancora larga sul BPM: conviene un lock più prudente prima dell’ingresso del drummer.");
    }
  }

  if (Number(detectionSummary?.barAnchorConfidence || 0) < 52) {
    recommendations.push("Il beat 1 è ancora poco chiaro: conviene aumentare il peso della low band e della memoria di battuta.");
  }

  if (Number(detectionSummary?.tempoAgreement || 0) < 58) {
    recommendations.push("Aubio ed Essentia non concordano ancora bene: può aiutare usare un solo detector o allungare il periodo di ascolto iniziale.");
  }

  if (Number(detectionSummary?.phraseBars || 4) !== Number(analysis?.phraseBars || 4)) {
    recommendations.push("La memoria di frase live non coincide con quella del file completo: conviene aumentare la section memory e ridurre le correzioni premature.");
  }

  if ((detectionSummary?.structureSection || "unknown") === "unknown" && analysis?.structure?.currentSection) {
    recommendations.push("La forma del brano è ancora poco leggibile in live: conviene dare più peso alla struttura lenta e ai cambi armonici.");
  }

  return recommendations.length > 0
    ? recommendations
    : ["La detection live è già abbastanza vicina al riferimento offline. Ora i miglioramenti possono essere più fini e musicali."];
}

export function buildDetectorCalibrationRecommendations({ analysis, test, detectionSummary }) {
  const recommendations = buildLiveSongAnalysisRecommendations({ analysis, detectionSummary });
  if (!analysis || !test?.samples) {
    return recommendations;
  }

  const averages = getDetectorCalibrationAverages(test);
  const suggestedModule = getDetectorCalibrationSuggestedModule({ analysis, test });

  if (Math.abs(averages.tempoDelta) > 5) {
    recommendations.push("Il clock live arriva ancora troppo distante dal riferimento completo: conviene aumentare l’inerzia della PLL e lasciare più tempo alla finestra media.");
  }
  if (averages.anchor < 54) {
    recommendations.push("L’aggancio al beat 1 resta debole anche durante la riproduzione del file noto: serve più peso alla low band e un ingresso ancora più prudente della griglia.");
  }
  if (averages.stability < 58) {
    recommendations.push("La griglia non si stabilizza abbastanza presto: conviene ridurre le correzioni di fase troppo frequenti e aumentare hysteresis/outlier rejection.");
  }
  if (suggestedModule === "Aubio") {
    recommendations.push("Su questo brano Aubio sembra anticipare meglio la pulsazione: per il test live conviene provarlo da solo o come riferimento principale.");
  } else if (suggestedModule === "Essentia") {
    recommendations.push("Su questo brano Essentia sembra costruire una griglia più credibile: conviene darle più peso o lavorare solo con Essentia.");
  } else {
    recommendations.push("I due moduli sono vicini: conviene comunque tenerli confrontati separatamente e scegliere quello che aggancia prima la grid reale del brano.");
  }

  return Array.from(new Set(recommendations));
}

export function buildDetectorCalibrationModuleRecommendations({ analysis, moduleState, moduleKey, detectionSummary }) {
  if (!analysis) {
    return [];
  }
  const recommendations = [];
  if (!moduleState?.samples) {
    return ["Avvia il playback test per misurare questo modulo rispetto al file già analizzato."];
  }

  const averages = getDetectorCalibrationModuleAverages(moduleState);
  if (Math.abs(averages.tempoDelta) > 5) {
    recommendations.push("Il tempo medio resta lontano dal riferimento: conviene rallentare le correzioni e lasciare più tempo al lock iniziale.");
  }
  if (moduleKey === "aubio") {
    if (averages.confidence < 48) {
      recommendations.push("Aubio sta leggendo impulsi deboli: conviene allungare il tempo di ascolto iniziale e dare più importanza ai transienti puliti.");
    }
    if (averages.beatPulse < 0.34) {
      recommendations.push("Il pulse di Aubio è ancora intermittente: conviene renderlo più prudente sui trigger isolati e più stabile sui colpi ricorrenti.");
    }
    if (averages.anchor < 42) {
      recommendations.push("Aubio fatica a capire dov’è l’uno: conviene aumentare il peso della banda bassa e della memoria dei downbeat.");
    }
  } else {
    if (averages.anchor < 56) {
      recommendations.push("Essentia vede ancora un beat 1 debole: conviene aumentare il peso dell’anchor armonico e della low band.");
    }
    if (averages.confidence < 52) {
      recommendations.push("Essentia sta ancora costruendo la griglia con poca sicurezza: conviene rafforzare finestra media, phrase memory e stabilità lenta.");
    }
    if (Number(detectionSummary?.harmonicChange || 0) < 18) {
      recommendations.push("Il supporto armonico è poco incisivo: conviene dare più peso ai cambi armonici lenti per stabilizzare le frasi.");
    }
  }
  if (averages.stability < 58) {
    recommendations.push("La griglia resta nervosa: conviene aumentare hysteresis e outlier rejection per evitare correzioni premature.");
  }

  return Array.from(new Set(recommendations)).slice(0, 4);
}
