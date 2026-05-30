import {
  buildEnvelopeAnalysis,
  normalizeMonoSignal,
} from "./audioPreprocessing.js";

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function normalizeTempo(bpm) {
  let normalized = Number(bpm);
  if (!Number.isFinite(normalized) || normalized <= 0) {
    return 0;
  }

  while (normalized < 70) {
    normalized *= 2;
  }

  while (normalized > 180) {
    normalized /= 2;
  }

  return Math.round(normalized);
}

function getPreferredTempoWeight(tempo) {
  const safeTempo = Number(tempo || 0);
  if (!safeTempo) {
    return 0;
  }
  if (safeTempo >= 90 && safeTempo <= 130) {
    return 1;
  }
  if (safeTempo >= 84 && safeTempo <= 136) {
    return 0.82;
  }
  if (safeTempo >= 78 && safeTempo <= 142) {
    return 0.62;
  }
  if (safeTempo >= 70 && safeTempo <= 150) {
    return 0.38;
  }
  return 0.18;
}

function average(values) {
  if (!values.length) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function median(values) {
  if (!values.length) {
    return 0;
  }
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

function arrayToMono(audioBuffer) {
  const mono = new Float32Array(audioBuffer.length);
  const channels = audioBuffer.numberOfChannels;
  for (let channel = 0; channel < channels; channel += 1) {
    const data = audioBuffer.getChannelData(channel);
    for (let index = 0; index < audioBuffer.length; index += 1) {
      mono[index] += data[index] / channels;
    }
  }
  return mono;
}

function estimateTempoFromIntervals(intervals = []) {
  if (!intervals.length) {
    return { tempo: 0, confidence: 0 };
  }
  const intervalMedian = median(intervals);
  const tempo = normalizeTempo(60 / intervalMedian);
  const intervalAverage = average(intervals);
  const deviation = Math.sqrt(average(intervals.map((value) => (value - intervalAverage) ** 2)));
  const confidence = Math.round(clamp((1 - (deviation / Math.max(intervalAverage, 0.001))) * 100, 0, 100));
  return { tempo, confidence };
}

function estimateTempoFromBeatTimes(beatTimes = []) {
  if (beatTimes.length < 4) {
    return { tempo: 0, confidence: 0 };
  }
  const intervals = [];
  for (let index = 1; index < beatTimes.length; index += 1) {
    const delta = beatTimes[index] - beatTimes[index - 1];
    if (delta >= 0.18 && delta <= 1.5) {
      intervals.push(delta);
    }
  }
  return estimateTempoFromIntervals(intervals);
}

function autocorrelationAtLag(values, lag) {
  let sum = 0;
  for (let index = lag; index < values.length; index += 1) {
    sum += values[index] * values[index - lag];
  }
  return sum;
}

function estimateTempoFromEnvelope(envelope, frameDuration, { minTempo = 60, maxTempo = 180 } = {}) {
  if (!Array.isArray(envelope) || envelope.length < 32) {
    return { tempo: 0, confidence: 0, lag: 0 };
  }

  let maxValue = 0;
  for (let index = 0; index < envelope.length; index += 1) {
    maxValue = Math.max(maxValue, envelope[index]);
  }
  if (maxValue <= 0.000001) {
    return { tempo: 0, confidence: 0, lag: 0 };
  }

  const normalized = envelope.map((value) => value / maxValue);
  const minLag = Math.max(1, Math.round((60 / maxTempo) / frameDuration));
  const maxLag = Math.max(minLag + 1, Math.round((60 / minTempo) / frameDuration));
  const candidates = [];
  for (let lag = minLag; lag <= maxLag; lag += 1) {
    candidates.push({
      lag,
      correlation: autocorrelationAtLag(normalized, lag),
    });
  }
  candidates.sort((left, right) => right.correlation - left.correlation);
  const best = candidates[0];
  const second = candidates[1] || { correlation: 0 };
  if (!best || best.correlation <= 0) {
    return { tempo: 0, confidence: 0, lag: 0 };
  }

  return {
    tempo: normalizeTempo(60 / (best.lag * frameDuration)),
    confidence: Math.round(clamp(((best.correlation - second.correlation) / Math.max(best.correlation, 0.0001)) * 100, 0, 100)),
    lag: best.lag,
  };
}

function sampleMean(values, start, end) {
  const safeStart = Math.max(0, Math.min(values.length, start));
  const safeEnd = Math.max(safeStart + 1, Math.min(values.length, end));
  let sum = 0;
  for (let index = safeStart; index < safeEnd; index += 1) {
    sum += values[index];
  }
  return sum / (safeEnd - safeStart);
}

function evaluateTempoFit({ tempo, duration, beatTimes = [], envelopeAnalysis }) {
  if (!tempo || tempo < 55 || tempo > 185 || !envelopeAnalysis) {
    return null;
  }

  const barDuration = 240 / tempo;
  const totalBars = Math.max(1, Math.floor(duration / Math.max(barDuration, 0.001)));
  const barsToInspect = Math.min(totalBars, 96);
  const quarterScores = [];
  const backbeatScores = [];
  const tickAlignmentScores = [];

  for (let barIndex = 0; barIndex < barsToInspect; barIndex += 1) {
    const barStartTime = barIndex * barDuration;
    const quarterValues = [];
    const backbeatValues = [];
    for (let quarter = 0; quarter < 4; quarter += 1) {
      const startFrame = Math.floor((barStartTime + ((barDuration / 4) * quarter)) / envelopeAnalysis.frameDuration);
      const endFrame = Math.floor((barStartTime + ((barDuration / 4) * (quarter + 1))) / envelopeAnalysis.frameDuration);
      const lowMean = sampleMean(envelopeAnalysis.lowOnset, startFrame, endFrame);
      const midMean = sampleMean(envelopeAnalysis.midOnset, startFrame, endFrame);
      const highMean = sampleMean(envelopeAnalysis.highOnset, startFrame, endFrame);
      quarterValues.push((lowMean * 0.74) + (highMean * 0.26));
      backbeatValues.push((midMean * 0.62) + (highMean * 0.38));
    }

    const firstQuarter = quarterValues[0];
    const others = average(quarterValues.slice(1));
    quarterScores.push(clamp(firstQuarter / Math.max(others, 0.0001), 0, 3));

    const backbeat = average([backbeatValues[1], backbeatValues[3]]);
    const nonBackbeat = average([backbeatValues[0], backbeatValues[2]]);
    backbeatScores.push(clamp(backbeat / Math.max(nonBackbeat, 0.0001), 0, 3));

    if (beatTimes.length > 0) {
      const quarterLength = barDuration / 4;
      let aligned = 0;
      let total = 0;
      beatTimes.forEach((beatTime) => {
        if (beatTime < barStartTime || beatTime >= (barStartTime + barDuration)) {
          return;
        }
        total += 1;
        const phase = (beatTime - barStartTime) / quarterLength;
        if (Math.abs(phase - Math.round(phase)) <= 0.18) {
          aligned += 1;
        }
      });
      if (total > 0) {
        tickAlignmentScores.push(aligned / total);
      }
    }
  }

  const downbeatBias = average(quarterScores);
  const backbeatBias = average(backbeatScores);
  const tickAlignment = tickAlignmentScores.length ? average(tickAlignmentScores) : 0.5;
  const fitScore = clamp(
    (Math.min(1, downbeatBias / 1.35) * 0.42)
    + (Math.min(1, backbeatBias / 1.2) * 0.22)
    + (tickAlignment * 0.36),
    0,
    1,
  );

  return {
    tempo,
    totalBars,
    barDuration,
    downbeatBias,
    backbeatBias,
    tickAlignment,
    fitScore,
  };
}

function computeAnchorScore(result = {}) {
  const fitScore = clamp(Number(result.fitScore || 0), 0, 1);
  const downbeat = clamp(Number(result.downbeatBias || 0) / 1.35, 0, 1);
  const backbeat = clamp(Number(result.backbeatBias || 0) / 1.2, 0, 1);
  const tickAlignment = clamp(Number(result.tickAlignment || 0), 0, 1);
  const referenceScore = clamp(
    Number(result.referenceFit?.score ?? result.referenceFit?.barScore ?? fitScore),
    0,
    1,
  );

  return clamp(
    (fitScore * 0.3)
    + (downbeat * 0.28)
    + (tickAlignment * 0.22)
    + (referenceScore * 0.14)
    + (backbeat * 0.06),
    0,
    1,
  );
}

function chooseBestTempo(candidates = [], envelopeAnalysis, duration) {
  const ranked = candidates
    .map((candidate) => {
      const fit = evaluateTempoFit({
        tempo: candidate.tempo,
        duration,
        beatTimes: candidate.beatTimes || [],
        envelopeAnalysis,
      });
      if (!fit) {
        return null;
      }
      const preferredTempoWeight = getPreferredTempoWeight(candidate.tempo);
      const combinedScore = (
        (candidate.weight * 0.18)
        + (candidate.confidence * 0.16)
        + (fit.fitScore * 100 * 0.48)
        + (preferredTempoWeight * 100 * 0.18)
      ) * (0.72 + (preferredTempoWeight * 0.28));
      return {
        ...candidate,
        ...fit,
        preferredTempoWeight,
        combinedScore,
      };
    })
    .filter(Boolean)
    .sort((left, right) => right.combinedScore - left.combinedScore);

  const primary = ranked[0];
  const rival = primary
    ? ranked.find((candidate, index) => index > 0 && primary.tempo / Math.max(candidate.tempo, 1) > 1.82 && primary.tempo / Math.max(candidate.tempo, 1) < 2.18)
    : null;

  if (primary && rival) {
    const primaryRhythmicFit = (primary.tickAlignment * 0.42) + (Math.min(1, primary.downbeatBias / 1.35) * 0.32) + (Math.min(1, primary.backbeatBias / 1.2) * 0.26);
    const rivalRhythmicFit = (rival.tickAlignment * 0.42) + (Math.min(1, rival.downbeatBias / 1.35) * 0.32) + (Math.min(1, rival.backbeatBias / 1.2) * 0.26);
    if (rivalRhythmicFit >= primaryRhythmicFit + 0.08 && rival.combinedScore >= primary.combinedScore - 8) {
      return {
        best: rival,
        ranked,
      };
    }
  }

  return {
    best: primary || null,
    ranked,
  };
}

function computeModuleScore({
  knownBpm,
  detectedTempo,
  confidence,
  fitScore,
  anchorScore = fitScore,
}) {
  if (!knownBpm || !detectedTempo) {
    return 0;
  }
  const delta = Math.abs(detectedTempo - knownBpm);
  const tempoScore = clamp(100 - (delta * 12), 0, 100);
  const confidenceScore = clamp(confidence, 0, 100);
  const structureScore = clamp((fitScore || 0) * 100, 0, 100);
  const beatAnchorScore = clamp((anchorScore || 0) * 100, 0, 100);
  return Math.round(clamp(
    (tempoScore * 0.54)
    + (confidenceScore * 0.16)
    + (structureScore * 0.15)
    + (beatAnchorScore * 0.15),
    1,
    100,
  ));
}

function evaluateReferenceAlignment(tempo, duration, referenceAnalysis) {
  const expectedBars = Number(referenceAnalysis?.totalBars || referenceAnalysis?.referenceGrid?.totalBars || 0);
  const phraseBars = Number(referenceAnalysis?.phraseBars || referenceAnalysis?.referenceGrid?.phraseBars || 0);
  const bars = Array.isArray(referenceAnalysis?.bars) ? referenceAnalysis.bars : [];
  if (!tempo || !duration || !expectedBars) {
    return {
      barScore: 0.5,
      phraseScore: 0.5,
      harmonicScore: 0.5,
      score: 0.5,
    };
  }

  const candidateBars = duration / Math.max(240 / tempo, 0.001);
  const barErrorRatio = Math.abs(candidateBars - expectedBars) / Math.max(expectedBars, 1);
  const barScore = clamp(1 - (barErrorRatio / 0.22), 0, 1);

  const phraseUnits = phraseBars > 0 ? candidateBars / phraseBars : 0;
  const phraseDistance = phraseUnits > 0 ? Math.abs(phraseUnits - Math.round(phraseUnits)) : 0.5;
  const phraseScore = phraseBars > 0 ? clamp(1 - (phraseDistance / 0.5), 0, 1) : 0.5;

  let harmonicScore = 0.5;
  if (bars.length >= 8) {
    const harmonicValues = bars.map((bar) => Number(bar.harmonicChange || 0));
    const avgHarmonic = average(harmonicValues);
    const boundaryStep = phraseBars > 0 ? phraseBars : 4;
    const boundaryValues = harmonicValues.filter((_, index) => index > 0 && ((index + 1) % boundaryStep === 0));
    const offValues = harmonicValues.filter((_, index) => !(index > 0 && ((index + 1) % boundaryStep === 0)));
    const boundaryMean = boundaryValues.length ? average(boundaryValues) : avgHarmonic;
    const offMean = offValues.length ? average(offValues) : avgHarmonic;
    harmonicScore = clamp((boundaryMean - offMean + 100) / 100, 0, 1);
  }

  return {
    barScore,
    phraseScore,
    harmonicScore,
    score: clamp((barScore * 0.56) + (phraseScore * 0.18) + (harmonicScore * 0.26), 0, 1),
  };
}

function rerankCandidatesAgainstReference(ranked = [], duration, referenceAnalysis, weights = {}) {
  if (!Array.isArray(ranked) || !ranked.length || !referenceAnalysis) {
    return ranked;
  }
  const sectionWeight = clamp(Number(weights.sectionSyncWeight ?? weights.barSyncWeight ?? 0), 0, 1);
  const harmonicWeight = clamp(Number(weights.harmonicAnchorWeight || 0), 0, 1);

  return [...ranked]
    .map((candidate) => {
      const referenceFit = evaluateReferenceAlignment(candidate.tempo, duration, referenceAnalysis);
      const scoreBoost = (referenceFit.barScore * 100 * sectionWeight * 0.16)
        + (referenceFit.harmonicScore * 100 * harmonicWeight * 0.12);
      return {
        ...candidate,
        referenceFit,
        combinedScore: candidate.combinedScore + scoreBoost,
      };
    })
    .sort((left, right) => right.combinedScore - left.combinedScore);
}

function buildAubioSuggestions(result, knownBpm, config) {
  const suggestions = [];
  const nextConfig = { ...config };
  const delta = Math.abs(Number(result.tempo || 0) - Number(knownBpm || 0));
  const score = Number(result.score || 0);

  if (!result.tempo) {
    suggestions.push("Aubio non sta fissando un tempo stabile: abbassiamo la soglia di onset per far emergere meglio gli attacchi utili.");
    suggestions.push("Diamo più peso alla banda bassa e alla banda media, così kick e backbeat contano di più della frangia alta.");
    suggestions.push("Rinforziamo anche l'aggancio strutturale alle battute, così il detector smette di inseguire transienti isolati.");
    nextConfig.onsetThreshold = clamp((config.onsetThreshold || 0.18) - 0.04, 0.08, 0.34);
    nextConfig.lowWeight = clamp((config.lowWeight || 0.72) + 0.12, 0.35, 1.15);
    nextConfig.midWeight = clamp((config.midWeight || 0.34) + 0.08, 0.08, 0.95);
    nextConfig.highWeight = clamp((config.highWeight || 0.28) - 0.06, 0.04, 0.5);
    nextConfig.barSyncWeight = clamp((config.barSyncWeight || 0.28) + 0.1, 0.05, 0.95);
    nextConfig.harmonicAnchorWeight = clamp((config.harmonicAnchorWeight || 0.16) + 0.08, 0.02, 0.9);
  } else {
    if (result.tempo >= knownBpm * 1.8) {
      suggestions.push("Aubio sta leggendo quasi al doppio: conviene rinforzare la correzione half-time.");
      suggestions.push("Aumentiamo il peso della low band e abbassiamo un po' quello della high band, così prevale la pulsazione di cassa sui transienti veloci.");
      suggestions.push("Diamo anche più valore ai cambi strutturali e armonici, che spesso coincidono con un nuovo uno di battuta.");
      nextConfig.halfTimeBias = clamp((config.halfTimeBias || 0.56) + 0.18, 0.24, 0.96);
      nextConfig.lowWeight = clamp((config.lowWeight || 0.72) + 0.1, 0.35, 1.15);
      nextConfig.midWeight = clamp((config.midWeight || 0.34) + 0.06, 0.08, 0.95);
      nextConfig.highWeight = clamp((config.highWeight || 0.28) - 0.09, 0.04, 0.5);
      nextConfig.barSyncWeight = clamp((config.barSyncWeight || 0.28) + 0.12, 0.05, 0.95);
      nextConfig.harmonicAnchorWeight = clamp((config.harmonicAnchorWeight || 0.16) + 0.1, 0.02, 0.9);
    } else if (result.tempo <= knownBpm * 0.62) {
      suggestions.push("Aubio sta rallentando troppo la lettura: alleggeriamo il bias half-time.");
      suggestions.push("Facciamo contare di più transienti alti e medi, così la suddivisione rapida aiuta a non sottostimare il BPM.");
      suggestions.push("Riduciamo leggermente l'inerzia strutturale per lasciare più spazio alla scansione immediata.");
      nextConfig.halfTimeBias = clamp((config.halfTimeBias || 0.56) - 0.16, 0.16, 0.9);
      nextConfig.highWeight = clamp((config.highWeight || 0.28) + 0.1, 0.04, 0.65);
      nextConfig.midWeight = clamp((config.midWeight || 0.34) + 0.06, 0.08, 0.95);
      nextConfig.lowWeight = clamp((config.lowWeight || 0.72) - 0.08, 0.25, 1.15);
      nextConfig.barSyncWeight = clamp((config.barSyncWeight || 0.28) - 0.05, 0.05, 0.95);
    }

    if (delta >= 6) {
      suggestions.push("Lo scostamento dal BPM vero è ancora ampio: riduciamo la nervosità del trigger e facciamo pesare di più il disegno low-mid rispetto al solo transiente.");
      nextConfig.onsetThreshold = clamp((config.onsetThreshold || 0.18) + 0.03, 0.08, 0.34);
      nextConfig.lowWeight = clamp((config.lowWeight || 0.72) + 0.06, 0.25, 1.15);
      nextConfig.midWeight = clamp((config.midWeight || 0.34) + 0.05, 0.08, 0.95);
    } else if (delta >= 3) {
      suggestions.push("Siamo abbastanza vicini ma non centrati: rifiniamo trigger, mix low-mid-high e aggancio di battuta.");
      nextConfig.onsetThreshold = clamp((config.onsetThreshold || 0.18) + 0.015, 0.08, 0.34);
      nextConfig.barSyncWeight = clamp((config.barSyncWeight || 0.28) + 0.04, 0.05, 0.95);
    }

    if (result.confidence < 46) {
      suggestions.push("La confidenza è ancora bassa: alziamo il silenzio operativo e rinforziamo il peso della struttura di battuta.");
      nextConfig.silenceDb = clamp((config.silenceDb || -70) + 6, -80, -42);
      nextConfig.barSyncWeight = clamp((config.barSyncWeight || 0.28) + 0.06, 0.05, 0.95);
    }

    if ((result.anchorScore || 0) < 0.68 || (result.tickAlignment || 0) < 0.72 || (result.downbeatBias || 0) < 1.08) {
      suggestions.push("L'uno di battuta non è ancora abbastanza saldo: rinforziamo la memoria di bar line e lasciamo più spazio agli indizi low-mid che guidano il downbeat.");
      suggestions.push("Diamo più peso alla sincronizzazione di battuta e all'anchor armonico, così i transienti veloci contano meno del vero punto di ingresso bar.");
      nextConfig.barSyncWeight = clamp((config.barSyncWeight || 0.28) + 0.08, 0.05, 0.95);
      nextConfig.harmonicAnchorWeight = clamp((config.harmonicAnchorWeight || 0.16) + 0.07, 0.02, 0.9);
      nextConfig.lowWeight = clamp((config.lowWeight || 0.72) + 0.05, 0.25, 1.15);
      nextConfig.midWeight = clamp((config.midWeight || 0.34) + 0.04, 0.08, 0.95);
      nextConfig.highWeight = clamp((config.highWeight || 0.28) - 0.04, 0.04, 0.5);
    }
  }

  if (suggestions.length === 0 || (delta <= 2 && score >= 80 && result.confidence >= 70)) {
    suggestions.length = 0;
    suggestions.push("Aubio è già ben centrato su questo file: nessuna correzione forte consigliata, questa configurazione può restare la base.");
  }

  return {
    suggestions: Array.from(new Set(suggestions)),
    nextConfig,
  };
}

function buildEssentiaSuggestions(result, knownBpm, config) {
  const suggestions = [];
  const nextConfig = { ...config };
  const delta = Math.abs(Number(result.tempo || 0) - Number(knownBpm || 0));
  const score = Number(result.score || 0);

  if (!result.tempo) {
    suggestions.push("Essentia non sta consolidando un BPM utile: aumentiamo il peso della envelope low.");
    suggestions.push("Alziamo il peso di tick stabili e banda media, così backbeat e griglia di battuta contano di più.");
    suggestions.push("Rinforziamo anche i cambi armonici e di sezione come indizi per l'aggancio della bar line.");
    nextConfig.lowEnvelopeWeight = clamp((config.lowEnvelopeWeight || 0.18) + 0.1, 0.06, 0.6);
    nextConfig.midEnvelopeWeight = clamp((config.midEnvelopeWeight || 0.12) + 0.08, 0.04, 0.5);
    nextConfig.tickWeight = clamp((config.tickWeight || 0.22) + 0.08, 0.08, 0.6);
    nextConfig.sectionSyncWeight = clamp((config.sectionSyncWeight || 0.22) + 0.1, 0.04, 0.95);
    nextConfig.harmonicAnchorWeight = clamp((config.harmonicAnchorWeight || 0.16) + 0.1, 0.02, 0.9);
  } else {
    if (result.tempo >= knownBpm * 1.8) {
      suggestions.push("Essentia sta scegliendo una lettura quasi doppia: conviene favorire di più la variante half-time.");
      suggestions.push("Riduciamo il peso ritmico diretto e aumentiamo tick, banda bassa e ancore armoniche, così il candidato troppo veloce perde priorità.");
      nextConfig.halfTimeBias = clamp((config.halfTimeBias || 0.72) + 0.18, 0.3, 0.98);
      nextConfig.rhythmWeight = clamp((config.rhythmWeight || 0.5) - 0.09, 0.16, 0.7);
      nextConfig.tickWeight = clamp((config.tickWeight || 0.22) + 0.08, 0.08, 0.6);
      nextConfig.lowEnvelopeWeight = clamp((config.lowEnvelopeWeight || 0.18) + 0.08, 0.06, 0.6);
      nextConfig.sectionSyncWeight = clamp((config.sectionSyncWeight || 0.22) + 0.08, 0.04, 0.95);
      nextConfig.harmonicAnchorWeight = clamp((config.harmonicAnchorWeight || 0.16) + 0.1, 0.02, 0.9);
    } else if (result.tempo <= knownBpm * 0.62) {
      suggestions.push("Essentia sta trattenendo troppo la pulsazione: riduciamo il bias half-time.");
      suggestions.push("Diamo più forza al candidato ritmico diretto e alla envelope mista per evitare una lettura troppo lenta.");
      nextConfig.halfTimeBias = clamp((config.halfTimeBias || 0.72) - 0.16, 0.18, 0.95);
      nextConfig.rhythmWeight = clamp((config.rhythmWeight || 0.5) + 0.09, 0.16, 0.85);
      nextConfig.mixedEnvelopeWeight = clamp((config.mixedEnvelopeWeight || 0.1) + 0.06, 0.02, 0.4);
      nextConfig.midEnvelopeWeight = clamp((config.midEnvelopeWeight || 0.12) + 0.05, 0.04, 0.5);
      nextConfig.sectionSyncWeight = clamp((config.sectionSyncWeight || 0.22) - 0.04, 0.04, 0.95);
    }

    if (delta >= 6) {
      suggestions.push("Lo scostamento dal BPM vero è ancora ampio: spostiamo peso verso tick stabili, banda bassa/media e memoria di sezione, lasciando meno peso all'envelope mista.");
      nextConfig.tickWeight = clamp((config.tickWeight || 0.22) + 0.08, 0.08, 0.6);
      nextConfig.lowEnvelopeWeight = clamp((config.lowEnvelopeWeight || 0.18) + 0.07, 0.06, 0.6);
      nextConfig.midEnvelopeWeight = clamp((config.midEnvelopeWeight || 0.12) + 0.05, 0.04, 0.5);
      nextConfig.mixedEnvelopeWeight = clamp((config.mixedEnvelopeWeight || 0.1) - 0.04, 0.02, 0.35);
      nextConfig.sectionSyncWeight = clamp((config.sectionSyncWeight || 0.22) + 0.08, 0.04, 0.95);
      nextConfig.harmonicAnchorWeight = clamp((config.harmonicAnchorWeight || 0.16) + 0.08, 0.02, 0.9);
    } else if (delta >= 3) {
      suggestions.push("Siamo abbastanza vicini ma non centrati: ritocchiamo tick stabili, bande e aggancio armonico/strutturale.");
      nextConfig.tickWeight = clamp((config.tickWeight || 0.22) + 0.04, 0.08, 0.6);
      nextConfig.mixedEnvelopeWeight = clamp((config.mixedEnvelopeWeight || 0.1) - 0.025, 0.02, 0.35);
      nextConfig.harmonicAnchorWeight = clamp((config.harmonicAnchorWeight || 0.16) + 0.05, 0.02, 0.9);
    }

    if (result.confidence < 52) {
      suggestions.push("La confidenza è ancora fragile: aumentiamo tick, banda bassa e peso di sezione per consolidare meglio il BPM.");
      nextConfig.tickWeight = clamp((config.tickWeight || 0.22) + 0.06, 0.08, 0.6);
      nextConfig.lowEnvelopeWeight = clamp((config.lowEnvelopeWeight || 0.18) + 0.05, 0.06, 0.6);
      nextConfig.sectionSyncWeight = clamp((config.sectionSyncWeight || 0.22) + 0.06, 0.04, 0.95);
    }

    if ((result.anchorScore || 0) < 0.7 || (result.tickAlignment || 0) < 0.74 || (result.downbeatBias || 0) < 1.08) {
      suggestions.push("Il beat 1 resta incerto: conviene far pesare di più tick, low band e memoria di sezione così la bar line emerge meglio.");
      suggestions.push("Aumentiamo anche le ancore armoniche, utili quando il cambio di accordo coincide con l'ingresso della battuta.");
      nextConfig.tickWeight = clamp((config.tickWeight || 0.22) + 0.06, 0.08, 0.6);
      nextConfig.lowEnvelopeWeight = clamp((config.lowEnvelopeWeight || 0.18) + 0.05, 0.06, 0.6);
      nextConfig.sectionSyncWeight = clamp((config.sectionSyncWeight || 0.22) + 0.07, 0.04, 0.95);
      nextConfig.harmonicAnchorWeight = clamp((config.harmonicAnchorWeight || 0.16) + 0.08, 0.02, 0.9);
      nextConfig.mixedEnvelopeWeight = clamp((config.mixedEnvelopeWeight || 0.1) - 0.03, 0.02, 0.35);
    }
  }

  if (suggestions.length === 0 || (delta <= 2 && score >= 80 && result.confidence >= 75)) {
    suggestions.length = 0;
    suggestions.push("Essentia è già ben centrata su questo file: nessuna correzione forte consigliata, questa configurazione può restare la base.");
  }

  return {
    suggestions: Array.from(new Set(suggestions)),
    nextConfig,
  };
}

class BpmBenchmarkAnalyzer {
  constructor() {
    this.aubioFactory = globalThis.aubio || null;
    this.essentiaClass = globalThis.Essentia || null;
    this.essentiaWasmFactory = globalThis.EssentiaWASM || null;
    this.aubioApi = null;
    this.essentia = null;
    this.essentiaWasm = null;
  }

  async ensureReady() {
    if (this.aubioFactory && !this.aubioApi) {
      this.aubioApi = await this.aubioFactory();
    }

    if (this.essentiaClass && this.essentiaWasmFactory && !this.essentia) {
      if (!this.essentiaWasm) {
        const wasmCandidate = this.essentiaWasmFactory;
        if (typeof wasmCandidate === "function") {
          const created = wasmCandidate();
          this.essentiaWasm = typeof created?.then === "function" ? await created : created;
        } else if (typeof wasmCandidate?.ready?.then === "function") {
          this.essentiaWasm = await wasmCandidate.ready;
        } else {
          this.essentiaWasm = wasmCandidate;
        }
      }
      this.essentia = new this.essentiaClass(this.essentiaWasm);
    }
  }

  async analyzeTrack(track, audioContext, offlineSongAnalyzer, options = {}) {
    if (!track) {
      throw new Error("track is required");
    }
    if (!audioContext) {
      throw new Error("audioContext is required");
    }
    if (!offlineSongAnalyzer) {
      throw new Error("offlineSongAnalyzer is required");
    }

    const { buffer, meta } = await offlineSongAnalyzer.decodeTrack(track, audioContext);
    return this.analyzeAudioBuffer(buffer, {
      ...meta,
      name: track.name || meta?.name || "Track",
      knownBpm: Number(track.knownBpm || 0),
    }, options);
  }

  async analyzeAudioBuffer(audioBuffer, meta = {}, options = {}) {
    await this.ensureReady();
    const onProgress = typeof options.onProgress === "function" ? options.onProgress : () => {};
    const aubioConfig = {
      onsetThreshold: 0.18,
      silenceDb: -70,
      halfTimeBias: 0.56,
      lowWeight: 0.72,
      midWeight: 0.34,
      highWeight: 0.28,
      barSyncWeight: 0.28,
      harmonicAnchorWeight: 0.16,
      ...(options.aubioConfig || {}),
    };
    const essentiaConfig = {
      rhythmWeight: 0.5,
      tickWeight: 0.22,
      lowEnvelopeWeight: 0.18,
      midEnvelopeWeight: 0.12,
      mixedEnvelopeWeight: 0.1,
      halfTimeBias: 0.72,
      sectionSyncWeight: 0.22,
      harmonicAnchorWeight: 0.16,
      ...(options.essentiaConfig || {}),
    };

    const rawMono = arrayToMono(audioBuffer);
    const normalizedMonoState = normalizeMonoSignal(rawMono);
    const mono = normalizedMonoState.signal;
    const envelopeAnalysis = buildEnvelopeAnalysis(mono, audioBuffer.sampleRate);
    const lowEnvelope = Array.from(envelopeAnalysis.lowOnset);
    const midEnvelope = Array.from(envelopeAnalysis.midOnset);
    const mixedEnvelope = Array.from(envelopeAnalysis.lowOnset, (value, index) =>
      (value * aubioConfig.lowWeight)
      + (envelopeAnalysis.midOnset[index] * aubioConfig.midWeight)
      + (envelopeAnalysis.highOnset[index] * aubioConfig.highWeight)
    );
    onProgress({ progress: 0.1, label: "Preparing benchmark signal" });

    const referenceAnalysis = typeof options.referenceAnalysis === "object" && options.referenceAnalysis
      ? options.referenceAnalysis
      : null;
    const knownBpm = Number(meta.knownBpm || referenceAnalysis?.benchmark?.bpm || 0);
    const duration = Number(audioBuffer.duration || 0);

    const aubioResult = this.analyzeAubioOffline(audioBuffer, mono, envelopeAnalysis, lowEnvelope, midEnvelope, mixedEnvelope, aubioConfig, referenceAnalysis);
    onProgress({ progress: 0.48, label: "Scoring Aubio on the full file" });
    const essentiaResult = this.analyzeEssentiaOffline(audioBuffer, mono, envelopeAnalysis, lowEnvelope, midEnvelope, mixedEnvelope, essentiaConfig, referenceAnalysis);
    onProgress({ progress: 0.82, label: "Scoring Essentia on the full file" });

    aubioResult.score = computeModuleScore({
      knownBpm,
      detectedTempo: aubioResult.tempo,
      confidence: aubioResult.confidence,
      fitScore: aubioResult.fitScore,
      anchorScore: aubioResult.anchorScore,
    });
    essentiaResult.score = computeModuleScore({
      knownBpm,
      detectedTempo: essentiaResult.tempo,
      confidence: essentiaResult.confidence,
      fitScore: essentiaResult.fitScore,
      anchorScore: essentiaResult.anchorScore,
    });

    const aubioSuggestions = buildAubioSuggestions(aubioResult, knownBpm, aubioConfig);
    const essentiaSuggestions = buildEssentiaSuggestions(essentiaResult, knownBpm, essentiaConfig);

    onProgress({ progress: 1, label: "Benchmark ready" });

    return {
      analyzedAt: new Date().toISOString(),
      name: meta.name || "Track",
      durationSeconds: Math.round(duration * 10) / 10,
      knownBpm,
      preprocessing: {
        normalizationGain: Math.round(normalizedMonoState.gain * 100) / 100,
        peak: Math.round(normalizedMonoState.peak * 1000) / 1000,
      },
      reference: referenceAnalysis
        ? {
          tempo: referenceAnalysis.tempo || 0,
          totalBars: referenceAnalysis.totalBars || 0,
          phraseBars: referenceAnalysis.phraseBars || 0,
          confidence: referenceAnalysis.confidence || 0,
        }
        : null,
      aubio: {
        ...aubioResult,
        delta: aubioResult.tempo ? Math.round((aubioResult.tempo - knownBpm) * 10) / 10 : 0,
        config: aubioConfig,
        suggestions: aubioSuggestions.suggestions,
        suggestedConfig: aubioSuggestions.nextConfig,
      },
      essentia: {
        ...essentiaResult,
        delta: essentiaResult.tempo ? Math.round((essentiaResult.tempo - knownBpm) * 10) / 10 : 0,
        config: essentiaConfig,
        suggestions: essentiaSuggestions.suggestions,
        suggestedConfig: essentiaSuggestions.nextConfig,
      },
    };
  }

  analyzeAubioOffline(audioBuffer, mono, envelopeAnalysis, lowEnvelope, midEnvelope, mixedEnvelope, config, referenceAnalysis) {
    if (!this.aubioApi) {
      return {
        tempo: 0,
        confidence: 0,
        fitScore: 0,
        candidates: [],
      };
    }

    const bufferSize = 1024;
    const hopSize = 256;
    const tempoDetector = new this.aubioApi.Tempo(bufferSize, hopSize, audioBuffer.sampleRate);
    const onsetDetector = new this.aubioApi.Onset("default", bufferSize, hopSize, audioBuffer.sampleRate);
    if (typeof onsetDetector.setSilence === "function") {
      onsetDetector.setSilence(config.silenceDb);
    }
    if (typeof onsetDetector.setThreshold === "function") {
      onsetDetector.setThreshold(config.onsetThreshold);
    }

    const frame = new Float32Array(bufferSize);
    const beatTimes = [];
    const confidenceSamples = [];
    const onsetHits = [];
    let lastBeatSeconds = -1;

    for (let offset = 0; offset < mono.length; offset += hopSize) {
      frame.fill(0);
      frame.set(mono.subarray(offset, Math.min(mono.length, offset + bufferSize)));
      const onsetRaw = Number(onsetDetector.do(frame) || 0);
      const tempoRaw = Number(tempoDetector.do(frame) || 0);
      const nowSeconds = offset / audioBuffer.sampleRate;
      const confidence = Number(tempoDetector.getConfidence() || 0);
      confidenceSamples.push(confidence <= 1 ? confidence * 100 : confidence);
      if ((onsetRaw > 0 || tempoRaw > 0) && (lastBeatSeconds < 0 || (nowSeconds - lastBeatSeconds) > 0.18)) {
        beatTimes.push(nowSeconds);
        lastBeatSeconds = nowSeconds;
      }
      if (onsetRaw > 0) {
        onsetHits.push(nowSeconds);
      }
    }

    const directTempo = normalizeTempo(tempoDetector.getBpm());
    const beatTempo = estimateTempoFromBeatTimes(beatTimes);
    const lowTempo = estimateTempoFromEnvelope(lowEnvelope, envelopeAnalysis.frameDuration);
    const midTempo = estimateTempoFromEnvelope(midEnvelope, envelopeAnalysis.frameDuration);
    const mixedTempo = estimateTempoFromEnvelope(mixedEnvelope, envelopeAnalysis.frameDuration);
    let { best, ranked } = chooseBestTempo([
      { tempo: directTempo, confidence: Math.round(average(confidenceSamples)), weight: 42, source: "aubio-tempo", beatTimes },
      { tempo: beatTempo.tempo, confidence: beatTempo.confidence, weight: 34, source: "aubio-beats", beatTimes },
      { tempo: lowTempo.tempo, confidence: lowTempo.confidence, weight: 24 * config.lowWeight, source: "low-envelope", beatTimes: [] },
      { tempo: midTempo.tempo, confidence: midTempo.confidence, weight: 16 * config.midWeight, source: "mid-envelope", beatTimes: [] },
      { tempo: mixedTempo.tempo, confidence: mixedTempo.confidence, weight: 16, source: "mixed-envelope", beatTimes: [] },
      { tempo: directTempo / 2, confidence: Math.round((average(confidenceSamples) || 0) * config.halfTimeBias), weight: 18 * config.halfTimeBias, source: "aubio-half", beatTimes },
      { tempo: beatTempo.tempo / 2, confidence: Math.round(beatTempo.confidence * config.halfTimeBias), weight: 16 * config.halfTimeBias, source: "beats-half", beatTimes },
    ], envelopeAnalysis, audioBuffer.duration);
    ranked = rerankCandidatesAgainstReference(ranked, audioBuffer.duration, referenceAnalysis, {
      barSyncWeight: config.barSyncWeight,
      harmonicAnchorWeight: config.harmonicAnchorWeight,
    });
    best = ranked[0] || best;

    return {
      tempo: best?.tempo || directTempo || beatTempo.tempo || lowTempo.tempo || 0,
      confidence: Math.round(clamp(best?.confidence || average(confidenceSamples) || 0, 0, 100)),
      fitScore: best?.fitScore || 0,
      downbeatBias: best?.downbeatBias || 0,
      backbeatBias: best?.backbeatBias || 0,
      tickAlignment: best?.tickAlignment || 0,
      referenceFit: best?.referenceFit || null,
      anchorScore: computeAnchorScore(best || {}),
      beatCount: beatTimes.length,
      onsetCount: onsetHits.length,
      candidates: ranked.slice(0, 4).map((candidate) => ({
        tempo: candidate.tempo,
        score: Math.round(candidate.combinedScore),
        confidence: Math.round(candidate.confidence || 0),
      })),
    };
  }

  analyzeEssentiaOffline(audioBuffer, mono, envelopeAnalysis, lowEnvelope, midEnvelope, mixedEnvelope, config, referenceAnalysis) {
    if (!this.essentia) {
      return {
        tempo: 0,
        confidence: 0,
        fitScore: 0,
        candidates: [],
      };
    }

    const historyVector = this.essentia.arrayToVector(mono);
    let rhythm;
    try {
      rhythm = this.essentia.RhythmExtractor2013(historyVector, 208, "multifeature", 40);
    } finally {
      if (historyVector?.delete) {
        historyVector.delete();
      }
    }

    const ticks = rhythm?.ticks && typeof rhythm.ticks.size === "function"
      ? Array.from({ length: rhythm.ticks.size() }, (_, index) => rhythm.ticks.get(index))
      : [];
    const rhythmTempo = normalizeTempo(rhythm?.bpm || 0);
    const rhythmConfidence = Math.round(clamp(((Number(rhythm?.confidence || 0) / 5.32) * 100), 0, 100));
    const tickTempo = estimateTempoFromBeatTimes(ticks);
    const lowTempo = estimateTempoFromEnvelope(lowEnvelope, envelopeAnalysis.frameDuration);
    const midTempo = estimateTempoFromEnvelope(midEnvelope, envelopeAnalysis.frameDuration);
    const mixedTempo = estimateTempoFromEnvelope(mixedEnvelope, envelopeAnalysis.frameDuration);
    let { best, ranked } = chooseBestTempo([
      { tempo: rhythmTempo, confidence: rhythmConfidence, weight: 44 * config.rhythmWeight, source: "rhythm", beatTimes: ticks },
      { tempo: tickTempo.tempo, confidence: tickTempo.confidence, weight: 30 * config.tickWeight, source: "ticks", beatTimes: ticks },
      { tempo: lowTempo.tempo, confidence: lowTempo.confidence, weight: 22 * config.lowEnvelopeWeight, source: "low-envelope", beatTimes: [] },
      { tempo: midTempo.tempo, confidence: midTempo.confidence, weight: 18 * config.midEnvelopeWeight, source: "mid-envelope", beatTimes: [] },
      { tempo: mixedTempo.tempo, confidence: mixedTempo.confidence, weight: 16 * config.mixedEnvelopeWeight, source: "mixed-envelope", beatTimes: [] },
      { tempo: rhythmTempo / 2, confidence: Math.round(rhythmConfidence * config.halfTimeBias), weight: 24 * config.halfTimeBias, source: "rhythm-half", beatTimes: ticks },
      { tempo: tickTempo.tempo / 2, confidence: Math.round(tickTempo.confidence * config.halfTimeBias), weight: 18 * config.halfTimeBias, source: "ticks-half", beatTimes: ticks },
    ], envelopeAnalysis, audioBuffer.duration);
    ranked = rerankCandidatesAgainstReference(ranked, audioBuffer.duration, referenceAnalysis, {
      sectionSyncWeight: config.sectionSyncWeight,
      harmonicAnchorWeight: config.harmonicAnchorWeight,
    });
    best = ranked[0] || best;

    return {
      tempo: best?.tempo || rhythmTempo || tickTempo.tempo || lowTempo.tempo || 0,
      confidence: Math.round(clamp(best?.confidence || rhythmConfidence || 0, 0, 100)),
      fitScore: best?.fitScore || 0,
      downbeatBias: best?.downbeatBias || 0,
      backbeatBias: best?.backbeatBias || 0,
      tickAlignment: best?.tickAlignment || 0,
      referenceFit: best?.referenceFit || null,
      anchorScore: computeAnchorScore(best || {}),
      beatCount: ticks.length,
      onsetCount: 0,
      candidates: ranked.slice(0, 4).map((candidate) => ({
        tempo: candidate.tempo,
        score: Math.round(candidate.combinedScore),
        confidence: Math.round(candidate.confidence || 0),
      })),
    };
  }
}

function createBpmBenchmarkAnalyzer() {
  return new BpmBenchmarkAnalyzer();
}

export { BpmBenchmarkAnalyzer, createBpmBenchmarkAnalyzer };
