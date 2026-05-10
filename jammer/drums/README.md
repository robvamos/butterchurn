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
