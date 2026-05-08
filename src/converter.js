import { FFmpeg } from "../node_modules/@ffmpeg/ffmpeg/dist/esm/index.js";
import { fetchFile, toBlobURL } from "../node_modules/@ffmpeg/util/dist/esm/index.js";

class VideoConverter {
  constructor() {
    this.ffmpeg = null;
    this.isLoaded = false;
  }

  async load() {
    if (this.isLoaded) return;

    this.ffmpeg = new FFmpeg();
    this.ffmpeg.on("log", ({ message }) => {
      console.log("FFmpeg log:", message);
    });

    await this.ffmpeg.load({
      coreURL: await toBlobURL(
        "/node_modules/@ffmpeg/core/dist/umd/ffmpeg-core.js",
        "text/javascript"
      ),
      wasmURL: await toBlobURL(
        "/node_modules/@ffmpeg/core/dist/umd/ffmpeg-core.wasm",
        "application/wasm"
      ),
    });

    this.isLoaded = true;
  }

  async convertWebMToMP4(webmBlob) {
    if (!this.isLoaded) {
      await this.load();
    }

    const inputFileName = "input.webm";
    const outputFileName = "output.mp4";

    await this.ffmpeg.writeFile(inputFileName, await fetchFile(webmBlob));

    await this.ffmpeg.exec([
      "-i", inputFileName,
      "-c:v", "libx264",
      "-preset", "fast",
      "-crf", "22",
      "-c:a", "aac",
      "-b:a", "128k",
      outputFileName
    ]);

    const outputData = await this.ffmpeg.readFile(outputFileName);
    const mp4Blob = new Blob([outputData], { type: "video/mp4" });

    await this.ffmpeg.deleteFile(inputFileName);
    await this.ffmpeg.deleteFile(outputFileName);

    return mp4Blob;
  }
}

export default VideoConverter;
