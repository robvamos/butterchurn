# JamPal Drummer Scaffold

This folder is the first sketch of the `JamPal Drummer` layer.

Target signal chain:

`audio input -> listener -> tempo/energy tracker -> groove brain -> drum engine -> JamPal mixer`

## What lives here

- `reactive-kit/`
  Default live-follow drummer for mic or player input.
- `pocket-groove/`
  Steadier backing drummer for supportive accompaniment.
- `ambient-pulse/`
  Sparse atmospheric pulse generator.
- `breakbeat-guide/`
  Syncopated driver for more electronic or chopped material.
- `engine.js`
  Shared orchestration and UI-facing state adapter.
- `toneDrumBus.js`
  First Tone.js bridge with a starter kick/snare/hat placeholder kit.
- `index.js`
  Catalog and factory entrypoint for the Jammer tab.
- `OPEN_SOURCE_BEATGRID_WIRING.md`
  Stored design note that maps the Cortex adaptive beatgrid brief onto JamPal's
  realtime and offline wiring using open-source analysis tools.

## Planned implementation layers

1. Listener
   Reads the currently active JamPal source (`mic` or `player`).
2. Tracker
   Estimates beat confidence, tempo stability, energy and phrase density.
3. Groove Brain
   Rule-based timing and accompaniment choices, later with AI-assisted variations.
4. Drum Engine
   Scheduled sampler/synth playback, likely via Tone.js.
5. Mixer
   Feeds drums back into JamPal output, visualizer and recorder path.

The current scaffold is intentionally light: it exposes drummer metadata, defaults,
parameter shaping and source readiness so the UI and persistence can settle before
the audio engine work begins.

## Future plan

### Tone.js role

For a "real" drum engine, Tone.js should evolve from placeholder synth voices into
the execution layer of the drummer.

Preferred playback model:

- `Tone.Sampler`
- sample-backed kits such as:
  - `kick.wav`
  - `snare.wav`
  - `hihat.wav`
  - `ride.wav`
  - `tom.wav`
  - `crash.wav`

That makes it possible to swap entire drum identities just by changing sample packs:

- acoustic jazz
- rock
- techno
- industrial
- lo-fi
- trap
- cinematic
- glitch

### Dynamic FX layer

Tone.js should also host the real-time drum effects layer. Important effect families:

- `Reverb`
- `Delay`
- `PingPongDelay`
- `Chorus`
- `Phaser`
- `Distortion`
- `Compressor`
- `EQ3`
- `Limiter`
- `Filter`
- `AutoWah`
- `BitCrusher`

This is especially important for the AI drummer direction, because the kit should
"breathe" with the incoming audio:

- more energy -> more compression and crash activity
- softer music -> brushes or jazz hats
- aggressive transients -> denser fills

### Division of responsibilities

Tone.js should not be treated as the whole solution. Its ideal role in JamPal is:

- `Tone.js` = drummer / performer
- `Essentia.js` = ear
- `Magenta.js` = creative brain
- `Butterchurn` = visual layer

### Known limits of Tone.js alone

Tone.js is not enough by itself for:

- advanced beat detection
- musical AI
- source separation
- serious transcription

So the intended companion stack remains:

- `Essentia.js`
- `Magenta.js`
- `Meyda`
- optional `ONNX` / `TensorFlow.js` models

## Detection preprocessing plan

The detection layer should treat preprocessing as a first-class musical stage,
not just as cleanup.

Goal:

- transform noisy or ambiguous audio into rhythm-focused information
- make beat tracking, bar anchoring and phrase detection more reliable
- give the drummer enough structure to enter gently and stay aligned

### Core preprocessing chain

Recommended pipeline:

`audio input -> resample -> mono -> normalize -> band split -> envelope extraction -> onset enhancement -> beat tracking -> bar detection -> groove analysis`

Main preprocessing stages:

1. `Mono`
   Collapse stereo into a single rhythm analysis channel.
2. `Normalize`
   Keep level in a stable range so quiet material still reads and loud material
   does not overwhelm onset detectors.
3. `Band split`
   Separate the signal into rhythm-relevant zones:
   - `low` -> kick / bass / downbeat hints
   - `mid` -> snare / backbeat / body
   - `high` -> hats / transients / subdivisions
4. `Envelope extraction`
   Track energy over time rather than raw waveform ambiguity.
5. `Onset enhancement`
   Emphasize attacks and transient change while reducing pads, sustain and wash.
6. `Noise reduction`
   Especially important for live microphone use.
7. `Spectral flux / novelty`
   Measure frame-to-frame change to reveal beat and onset candidates.
8. `Tempo stabilization`
   Smooth jitter before the groove brain reacts to tempo movement.

### Parallel detector model

JamPal should eventually run multiple rhythm views in parallel:

- `LOW rhythm detector`
  - kick emphasis
  - downbeat candidates
  - stronger beat-1 evidence
- `MID groove detector`
  - snare and backbeat
  - body of the pulse
- `HIGH subdivision detector`
  - hats
  - eighths / sixteenths
  - local groove density

These should feed a fused rhythm state rather than competing directly.

### Recommended roles

- `aubio`
  - fast realtime ear
  - immediate onset / pulse / local tempo hints
- `Essentia`
  - slower but more robust validator
  - beat positions, BPM stability, confidence, longer-window rhythm structure
- `Master Rhythm Brain`
  - JamPal-owned fusion layer
  - turns pulses into a musical grid:
    - `1 2 3 4`
    - bar anchor
    - phrase bars
    - groove stability

### Beat grid output

The fused detector should converge toward a structure like:

```json
{
  "bpm": 121,
  "beat": 3,
  "bar": 12,
  "phase": 3,
  "barStart": false,
  "barAnchorConfidence": 0.82,
  "phraseBars": 4,
  "groove": "shuffle_light",
  "energy": 0.72
}
```

### Why this matters for the drummer

The drummer should not react to raw audio directly. It should react to the
preprocessed and fused musical interpretation.

That lets it:

- stay sparse in silence or low-intensity passages
- place kick on a credible `1`
- mark `2 3 4` with simple hats before attempting richer patterns
- expand only after bar anchor and phrase confidence improve
- eventually support swing, anticipation, lag and more human timing

### Default behavioral consequence

Until the grid is stable, the drummer should prefer:

- very few instruments
- very few hits
- kick on `1`
- hats on `2 3 4`
- no aggressive fill logic

This keeps alignment more important than density.
