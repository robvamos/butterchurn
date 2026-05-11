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

class TempoKalmanModel {
  constructor() {
    this.reset();
  }

  reset() {
    this.initialized = false;
    this.tempo = 0;
    this.drift = 0;
    this.p00 = 12;
    this.p01 = 0;
    this.p10 = 0;
    this.p11 = 4;
  }

  update(measurement, {
    confidence = 0.5,
    lockStrength = 0,
  } = {}) {
    const observedTempo = normalizeTempo(measurement);
    if (!observedTempo) {
      return normalizeTempo(this.tempo);
    }

    if (!this.initialized) {
      this.initialized = true;
      this.tempo = observedTempo;
      this.drift = 0;
      return observedTempo;
    }

    const observationConfidence = clamp(confidence, 0.05, 1);
    const predictionTempo = this.tempo + this.drift;
    const predictionDrift = this.drift;

    const processNoiseTempo = 0.35 + ((1 - lockStrength) * 0.65);
    const processNoiseDrift = 0.08 + ((1 - observationConfidence) * 0.22);

    const p00 = this.p00 + this.p10 + this.p01 + this.p11 + processNoiseTempo;
    const p01 = this.p01 + this.p11;
    const p10 = this.p10 + this.p11;
    const p11 = this.p11 + processNoiseDrift;

    const measurementNoise = 4.5 + ((1 - observationConfidence) * 18) + ((1 - lockStrength) * 8);
    const innovation = observedTempo - predictionTempo;
    const innovationCovariance = p00 + measurementNoise;
    const kalmanGainTempo = p00 / innovationCovariance;
    const kalmanGainDrift = p10 / innovationCovariance;

    this.tempo = predictionTempo + (kalmanGainTempo * innovation);
    this.drift = predictionDrift + (kalmanGainDrift * innovation * 0.18);
    this.p00 = (1 - kalmanGainTempo) * p00;
    this.p01 = (1 - kalmanGainTempo) * p01;
    this.p10 = p10 - (kalmanGainDrift * p00);
    this.p11 = p11 - (kalmanGainDrift * p01);

    return normalizeTempo(this.tempo);
  }
}

export { TempoKalmanModel };
