# Butterchurn Audio Reactive Recorder

This fork adds a first isolated MVP path for recording microphone-driven
Butterchurn visuals without changing the core renderer.

## Setup

```bash
corepack pnpm install --frozen-lockfile
corepack pnpm run dev-build
corepack pnpm run demo:audio-recorder
```

Open the local URL printed by the demo command. The recorder page is:

```text
examples/audio-reactive-recorder.html
```

## What The Demo Does

- asks for microphone permission with `navigator.mediaDevices.getUserMedia`
- routes the microphone through Web Audio into `visualizer.connectAudio`
- renders Butterchurn presets in real time
- supports preset selection, random preset, next preset, and timed cycling
- records the visible canvas with `canvas.captureStream(60)`
- combines the canvas video track with the microphone audio track
- exports a downloadable `.webm` file through `MediaRecorder`

## Browser Notes

Use a Chromium-based browser for the smoothest first pass. WebM recording is
well supported there, especially VP8/VP9 video with Opus audio. Browser support
for `MediaRecorder` codecs varies, so the demo tries these MIME types in order:

```text
video/webm;codecs=vp9,opus
video/webm;codecs=vp8,opus
video/webm
```

Microphone capture requires a secure context. `http://localhost` is accepted by
modern browsers for local development.

## Current Limitations

- output is WebM only
- audio is recorded from the microphone stream, not from a post-processed Web
  Audio mix
- no device picker yet
- no MP4/H.264 export yet
- the visual regression suite is slow on Windows and may take around 11 minutes

## Roadmap

1. Add audio input device selection.
2. Add recording quality controls and FPS controls.
3. Move recorder logic from the HTML demo into small modules under `src/`.
4. Add an automated smoke test for the recorder page.
5. Add optional FFmpeg or ffmpeg.wasm conversion for MP4 export.
