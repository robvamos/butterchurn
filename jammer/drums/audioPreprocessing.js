function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function averageRange(buffer, start, end) {
  const safeStart = Math.max(0, Math.min(buffer.length, start));
  const safeEnd = Math.max(safeStart + 1, Math.min(buffer.length, end));
  let sum = 0;
  for (let index = safeStart; index < safeEnd; index += 1) {
    sum += buffer[index];
  }
  return sum / (safeEnd - safeStart);
}

const PITCH_CLASS_NAMES = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];

function toUnitMagnitude(value, scaleMode = "auto") {
  if (scaleMode === "byte") {
    return value / 255;
  }
  if (scaleMode === "unit") {
    return value;
  }
  return value > 1 ? value / 255 : value;
}

function computePitchClassProfile(frequencyBuffer, sampleRate, options = {}) {
  const { scaleMode = "auto" } = options;
  const profile = new Float32Array(12);
  const nyquist = sampleRate / 2;
  const hzPerBin = nyquist / Math.max(1, frequencyBuffer.length);

  for (let index = 1; index < frequencyBuffer.length; index += 1) {
    const magnitude = toUnitMagnitude(frequencyBuffer[index], scaleMode);
    if (magnitude < 0.02) {
      continue;
    }

    const frequency = index * hzPerBin;
    if (frequency < 80 || frequency > 2000) {
      continue;
    }

    const midi = 69 + (12 * Math.log2(frequency / 440));
    if (!Number.isFinite(midi)) {
      continue;
    }

    const pitchClass = ((Math.round(midi) % 12) + 12) % 12;
    const emphasis = frequency < 250 ? 0.55 : frequency < 1000 ? 1 : 0.82;
    profile[pitchClass] += magnitude * emphasis;
  }

  const total = profile.reduce((sum, value) => sum + value, 0);
  if (total <= 0) {
    return { profile, root: "?", energy: 0 };
  }

  let peakIndex = 0;
  let peakValue = profile[0];
  for (let index = 0; index < profile.length; index += 1) {
    profile[index] /= total;
    if (profile[index] > peakValue) {
      peakValue = profile[index];
      peakIndex = index;
    }
  }

  return {
    profile,
    root: PITCH_CLASS_NAMES[peakIndex],
    energy: peakValue,
  };
}

function profileDistance(a, b) {
  if (!a || !b || a.length !== b.length) {
    return 0;
  }

  let sum = 0;
  for (let index = 0; index < a.length; index += 1) {
    sum += Math.abs(a[index] - b[index]);
  }
  return clamp(sum / 2, 0, 1);
}

function computeBandSnapshot(frequencyBuffer, sampleRate, previousSpectrum, options = {}) {
  const { scaleMode = "auto" } = options;
  const nyquist = sampleRate / 2;
  const hzPerBin = nyquist / Math.max(1, frequencyBuffer.length);
  const lowCutoffHz = Math.max(40, Number(options.lowCutoffHz || 150));
  const midCutoffHz = Math.max(lowCutoffHz + 20, Number(options.midCutoffHz || 2000));
  const lowEnd = Math.max(1, Math.round(lowCutoffHz / hzPerBin));
  const midEnd = Math.max(lowEnd + 1, Math.round(midCutoffHz / hzPerBin));
  const highEnd = Math.max(midEnd + 1, Math.round(10000 / hzPerBin));

  const scaleDivisor = scaleMode === "byte" ? 255 : 1;
  const low = clamp(averageRange(frequencyBuffer, 1, lowEnd) / scaleDivisor, 0, 1);
  const mid = clamp(averageRange(frequencyBuffer, lowEnd, midEnd) / scaleDivisor, 0, 1);
  const high = clamp(averageRange(frequencyBuffer, midEnd, highEnd) / scaleDivisor, 0, 1);

  let positiveFlux = 0;
  for (let index = 0; index < frequencyBuffer.length; index += 1) {
    const current = toUnitMagnitude(frequencyBuffer[index], scaleMode);
    const delta = current - previousSpectrum[index];
    if (delta > 0) {
      positiveFlux += delta;
    }
    previousSpectrum[index] = current;
  }

  return {
    low,
    mid,
    high,
    flux: clamp(positiveFlux / Math.max(8, frequencyBuffer.length * 0.22), 0, 1),
  };
}

function normalizeMonoSignal(mono) {
  let peak = 0;
  for (let index = 0; index < mono.length; index += 1) {
    const amplitude = Math.abs(mono[index]);
    if (amplitude > peak) {
      peak = amplitude;
    }
  }
  if (peak <= 0.000001) {
    return { signal: mono, gain: 1, peak: 0 };
  }
  const targetPeak = 0.94;
  const gain = clamp(targetPeak / peak, 0.5, 8);
  const normalized = new Float32Array(mono.length);
  for (let index = 0; index < mono.length; index += 1) {
    normalized[index] = mono[index] * gain;
  }
  return { signal: normalized, gain, peak };
}

function buildEnvelopeAnalysis(mono, sampleRate, frameMs = 20) {
  const frameSize = Math.max(256, Math.round((sampleRate * frameMs) / 1000));
  const frameCount = Math.max(1, Math.floor(mono.length / frameSize));
  const low = new Float32Array(frameCount);
  const mid = new Float32Array(frameCount);
  const high = new Float32Array(frameCount);
  const lowOnset = new Float32Array(frameCount);
  const midOnset = new Float32Array(frameCount);
  const highOnset = new Float32Array(frameCount);
  let lowState = 0;
  let fastState = 0;
  let previousLow = 0;
  let previousMid = 0;
  let previousHigh = 0;
  const lowAlpha = clamp((2 * Math.PI * 140) / sampleRate, 0.0005, 0.25);
  const fastAlpha = clamp((2 * Math.PI * 2400) / sampleRate, 0.004, 0.6);

  for (let frameIndex = 0; frameIndex < frameCount; frameIndex += 1) {
    const start = frameIndex * frameSize;
    const end = Math.min(mono.length, start + frameSize);
    let lowEnergy = 0;
    let midEnergy = 0;
    let highEnergy = 0;

    for (let sampleIndex = start; sampleIndex < end; sampleIndex += 1) {
      const sample = mono[sampleIndex];
      lowState += lowAlpha * (sample - lowState);
      fastState += fastAlpha * (sample - fastState);
      const lowSample = lowState;
      const highSample = sample - fastState;
      const midSample = sample - lowSample - highSample;
      lowEnergy += Math.abs(lowSample);
      midEnergy += Math.abs(midSample);
      highEnergy += Math.abs(highSample);
    }

    const scale = Math.max(1, end - start);
    low[frameIndex] = lowEnergy / scale;
    mid[frameIndex] = midEnergy / scale;
    high[frameIndex] = highEnergy / scale;
    lowOnset[frameIndex] = Math.max(0, low[frameIndex] - previousLow);
    midOnset[frameIndex] = Math.max(0, mid[frameIndex] - previousMid);
    highOnset[frameIndex] = Math.max(0, high[frameIndex] - previousHigh);
    previousLow = low[frameIndex];
    previousMid = mid[frameIndex];
    previousHigh = high[frameIndex];
  }

  return {
    frameSize,
    frameDuration: frameSize / sampleRate,
    low,
    mid,
    high,
    lowOnset,
    midOnset,
    highOnset,
  };
}

function summarizeEnvelopeWindow(envelopeAnalysis, startTime, endTime) {
  if (!envelopeAnalysis) {
    return {
      low: 0,
      mid: 0,
      high: 0,
      lowOnset: 0,
      midOnset: 0,
      highOnset: 0,
      density: 0,
    };
  }

  const startFrame = Math.max(0, Math.floor(startTime / envelopeAnalysis.frameDuration));
  const endFrame = Math.max(startFrame + 1, Math.ceil(endTime / envelopeAnalysis.frameDuration));
  const low = averageRange(envelopeAnalysis.low, startFrame, endFrame);
  const mid = averageRange(envelopeAnalysis.mid, startFrame, endFrame);
  const high = averageRange(envelopeAnalysis.high, startFrame, endFrame);
  const lowOnset = averageRange(envelopeAnalysis.lowOnset, startFrame, endFrame);
  const midOnset = averageRange(envelopeAnalysis.midOnset, startFrame, endFrame);
  const highOnset = averageRange(envelopeAnalysis.highOnset, startFrame, endFrame);
  const density = clamp((lowOnset * 0.48) + (midOnset * 0.2) + (highOnset * 0.32), 0, 1);

  return {
    low,
    mid,
    high,
    lowOnset,
    midOnset,
    highOnset,
    density,
  };
}

export {
  averageRange,
  buildEnvelopeAnalysis,
  computeBandSnapshot,
  computePitchClassProfile,
  normalizeMonoSignal,
  profileDistance,
  summarizeEnvelopeWindow,
};
