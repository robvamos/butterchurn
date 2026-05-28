# JamPal Adaptive Beatgrid Wiring Notes

Source brief preserved from user attachment:

- `//Musicstation/_cortex/brief_cortex_adaptive_bpm_beatgrid.md`

This note stores the current architectural interpretation of that brief and maps
it onto the JamPal codebase using open-source analysis tools that fit the
project's live + offline workflow.

## Goal

JamPal should not behave like a single BPM detector.

It should behave like an adaptive beatgrid engine that:

- listens to multiple rhythmic cues;
- keeps more than one tempo hypothesis alive;
- tracks beat phase and bar phase;
- stabilizes tempo and phase with inertia;
- reacquires lock when confidence drops;
- feeds a drummer that reacts to a credible musical grid instead of raw audio.

## Wiring summary

Preferred flow:

`input -> shared preprocessing -> fast realtime lane -> deep rhythm lane -> adaptive grid core -> phase/bar alignment -> structure memory -> drummer`

Where:

- `input`
  - player stream
  - microphone
  - future browser/system/live instrument sources
- `shared preprocessing`
  - implemented in JamPal by `audioPreprocessing.js`
  - downmix, normalization, band split, raw amplitude lane, tonal change lane
- `fast realtime lane`
  - built around `aubio`
  - optionally comparable with `realtime-bpm-analyzer`
- `deep rhythm lane`
  - built around `Essentia` / `Essentia.js`
  - strong for full-track BPM, beat positions, confidence, harmonic context
- `adaptive grid core`
  - JamPal-owned logic inspired by Mixxx adaptive beatgrid concepts
  - owns BPM hypotheses, beat coordinates, bar coordinates, local resets
- `phase/bar alignment`
  - Kalman / Particle live here
  - not in preprocessing, not inside aubio, not inside Essentia
- `structure memory`
  - phrase bars, section hints, downbeat anchoring, song form prediction
- `drummer`
  - reacts to the stabilized grid and structure, not to raw waveform

## Recommended open-source roles

### 1. Web Audio API

Use for:

- live routing
- source switching
- filters and analyzers
- gain staging
- live monitor / solo paths

Role in JamPal:

- always-on plumbing layer
- owns browser-native routing and signal taps

### 2. Meyda

Use for:

- realtime features that are cheap and browser-friendly
- `rms`, `energy`, `spectralFlux`, `zcr`, `chroma`

Role in JamPal:

- feature helper inside preprocessing / experiment lanes
- especially useful when we want fast browser-native descriptors without waiting
  for deeper offline analysis

### 3. aubio

Use for:

- fast onset detection
- beat pulse hints
- local tempo hints
- lightweight live listening

Role in JamPal:

- "fast ear"
- best when treated as an impulsive realtime lane, not as the final truth

### 4. Essentia / Essentia.js

Use for:

- `RhythmExtractor2013`
- `BeatTrackerMultiFeature`
- `BeatTrackerDegara`
- onset detection functions
- BPM histograms
- harmonic / tonal cues

Role in JamPal:

- robust rhythm lane
- stronger offline truth builder
- stronger phrase / harmonic support than aubio

Important constraint:

- full-track `RhythmExtractor2013` is for offline truth or long-window analysis,
  not for tight browser realtime lock by itself

### 5. realtime-bpm-analyzer

Use for:

- browser-native BPM comparison lane
- sanity-check against aubio in live routes

Role in JamPal:

- optional benchmark / comparison lane
- useful for experiment and benchmark panels more than as a permanent source of
  truth

### 6. librosa

Use for:

- offline prototyping
- beat / onset / tempo comparison
- quick reference analysis of full files

Role in JamPal:

- laboratory validator
- benchmark support for file analysis pipelines

### 7. madmom

Use for:

- beat and downbeat tracking
- bar position inference
- strong offline section / downbeat experiments

Role in JamPal:

- downbeat / bar-phase reference lane
- especially useful when we need stronger beat-1 evidence than a plain BPM
  estimator gives us

### 8. Mixxx

Use as an architectural reference, not as a small embedded library.

Role in JamPal:

- model for adaptive beatgrid behavior
- model for representing:
  - beat offset
  - BPM
  - time signature
  - adaptive grid regions
- model for gradual phase resets and local re-gridding

## JamPal interpretation of the stack

### Live path

`Web Audio -> shared preprocessing -> aubio + Essentia live lanes -> adaptiveTiming/rhythmConvergence -> drummer`

### Offline truth path

`full file -> offlineSongAnalyzer -> Essentia heavy rhythm extraction + comparison candidates -> structurePredictor -> saved song analysis`

### Benchmark path

`known BPM file -> offline truth -> aubio-only test / essentia-only test -> parameter suggestions -> saved benchmark history`

## Where Kalman / Particle belongs

Kalman / Particle should sit after detector evidence is collected.

They should receive:

- tempo candidates
- beat pulse candidates
- beat phase error
- bar anchor hints
- harmonic change hints
- structure hints

They should output:

- smoothed BPM
- lock state
- beat phase
- bar phase
- next beat prediction
- reacquire / lost-lock behavior

They should not own:

- raw FFT features
- filter configuration
- onset extraction itself

## Immediate wiring decisions for JamPal

1. Keep `audioPreprocessing.js` as the shared preprocessing contract.
2. Keep per-plugin preprocessing presets in `Detection Experiment`.
3. Treat `aubio` as fast lane, `Essentia` as robust lane.
4. Keep `adaptiveTiming.js` + `rhythmConvergence.js` as the JamPal-owned
   adaptive grid core.
5. Keep offline analysis separated from live lock logic.
6. Evolve bar/downbeat handling toward a Mixxx-style adaptive grid region model.
7. Consider `madmom` and `librosa` as offline comparators before adding new live
   dependencies.
8. Consider `realtime-bpm-analyzer` as an optional browser comparison lane for
   experiment / benchmark work.

## Best current mental model

- `Web Audio + Meyda` = browser feature plumbing
- `aubio` = fast ear
- `Essentia` = robust ear
- `offlineSongAnalyzer` = full-track truth builder
- `adaptiveTiming + rhythmConvergence` = adaptive beatgrid brain
- `Kalman / Particle` = phase and tempo stabilizer
- `structurePredictor` = phrase / section memory
- `Tone drummer` = performer

## Sources checked while shaping this note

- aubio GitHub
- Essentia rhythm / beat tracking documentation
- Mixxx beat detection manual
- Mixxx adaptive beatgrid workflow notes
- librosa GitHub/docs
- madmom docs
- realtime-bpm-analyzer GitHub
- Meyda docs
