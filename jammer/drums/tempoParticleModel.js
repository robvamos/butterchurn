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

function gaussianLikelihood(diff, sigma) {
  const safeSigma = Math.max(0.5, sigma);
  return Math.exp(-((diff * diff) / (2 * safeSigma * safeSigma)));
}

class TempoParticleModel {
  constructor(particleCount = 48) {
    this.particleCount = particleCount;
    this.reset();
  }

  reset() {
    this.particles = Array.from({ length: this.particleCount }, () => ({
      tempo: 70 + (Math.random() * 110),
      drift: (Math.random() - 0.5) * 0.12,
      weight: 1 / this.particleCount,
    }));
  }

  resample() {
    const cumulative = [];
    let sum = 0;
    this.particles.forEach((particle) => {
      sum += particle.weight;
      cumulative.push(sum);
    });

    const step = 1 / this.particleCount;
    let threshold = Math.random() * step;
    let cursor = 0;
    const resampled = [];

    for (let index = 0; index < this.particleCount; index += 1) {
      while (threshold > cumulative[cursor] && cursor < cumulative.length - 1) {
        cursor += 1;
      }
      const selected = this.particles[cursor];
      resampled.push({
        tempo: selected.tempo,
        drift: selected.drift,
        weight: step,
      });
      threshold += step;
    }

    this.particles = resampled;
  }

  update(measurement, {
    confidence = 0.5,
    lockStrength = 0,
  } = {}) {
    const observedTempo = normalizeTempo(measurement);
    if (!observedTempo) {
      return 0;
    }

    const observationConfidence = clamp(confidence, 0.05, 1);
    const diffusion = (1.8 + ((1 - lockStrength) * 3.6)) * (1.05 - (observationConfidence * 0.35));
    const sigma = 2.6 + ((1 - observationConfidence) * 8) + ((1 - lockStrength) * 4.5);
    let weightSum = 0;

    this.particles.forEach((particle) => {
      const driftNoise = (Math.random() - 0.5) * 0.04 * diffusion;
      const tempoNoise = (Math.random() - 0.5) * diffusion;
      particle.drift = clamp(particle.drift + driftNoise, -0.8, 0.8);
      particle.tempo = clamp(particle.tempo + particle.drift + tempoNoise, 60, 190);
      const likelihood = gaussianLikelihood(observedTempo - particle.tempo, sigma);
      particle.weight = Math.max(1e-6, likelihood);
      weightSum += particle.weight;
    });

    if (weightSum <= 0) {
      return observedTempo;
    }

    this.particles.forEach((particle) => {
      particle.weight /= weightSum;
    });

    const effectiveCount = 1 / this.particles.reduce((sum, particle) => sum + (particle.weight * particle.weight), 0);
    if (effectiveCount < (this.particleCount * 0.56)) {
      this.resample();
    }

    const bestTempo = this.particles.reduce((sum, particle) => sum + (particle.tempo * particle.weight), 0);
    return normalizeTempo(bestTempo || observedTempo);
  }
}

export { TempoParticleModel };
