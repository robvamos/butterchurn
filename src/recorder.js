export default class Recorder {
  constructor() {
    this.mediaRecorder = null;
    this.recordedChunks = [];
    this.stopPromise = null;
    this.stopResolve = null;
    this.stopReject = null;
    this.outputStream = null;
  }

  chooseMimeType() {
    const mimeTypes = [
      "video/webm;codecs=vp9,opus",
      "video/webm;codecs=vp8,opus",
      "video/webm",
    ];
    return mimeTypes.find((mimeType) => MediaRecorder.isTypeSupported(mimeType)) || "";
  }

  startRecording(canvas, audioStream, fps, bitrate) {
    if (!audioStream) {
      throw new Error("Audio stream required");
    }

    if (this.isRecording()) {
      throw new Error("A recording is already in progress");
    }

    const canvasStream = canvas.captureStream(fps);
    const mixedStream = new MediaStream([
      ...canvasStream.getVideoTracks(),
      ...audioStream.getAudioTracks(),
    ]);
    this.outputStream = mixedStream;

    const mimeType = this.chooseMimeType();
    const options = mimeType ? { mimeType } : {};
    if (bitrate) {
      options.videoBitsPerSecond = bitrate;
    }

    this.recordedChunks = [];
    this.mediaRecorder = new MediaRecorder(mixedStream, options);

    this.stopPromise = new Promise((resolve, reject) => {
      this.stopResolve = resolve;
      this.stopReject = reject;
    });

    this.mediaRecorder.addEventListener("dataavailable", (event) => {
      if (event.data.size > 0) {
        this.recordedChunks.push(event.data);
      }
    });

    this.mediaRecorder.addEventListener(
      "stop",
      () => {
        const blob = new Blob(this.recordedChunks, {
          type: this.mediaRecorder.mimeType || "video/webm",
        });
        this.cleanup();
        this.stopResolve(blob);
      },
      { once: true }
    );

    this.mediaRecorder.addEventListener(
      "error",
      (event) => {
        const error = event.error || new Error("Recording failed");
        this.cleanup();
        this.stopReject(error);
      },
      { once: true }
    );

    this.mediaRecorder.start(1000);
    return this.mediaRecorder.mimeType || mimeType;
  }

  stopRecording() {
    if (!this.mediaRecorder) {
      throw new Error("No recording in progress");
    }

    if (this.mediaRecorder.state === "inactive") {
      return this.stopPromise;
    }

    this.mediaRecorder.stop();
    return this.stopPromise;
  }

  cleanup() {
    if (this.outputStream) {
      this.outputStream.getTracks().forEach((track) => track.stop());
    }

    this.mediaRecorder = null;
    this.outputStream = null;
  }

  isRecording() {
    return this.mediaRecorder && this.mediaRecorder.state === "recording";
  }
}
