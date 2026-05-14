import { createAdaptiveSongFormPredictor } from "./structurePredictor.js";
import {
  averageRange,
  buildEnvelopeAnalysis,
  computePitchClassProfile,
  normalizeMonoSignal,
  profileDistance,
  summarizeEnvelopeWindow,
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

function arrayToMono(audioBuffer) {
  const channels = audioBuffer.numberOfChannels;
  const length = audioBuffer.length;
  const mono = new Float32Array(length);
  for (let channel = 0; channel < channels; channel += 1) {
    const data = audioBuffer.getChannelData(channel);
    for (let index = 0; index < length; index += 1) {
      mono[index] += data[index] / channels;
    }
  }
  return mono;
}

function median(values) {
  if (!values.length) {
    return 0;
  }
  const sorted = [...values].sort((left, right) => left - right);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

function average(values) {
  if (!values.length) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function estimateTempoFromTicks(ticks = []) {
  if (!Array.isArray(ticks) || ticks.length < 4) {
    return { tempo: 0, confidence: 0 };
  }
  const intervals = [];
  for (let index = 1; index < ticks.length; index += 1) {
    const interval = ticks[index] - ticks[index - 1];
    if (interval > 0.18 && interval < 1.5) {
      intervals.push(interval);
    }
  }
  if (!intervals.length) {
    return { tempo: 0, confidence: 0 };
  }
  const intervalMedian = median(intervals);
  const tempo = normalizeTempo(60 / intervalMedian);
  const meanInterval = average(intervals);
  const deviation = Math.sqrt(average(intervals.map((value) => (value - meanInterval) ** 2)));
  const confidence = Math.round(clamp((1 - (deviation / Math.max(meanInterval, 0.001))) * 100, 0, 100));
  return { tempo, confidence };
}

function autocorrelationAtLag(values, lag) {
  let sum = 0;
  for (let index = lag; index < values.length; index += 1) {
    sum += values[index] * values[index - lag];
  }
  return sum;
}

function estimateTempoFromEnvelope(envelope, frameDuration, { minTempo = 60, maxTempo = 180 } = {}) {
  if (!envelope?.length || envelope.length < 32) {
    return { tempo: 0, confidence: 0, lag: 0 };
  }

  let maxValue = 0;
  for (let index = 0; index < envelope.length; index += 1) {
    if (envelope[index] > maxValue) {
      maxValue = envelope[index];
    }
  }
  if (maxValue <= 0.000001) {
    return { tempo: 0, confidence: 0, lag: 0 };
  }

  const normalized = envelope.map((value) => value / maxValue);
  const minLag = Math.max(1, Math.round((60 / maxTempo) / frameDuration));
  const maxLag = Math.max(minLag + 1, Math.round((60 / minTempo) / frameDuration));
  const candidates = [];
  for (let lag = minLag; lag <= maxLag; lag += 1) {
    const correlation = autocorrelationAtLag(normalized, lag);
    candidates.push({ lag, correlation });
  }
  candidates.sort((left, right) => right.correlation - left.correlation);
  const best = candidates[0];
  const second = candidates[1] || { correlation: 0 };
  if (!best?.lag || best.correlation <= 0) {
    return { tempo: 0, confidence: 0, lag: 0 };
  }
  const tempo = normalizeTempo(60 / (best.lag * frameDuration));
  const confidence = Math.round(clamp(((best.correlation - second.correlation) / Math.max(best.correlation, 0.0001)) * 100, 0, 100));
  return { tempo, confidence, lag: best.lag };
}

function uniqueTempoCandidates(candidates = []) {
  const deduped = [];
  candidates.forEach((candidate) => {
    const tempo = normalizeTempo(candidate.tempo);
    if (!tempo) {
      return;
    }
    const existing = deduped.find((entry) => Math.abs(entry.tempo - tempo) <= 1);
    if (existing) {
      existing.weight += candidate.weight || 0;
      existing.sources.push(candidate.source);
      existing.confidence = Math.max(existing.confidence, candidate.confidence || 0);
    } else {
      deduped.push({
        tempo,
        weight: candidate.weight || 0,
        confidence: candidate.confidence || 0,
        sources: candidate.source ? [candidate.source] : [],
      });
    }
  });
  return deduped.sort((left, right) => right.weight - left.weight);
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

function evaluateTempoHypothesis({ tempo, duration, ticks, envelopeAnalysis }) {
  if (!tempo || tempo < 55 || tempo > 185) {
    return null;
  }
  const barDuration = 240 / tempo;
  const totalBars = Math.max(1, Math.floor(duration / Math.max(barDuration, 0.001)));
  const barsToInspect = Math.min(totalBars, 96);
  const quarterScores = [];
  const densityScores = [];
  const tickAlignmentScores = [];
  const backbeatScores = [];
  for (let barIndex = 0; barIndex < barsToInspect; barIndex += 1) {
    const barStartTime = barIndex * barDuration;
    const quarterValues = [];
    const backbeatValues = [];
    for (let quarter = 0; quarter < 4; quarter += 1) {
      const startFrame = Math.floor((barStartTime + (quarter * (barDuration / 4))) / envelopeAnalysis.frameDuration);
      const endFrame = Math.floor((barStartTime + ((quarter + 1) * (barDuration / 4))) / envelopeAnalysis.frameDuration);
      const lowMean = sampleMean(envelopeAnalysis.lowOnset, startFrame, endFrame);
      const midMean = sampleMean(envelopeAnalysis.midOnset, startFrame, endFrame);
      const highMean = sampleMean(envelopeAnalysis.highOnset, startFrame, endFrame);
      quarterValues.push((lowMean * 0.72) + (highMean * 0.28));
      backbeatValues.push((midMean * 0.62) + (highMean * 0.38));
    }
    const firstQuarter = quarterValues[0];
    const others = average(quarterValues.slice(1));
    quarterScores.push(clamp(firstQuarter / Math.max(others, 0.0001), 0, 3));
    densityScores.push(average(quarterValues));
    const backbeat = average([backbeatValues[1], backbeatValues[3]]);
    const nonBackbeat = average([backbeatValues[0], backbeatValues[2]]);
    backbeatScores.push(clamp(backbeat / Math.max(nonBackbeat, 0.0001), 0, 3));

    if (Array.isArray(ticks) && ticks.length > 0) {
      const quarterLength = barDuration / 4;
      let aligned = 0;
      let total = 0;
      ticks.forEach((tick) => {
        if (tick < barStartTime || tick >= barStartTime + barDuration) {
          return;
        }
        total += 1;
        const phase = (tick - barStartTime) / quarterLength;
        const nearest = Math.round(phase);
        if (Math.abs(phase - nearest) <= 0.18) {
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
  const onsetDensity = average(densityScores);
  const tickAlignment = tickAlignmentScores.length ? average(tickAlignmentScores) : 0.5;
  const structuralScore = clamp(
    (Math.min(1, downbeatBias / 1.35) * 0.34)
    + (Math.min(1, backbeatBias / 1.2) * 0.26)
    + (Math.min(1, onsetDensity * 16) * 0.14)
    + (tickAlignment * 0.26),
    0,
    1,
  );

  return {
    tempo,
    totalBars,
    barDuration,
    score: structuralScore,
    downbeatBias,
    backbeatBias,
    onsetDensity,
    tickAlignment,
  };
}

function applyTempoTieBreak(rankedCandidates = []) {
  if (!Array.isArray(rankedCandidates) || rankedCandidates.length < 2) {
    return rankedCandidates;
  }

  const primary = rankedCandidates[0];
  const rival = rankedCandidates.find((candidate, index) => {
    if (index === 0) {
      return false;
    }
    const ratio = primary.tempo / Math.max(candidate.tempo, 1);
    return ratio > 1.82 && ratio < 2.18;
  });

  if (!rival) {
    return rankedCandidates;
  }

  const primaryRhythmicFit = (primary.tickAlignment * 0.42) + (Math.min(1, primary.downbeatBias / 1.35) * 0.32) + (Math.min(1, primary.backbeatBias / 1.2) * 0.26);
  const rivalRhythmicFit = (rival.tickAlignment * 0.42) + (Math.min(1, rival.downbeatBias / 1.35) * 0.32) + (Math.min(1, rival.backbeatBias / 1.2) * 0.26);
  const primaryPhrasePenalty = primary.tempo >= 138 && primary.totalBars > 128 ? 0.09 : 0;
  const rivalPhraseBonus = rival.totalBars >= 40 && rival.totalBars <= 128 ? 0.05 : 0;
  const adjustedPrimaryScore = primary.combinedScore - (primaryPhrasePenalty * 100);
  const adjustedRivalScore = rival.combinedScore + (rivalPhraseBonus * 100);

  if (rivalRhythmicFit >= primaryRhythmicFit + 0.08 && adjustedRivalScore >= adjustedPrimaryScore - 8) {
    const reordered = [rival, ...rankedCandidates.filter((candidate) => candidate !== rival)];
    return reordered;
  }

  return rankedCandidates;
}

function signatureForBars(bars) {
  const count = Math.max(1, bars.length);
  const metrics = bars.reduce((accumulator, bar) => {
    accumulator.energy += bar.energy;
    accumulator.density += bar.density;
    accumulator.low += bar.low;
    accumulator.mid += bar.mid;
    accumulator.high += bar.high;
    accumulator.harmonic += bar.harmonicChange;
    accumulator.vocal += bar.vocalLikelihood;
    if (bar.root && bar.root !== "?") {
      accumulator.roots.push(bar.root);
    }
    return accumulator;
  }, {
    energy: 0,
    density: 0,
    low: 0,
    mid: 0,
    high: 0,
    harmonic: 0,
    vocal: 0,
    roots: [],
  });

  const roots = accumulatorDominant(metrics.roots);
  return {
    energy: Math.round(metrics.energy / count),
    density: Math.round(metrics.density / count),
    low: Math.round(metrics.low / count),
    mid: Math.round(metrics.mid / count),
    high: Math.round(metrics.high / count),
    harmonic: Math.round(metrics.harmonic / count),
    vocal: Math.round(metrics.vocal / count),
    root: roots,
  };
}

function accumulatorDominant(roots = []) {
  if (!roots.length) {
    return "?";
  }
  const counts = new Map();
  roots.forEach((root) => counts.set(root, (counts.get(root) || 0) + 1));
  return Array.from(counts.entries()).sort((left, right) => right[1] - left[1])[0]?.[0] || "?";
}

function signatureSimilarity(left, right) {
  if (!left || !right) {
    return 0;
  }
  const score = (
    (1 - (Math.abs(left.energy - right.energy) / 100)) * 0.24
    + (1 - (Math.abs(left.density - right.density) / 100)) * 0.24
    + (1 - (Math.abs(left.low - right.low) / 100)) * 0.1
    + (1 - (Math.abs(left.mid - right.mid) / 100)) * 0.08
    + (1 - (Math.abs(left.high - right.high) / 100)) * 0.08
    + (1 - (Math.abs(left.harmonic - right.harmonic) / 100)) * 0.12
    + (1 - (Math.abs(left.vocal - right.vocal) / 100)) * 0.08
    + ((left.root !== "?" && left.root === right.root) ? 0.06 : 0.02)
  );
  return clamp(score, 0, 1);
}

function choosePhraseBars(bars) {
  const options = [2, 4, 8, 16].filter((value) => value <= Math.max(2, Math.floor(bars.length / 2)));
  if (!options.length) {
    return 4;
  }

  let bestOption = 4;
  let bestScore = -1;
  const scoredOptions = [];
  options.forEach((option) => {
    const blocks = [];
    for (let index = 0; index < bars.length; index += option) {
      const block = bars.slice(index, index + option);
      if (block.length === option) {
        blocks.push(signatureForBars(block));
      }
    }
    if (blocks.length < 2) {
      return;
    }

    let similaritySum = 0;
    let comparisons = 0;
    for (let index = 1; index < blocks.length; index += 1) {
      similaritySum += signatureSimilarity(blocks[index], blocks[index - 1]);
      comparisons += 1;
      if (index >= 2) {
        similaritySum += signatureSimilarity(blocks[index], blocks[index - 2]);
        comparisons += 1;
      }
    }
    const avgSimilarity = comparisons > 0 ? similaritySum / comparisons : 0;
    const coverage = blocks.length / Math.max(2, Math.floor(bars.length / option));
    const structuralBias = ({
      2: -0.06,
      4: 0.04,
      8: 0.06,
      16: 0.02,
    }[option]) || 0;
    const score = (avgSimilarity * 0.78) + (coverage * 0.22) + structuralBias;
    scoredOptions.push({ option, score });
    if (score > bestScore) {
      bestScore = score;
      bestOption = option;
    }
  });

  if (bestOption === 2) {
    const fourBars = scoredOptions.find((entry) => entry.option === 4);
    const eightBars = scoredOptions.find((entry) => entry.option === 8);
    if ((fourBars && fourBars.score >= bestScore - 0.05) || (eightBars && eightBars.score >= bestScore - 0.03)) {
      return fourBars?.score >= (eightBars?.score ?? -1) ? 4 : 8;
    }
  }

  return bestOption;
}

function classifySection(signature, positionRatio, repetition) {
  if (positionRatio < 0.12 && signature.energy < 42 && signature.density < 44) {
    return "intro";
  }
  if (signature.energy < 18 && signature.density < 20) {
    return positionRatio > 0.78 ? "outro" : "break";
  }
  if (signature.energy >= 66 && signature.density >= 58) {
    return "chorus";
  }
  if (signature.harmonic >= 42 && repetition < 0.46) {
    return "bridge";
  }
  if (signature.vocal < 34 && signature.energy >= 45 && signature.density >= 40 && repetition < 0.5) {
    return "solo";
  }
  if (signature.density < 34 && signature.energy < 32) {
    return "break";
  }
  if (positionRatio > 0.82 && signature.energy < 32) {
    return "outro";
  }
  return repetition >= 0.56 ? "verse" : "unknown";
}

function buildSections(bars, phraseBars) {
  const sections = [];
  const seen = [];
  for (let index = 0; index < bars.length; index += phraseBars) {
    const chunk = bars.slice(index, index + phraseBars);
    if (!chunk.length) {
      continue;
    }
    const signature = signatureForBars(chunk);
    const bestMatch = seen
      .map((entry) => ({ ...entry, similarity: signatureSimilarity(signature, entry.signature) }))
      .sort((left, right) => right.similarity - left.similarity)[0];
    const repetition = bestMatch?.similarity || 0;
    const type = classifySection(signature, index / Math.max(1, bars.length), repetition);
    const section = {
      type,
      startBar: index + 1,
      lengthBars: chunk.length,
      confidence: Math.round(clamp((repetition * 44) + 38 + (chunk.length >= phraseBars ? 12 : 0), 0, 100)) / 100,
      signature: {
        energy: signature.energy,
        harmony: signature.harmonic,
        rhythmDensity: signature.density,
        spectralShape: {
          low: signature.low,
          mid: signature.mid,
          high: signature.high,
        },
        repetitionHash: `${signature.root}:${signature.energy}:${signature.density}:${signature.harmonic}`,
        vocalLikelihood: signature.vocal,
      },
      repetitionTo: bestMatch?.label || null,
    };
    const label = bestMatch && bestMatch.similarity >= 0.66
      ? bestMatch.label
      : String.fromCharCode(65 + Math.min(seen.length, 25));
    seen.push({ label, signature });
    sections.push({ ...section, label });
  }
  return sections;
}

function summarizeRecommendations(reference, live = {}) {
  const recommendations = [];
  const tempoDiffAubio = live.aubioTempo ? Math.abs(Number(live.aubioTempo || 0) - Number(reference.tempo || 0)) : 0;
  const tempoDiffEssentia = live.essentiaTempo ? Math.abs(Number(live.essentiaTempo || 0) - Number(reference.tempo || 0)) : 0;

  if (tempoDiffAubio > 6) {
    recommendations.push("Aubio sembra troppo reattivo sul tempo: conviene aumentare l’inerzia della correzione veloce.");
  }
  if (tempoDiffEssentia > 5) {
    recommendations.push("Essentia sembra arrivare tardi o larga sul BPM: conviene dare più peso alla finestra media e lunga.");
  }
  if (Number(live.barAnchorConfidence || 0) < 52) {
    recommendations.push("L’ancora di battuta è ancora debole: rafforzare low band e memoria delle battute aiuterà il beat 1.");
  }
  if (Number(live.phraseBars || 4) !== Number(reference.phraseBars || 4)) {
    recommendations.push("La memoria di frase non converge sulla stessa lunghezza del file analizzato: conviene aumentare la memoria di sezione.");
  }
  if (!recommendations.length) {
    recommendations.push("La detection live è già abbastanza vicina al riferimento offline. I prossimi miglioramenti sono più di fino che strutturali.");
  }
  return recommendations;
}

class OfflineSongAnalyzer {
  constructor() {
    this.EssentiaClass = globalThis.Essentia || null;
    this.essentiaWasmFactory = globalThis.EssentiaWASM || null;
    this.essentiaWasm = null;
    this.essentiaWasmPromise = null;
    this.essentia = null;
    this.ready = false;
  }

  async ensureReady() {
    if (this.ready && this.essentia) {
      return;
    }
    if (!this.EssentiaClass || !this.essentiaWasmFactory) {
      throw new Error("Essentia offline analysis is not available");
    }
    if (!this.essentiaWasmPromise) {
      this.essentiaWasmPromise = (async () => {
        const created = typeof this.essentiaWasmFactory === "function"
          ? this.essentiaWasmFactory()
          : this.essentiaWasmFactory;
        return typeof created?.then === "function" ? await created : created;
      })();
    }
    this.essentiaWasm = await this.essentiaWasmPromise;
    this.essentia = new this.EssentiaClass(this.essentiaWasm);
    this.ready = true;
  }

  async decodeTrack(track, audioContext) {
    if (track.file) {
      const buffer = await track.file.arrayBuffer();
      return {
        buffer: await audioContext.decodeAudioData(buffer.slice(0)),
        meta: {
          name: track.name,
          sourceLabel: track.sourceLabel,
          songId: `${track.name}:${track.file.size}:${track.file.lastModified}`,
          size: track.file.size,
          lastModified: track.file.lastModified,
        },
      };
    }

    if (track.url) {
      const response = await fetch(track.url);
      const buffer = await response.arrayBuffer();
      return {
        buffer: await audioContext.decodeAudioData(buffer.slice(0)),
        meta: {
          name: track.name,
          sourceLabel: track.sourceLabel,
          songId: `${track.name}:${track.url}`,
          url: track.url,
        },
      };
    }

    throw new Error("This track cannot be analyzed");
  }

  analyzeBarSegment(segment, sampleRate, previousProfile, envelopeWindow) {
    const frameSize = Math.min(4096, Math.max(1024, 2 ** Math.floor(Math.log2(segment.length || 1024))));
    const frame = new Float32Array(frameSize);
    const stride = Math.max(1, Math.floor(segment.length / frameSize));
    for (let index = 0; index < frameSize; index += 1) {
      frame[index] = segment[Math.min(segment.length - 1, index * stride)] || 0;
    }
    const vector = this.essentia.arrayToVector(frame);
    let spectrum;
    let windowed;
    try {
      const rms = this.essentia.RMS(vector).rms || 0;
      windowed = this.essentia.Windowing(vector, true, frame.length, "hann", 0, true).frame;
      spectrum = this.essentia.Spectrum(windowed, frame.length).spectrum;
      const spectrumValues = new Float32Array(spectrum.size());
      for (let index = 0; index < spectrumValues.length; index += 1) {
        spectrumValues[index] = spectrum.get(index);
      }
      const preprocessed = envelopeWindow || {
        low: 0,
        mid: 0,
        high: 0,
        lowOnset: 0,
        midOnset: 0,
        highOnset: 0,
        density: 0,
      };
      const low = clamp(preprocessed.low * 100, 0, 100);
      const mid = clamp(preprocessed.mid * 100, 0, 100);
      const high = clamp(preprocessed.high * 100, 0, 100);
      const profile = computePitchClassProfile(spectrumValues, sampleRate, { scaleMode: "unit" });
      const harmonicChange = previousProfile ? Math.round(profileDistance(profile.profile, previousProfile.profile) * 100) : 0;
      const onset = clamp(
        (preprocessed.lowOnset * 52)
        + (preprocessed.midOnset * 18)
        + (preprocessed.highOnset * 34)
        + (rms * 140),
        0,
        100
      );
      return {
        energy: Math.round(clamp(rms * 520, 0, 100)),
        onset: Math.round(onset),
        low: Math.round(low),
        mid: Math.round(mid),
        high: Math.round(high),
        density: Math.round(clamp((preprocessed.density * 100 * 0.76) + (onset * 0.24), 0, 100)),
        harmonicChange,
        harmonicStability: previousProfile ? Math.round((1 - (harmonicChange / 100)) * 100) : 100,
        root: profile.root,
        profile,
        vocalLikelihood: Math.round(clamp((mid * 0.58) + ((100 - low) * 0.18) + ((100 - harmonicChange) * 0.12), 0, 100)),
      };
    } finally {
      if (spectrum?.delete) {
        spectrum.delete();
      }
      if (windowed?.delete) {
        windowed.delete();
      }
      if (vector?.delete) {
        vector.delete();
      }
    }
  }

  async analyzeAudioBuffer(audioBuffer, meta = {}, options = {}) {
    await this.ensureReady();
    const onProgress = typeof options.onProgress === "function" ? options.onProgress : () => {};

    const rawMono = arrayToMono(audioBuffer);
    const normalizedMonoState = normalizeMonoSignal(rawMono);
    const mono = normalizedMonoState.signal;
    const envelopeAnalysis = buildEnvelopeAnalysis(mono, audioBuffer.sampleRate);
    onProgress({ progress: 0.12, phase: "prepare", label: "Preparing mono signal and rhythm envelopes" });
    const historyVector = this.essentia.arrayToVector(mono);
    let rhythm;
    try {
      rhythm = this.essentia.RhythmExtractor2013(historyVector, 208, "multifeature", 40);
    } finally {
      if (historyVector?.delete) {
        historyVector.delete();
      }
    }

    const duration = audioBuffer.duration;
    const ticks = rhythm?.ticks && typeof rhythm.ticks.size === "function"
      ? Array.from({ length: rhythm.ticks.size() }, (_, index) => rhythm.ticks.get(index))
      : [];
    const rhythmTempo = normalizeTempo(rhythm?.bpm || 0);
    const rhythmConfidence = Math.round(clamp(((Number(rhythm?.confidence || 0) / 5.32) * 100), 0, 100));
    const tickTempo = estimateTempoFromTicks(ticks);
    const lowEnvelopeTempo = estimateTempoFromEnvelope(Array.from(envelopeAnalysis.lowOnset), envelopeAnalysis.frameDuration);
    const mixedEnvelope = Array.from(envelopeAnalysis.lowOnset, (value, index) => (value * 0.7) + (envelopeAnalysis.highOnset[index] * 0.3));
    const mixedEnvelopeTempo = estimateTempoFromEnvelope(mixedEnvelope, envelopeAnalysis.frameDuration);
    const candidatePool = uniqueTempoCandidates([
      { tempo: rhythmTempo, confidence: rhythmConfidence, weight: Math.max(10, rhythmConfidence), source: "rhythm" },
      { tempo: tickTempo.tempo, confidence: tickTempo.confidence, weight: Math.max(8, tickTempo.confidence * 0.8), source: "ticks" },
      { tempo: lowEnvelopeTempo.tempo, confidence: lowEnvelopeTempo.confidence, weight: Math.max(8, lowEnvelopeTempo.confidence * 0.88), source: "low-envelope" },
      { tempo: mixedEnvelopeTempo.tempo, confidence: mixedEnvelopeTempo.confidence, weight: Math.max(6, mixedEnvelopeTempo.confidence * 0.72), source: "mixed-envelope" },
      { tempo: rhythmTempo / 2, confidence: Math.round(rhythmConfidence * 0.72), weight: Math.max(4, rhythmConfidence * 0.42), source: "rhythm-half" },
      { tempo: tickTempo.tempo / 2, confidence: Math.round(tickTempo.confidence * 0.7), weight: Math.max(4, tickTempo.confidence * 0.36), source: "ticks-half" },
      { tempo: lowEnvelopeTempo.tempo / 2, confidence: Math.round(lowEnvelopeTempo.confidence * 0.74), weight: Math.max(4, lowEnvelopeTempo.confidence * 0.4), source: "low-half" },
      { tempo: mixedEnvelopeTempo.tempo / 2, confidence: Math.round(mixedEnvelopeTempo.confidence * 0.66), weight: Math.max(4, mixedEnvelopeTempo.confidence * 0.32), source: "mixed-half" },
      { tempo: rhythmTempo * 2, confidence: Math.round(rhythmConfidence * 0.32), weight: Math.max(2, rhythmConfidence * 0.18), source: "rhythm-double" },
      { tempo: tickTempo.tempo * 2, confidence: Math.round(tickTempo.confidence * 0.28), weight: Math.max(2, tickTempo.confidence * 0.14), source: "ticks-double" },
    ]);
    onProgress({ progress: 0.24, phase: "rhythm", label: "Estimating tempo and beat map" });
    const rankedCandidates = applyTempoTieBreak(candidatePool
      .map((candidate) => {
        const fit = evaluateTempoHypothesis({
          tempo: candidate.tempo,
          duration,
          ticks,
          envelopeAnalysis,
        });
        if (!fit) {
          return null;
        }
        return {
          ...candidate,
          ...fit,
          preferredTempoWeight: getPreferredTempoWeight(candidate.tempo),
          combinedScore: (
            (candidate.weight * 0.16)
            + (candidate.confidence * 0.1)
            + (fit.score * 100 * 0.56)
            + (getPreferredTempoWeight(candidate.tempo) * 100 * 0.18)
          ) * (0.72 + (getPreferredTempoWeight(candidate.tempo) * 0.28)),
        };
      })
      .filter(Boolean)
      .sort((left, right) => right.combinedScore - left.combinedScore));
    const chosenTempoCandidate = rankedCandidates[0] || {
      tempo: rhythmTempo || tickTempo.tempo || lowEnvelopeTempo.tempo || 104,
      totalBars: Math.max(1, Math.round(duration / ((240 / (rhythmTempo || 104))))),
      barDuration: 240 / (rhythmTempo || 104),
      combinedScore: 0,
      downbeatBias: 1,
      tickAlignment: 0.5,
    };
    const tempo = normalizeTempo(chosenTempoCandidate.tempo) || 104;
    const confidence = Math.round(clamp(
      Math.max(
        rhythmConfidence * 0.42,
        tickTempo.confidence * 0.26,
        lowEnvelopeTempo.confidence * 0.18,
        mixedEnvelopeTempo.confidence * 0.14,
      )
      + (chosenTempoCandidate.downbeatBias * 12)
      + (chosenTempoCandidate.tickAlignment * 10),
      0,
      100,
    ));
    const beatCount = ticks.length || Math.max(1, Math.round((duration / 60) * tempo));
    const totalBars = Math.max(1, chosenTempoCandidate.totalBars || Math.round(beatCount / 4));
    const barDuration = chosenTempoCandidate.barDuration || (tempo > 0 ? 240 / tempo : (duration / totalBars));
    const predictor = createAdaptiveSongFormPredictor();
    const bars = [];
    let previousProfile = null;

    for (let barIndex = 0; barIndex < totalBars; barIndex += 1) {
      const startSample = Math.floor((barIndex * barDuration) * audioBuffer.sampleRate);
      const endSample = Math.min(mono.length, Math.floor(((barIndex + 1) * barDuration) * audioBuffer.sampleRate));
      if (endSample <= startSample) {
        continue;
      }
      const barStartTime = barIndex * barDuration;
      const barEndTime = Math.min(duration, (barIndex + 1) * barDuration);
      const segment = mono.slice(startSample, endSample);
      const envelopeWindow = summarizeEnvelopeWindow(envelopeAnalysis, barStartTime, barEndTime);
      const barMetrics = this.analyzeBarSegment(segment, audioBuffer.sampleRate, previousProfile, envelopeWindow);
      previousProfile = barMetrics.profile;
      bars.push({
        barNumber: barIndex + 1,
        energy: barMetrics.energy,
        density: barMetrics.density,
        low: barMetrics.low,
        mid: barMetrics.mid,
        high: barMetrics.high,
        harmonicChange: barMetrics.harmonicChange,
        harmonicStability: barMetrics.harmonicStability,
        harmonicRoot: barMetrics.root,
        vocalLikelihood: barMetrics.vocalLikelihood,
      });
      onProgress({
        progress: 0.28 + (((barIndex + 1) / totalBars) * 0.48),
        phase: "bars",
        label: `Reading bar ${barIndex + 1} of ${totalBars}`,
      });
    }

    const phraseBars = choosePhraseBars(bars);
    onProgress({ progress: 0.82, phase: "phrases", label: "Grouping phrases and sections" });
    bars.forEach((bar) => {
      predictor.update({
        detectionActive: true,
        sourceMode: "player",
        tempo,
        phraseBars,
        barStart: true,
        energy: bar.energy / 100,
        onset: bar.density / 100,
        preprocessLow: bar.low,
        preprocessMid: bar.mid,
        preprocessHigh: bar.high,
        preprocessFlux: bar.density,
        preprocessLowOnset: Math.round(bar.low * 0.5),
        preprocessHighOnset: Math.round(bar.high * 0.45),
        harmonicChange: bar.harmonicChange,
        harmonicStability: bar.harmonicStability / 100,
        harmonicRoot: bar.harmonicRoot,
        barAnchorConfidence: Math.round(clamp((bar.low * 0.44) + (bar.density * 0.26) + 24, 0, 100)),
        stability: clamp(confidence / 100, 0, 1),
        confidence,
      });
    });

    const sections = buildSections(bars, phraseBars);
    const predictorSnapshot = predictor.getSnapshot();
    onProgress({ progress: 0.94, phase: "structure", label: "Summarizing song form" });
    const analysis = {
      ...meta,
      analyzedAt: new Date().toISOString(),
      durationSeconds: Math.round(duration * 10) / 10,
      preprocessing: {
        normalizationGain: Math.round(normalizedMonoState.gain * 100) / 100,
        peak: Math.round(normalizedMonoState.peak * 1000) / 1000,
      },
      tempo,
      confidence,
      beatCount,
      totalBars,
      phraseBars,
      tempoCandidates: rankedCandidates.slice(0, 6).map((candidate) => ({
        tempo: candidate.tempo,
        confidence: candidate.confidence,
        score: Math.round(candidate.combinedScore),
        downbeatBias: Math.round(Math.min(1, candidate.downbeatBias / 1.35) * 100),
        backbeatBias: Math.round(Math.min(1, candidate.backbeatBias / 1.2) * 100),
        tickAlignment: Math.round(candidate.tickAlignment * 100),
        sources: candidate.sources,
      })),
      referenceGrid: {
        tempo,
        beatsPerBar: 4,
        barDurationSeconds: Math.round(barDuration * 1000) / 1000,
        totalBars,
        phraseBars,
        confidence,
        chosenSources: Array.isArray(chosenTempoCandidate.sources) ? chosenTempoCandidate.sources : [],
        downbeatBias: Math.round(Math.min(1, (chosenTempoCandidate.downbeatBias || 0) / 1.35) * 100),
        backbeatBias: Math.round(Math.min(1, (chosenTempoCandidate.backbeatBias || 0) / 1.2) * 100),
        tickAlignment: Math.round((chosenTempoCandidate.tickAlignment || 0) * 100),
        topTempoCandidates: rankedCandidates.slice(0, 3).map((candidate) => ({
          tempo: candidate.tempo,
          score: Math.round(candidate.combinedScore),
          confidence: candidate.confidence,
        })),
      },
      structure: {
        currentSection: predictorSnapshot.currentSection,
        expectedSectionLength: predictorSnapshot.expectedSectionLength,
        nextLikelySection: predictorSnapshot.nextLikelySection,
        formHypothesis: predictorSnapshot.formHypothesis,
        sections,
      },
      recommendations: [],
    };

    analysis.recommendations = summarizeRecommendations(analysis, {
      tempo,
      essentiaTempo: tempo,
      aubioTempo: lowEnvelopeTempo.tempo || tickTempo.tempo || tempo,
      phraseBars,
      barAnchorConfidence: Math.round(clamp(confidence * 0.76, 0, 100)),
    });
    onProgress({ progress: 1, phase: "done", label: "Analysis complete" });

    return analysis;
  }
}

function createOfflineSongAnalyzer() {
  return new OfflineSongAnalyzer();
}

export {
  OfflineSongAnalyzer,
  createOfflineSongAnalyzer,
  summarizeRecommendations,
};
