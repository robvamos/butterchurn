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
