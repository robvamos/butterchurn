import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { promisify } from "node:util";

const root = process.cwd();
const requestedPage = process.argv[2] || "examples/demo.html";
const port = Number(process.env.PORT || 4173);
const readdir = promisify(fs.readdir);
const stat = promisify(fs.stat);
const defaultLibraryDir = process.env.JAMPAL_LIBRARY_DIR || "F:\\chiavetta musica";
const libraryPrefix = "/__jam-library__";
const bpmBenchmarkDir = path.resolve(root, "BPMtest");
const bpmBenchmarkPrefix = "/__jam-bpmtest__";
const audioPattern = /\.(mp3|ogg|opus|wav|m4a|aac|flac)$/i;

const contentTypes = {
  ".aac": "audio/aac",
  ".css": "text/css; charset=utf-8",
  ".flac": "audio/flac",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".m4a": "audio/mp4",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".mp3": "audio/mpeg",
  ".ogg": "audio/ogg",
  ".opus": "audio/ogg",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".wav": "audio/wav",
  ".wasm": "application/wasm",
};

function sendError(res, statusCode, message) {
  res.writeHead(statusCode);
  res.end(message);
}

function streamFile(req, res, absolutePath, extraHeaders = {}) {
  fs.stat(absolutePath, (error, stats) => {
    if (error || !stats.isFile()) {
      sendError(res, 404, "Not found");
      return;
    }

    const ext = path.extname(absolutePath).toLowerCase();
    const contentType = contentTypes[ext] || "application/octet-stream";
    const rangeHeader = req.headers.range;
    const baseHeaders = {
      "Accept-Ranges": "bytes",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "no-store",
      "Content-Type": contentType,
      ...extraHeaders,
    };

    if (rangeHeader) {
      const match = /bytes=(\d*)-(\d*)/.exec(rangeHeader);
      if (!match) {
        sendError(res, 416, "Invalid range");
        return;
      }

      const start = match[1] ? Number(match[1]) : 0;
      const end = match[2] ? Number(match[2]) : stats.size - 1;

      if (
        Number.isNaN(start) ||
        Number.isNaN(end) ||
        start < 0 ||
        end < start ||
        end >= stats.size
      ) {
        res.writeHead(416, {
          ...baseHeaders,
          "Content-Range": `bytes */${stats.size}`,
        });
        res.end();
        return;
      }

      res.writeHead(206, {
        ...baseHeaders,
        "Content-Length": end - start + 1,
        "Content-Range": `bytes ${start}-${end}/${stats.size}`,
      });
      fs.createReadStream(absolutePath, { start, end }).pipe(res);
      return;
    }

    res.writeHead(200, {
      ...baseHeaders,
      "Content-Length": stats.size,
    });
    fs.createReadStream(absolutePath).pipe(res);
  });
}

function resolveRequestPath(urlPath) {
  const cleanPath = decodeURIComponent(urlPath.split("?")[0]);
  const relativePath = cleanPath === "/" ? requestedPage : cleanPath.slice(1);
  const absolutePath = path.resolve(root, relativePath);

  if (!absolutePath.startsWith(root)) {
    return null;
  }

  return absolutePath;
}

async function getDefaultLibraryManifest() {
  if (!fs.existsSync(defaultLibraryDir)) {
    return null;
  }

  const entries = await readdir(defaultLibraryDir, { withFileTypes: true });
  const tracks = [];

  for (const entry of entries) {
    if (!entry.isFile() || !audioPattern.test(entry.name)) {
      continue;
    }

    const absoluteTrackPath = path.join(defaultLibraryDir, entry.name);
    const info = await stat(absoluteTrackPath);
    tracks.push({
      name: entry.name,
      size: info.size,
      url: `${libraryPrefix}/files/${encodeURIComponent(entry.name)}`,
    });
  }

  tracks.sort((left, right) => left.name.localeCompare(right.name));

  return {
    label: path.basename(defaultLibraryDir),
    path: defaultLibraryDir,
    tracks,
  };
}

function parseKnownBpmFromName(name) {
  const match = String(name || "").match(/(\d+(?:\.\d+)?)\s*-\s*bpm|(\d+(?:\.\d+)?)\s*bpm/i);
  const bpm = Number(match?.[1] || match?.[2] || 0);
  return Number.isFinite(bpm) && bpm > 0 ? bpm : 0;
}

async function getBpmBenchmarkManifest() {
  if (!fs.existsSync(bpmBenchmarkDir)) {
    return null;
  }

  const entries = await readdir(bpmBenchmarkDir, { withFileTypes: true });
  const tracks = [];

  for (const entry of entries) {
    if (!entry.isFile() || !audioPattern.test(entry.name)) {
      continue;
    }

    const absoluteTrackPath = path.join(bpmBenchmarkDir, entry.name);
    const info = await stat(absoluteTrackPath);
    tracks.push({
      id: `${entry.name}:${info.size}:${parseKnownBpmFromName(entry.name)}`,
      name: entry.name,
      size: info.size,
      knownBpm: parseKnownBpmFromName(entry.name),
      durationLabel: "",
      url: `${bpmBenchmarkPrefix}/files/${encodeURIComponent(entry.name)}`,
    });
  }

  tracks.sort((left, right) => left.name.localeCompare(right.name));
  return {
    label: "BPMtest",
    path: bpmBenchmarkDir,
    tracks,
  };
}

const server = http.createServer((req, res) => {
  const requestUrl = req.url || "/";
  const urlPath = decodeURIComponent(requestUrl.split("?")[0]);

  if (urlPath === "/favicon.ico") {
    res.writeHead(204, {
      "Cache-Control": "no-store",
    });
    res.end();
    return;
  }

  if (urlPath === `${libraryPrefix}/index.json`) {
    getDefaultLibraryManifest()
      .then((manifest) => {
        if (!manifest) {
          sendError(res, 404, "Library not found");
          return;
        }

        res.writeHead(200, {
          "Content-Type": "application/json; charset=utf-8",
          "Access-Control-Allow-Origin": "*",
          "Cache-Control": "no-store",
        });
        res.end(JSON.stringify(manifest));
      })
      .catch(() => {
        sendError(res, 500, "Library manifest error");
      });
    return;
  }

  if (urlPath === `${bpmBenchmarkPrefix}/index.json`) {
    getBpmBenchmarkManifest()
      .then((manifest) => {
        if (!manifest) {
          sendError(res, 404, "BPM benchmark folder not found");
          return;
        }

        res.writeHead(200, {
          "Content-Type": "application/json; charset=utf-8",
          "Access-Control-Allow-Origin": "*",
          "Cache-Control": "no-store",
        });
        res.end(JSON.stringify(manifest));
      })
      .catch(() => {
        sendError(res, 500, "BPM benchmark manifest error");
      });
    return;
  }

  if (urlPath.startsWith(`${libraryPrefix}/files/`)) {
    const fileName = urlPath.slice(`${libraryPrefix}/files/`.length);
    const absoluteTrackPath = path.resolve(defaultLibraryDir, fileName);

    if (!absoluteTrackPath.startsWith(path.resolve(defaultLibraryDir))) {
      sendError(res, 403, "Forbidden");
      return;
    }
    streamFile(req, res, absoluteTrackPath);
    return;
  }

  if (urlPath.startsWith(`${bpmBenchmarkPrefix}/files/`)) {
    const fileName = urlPath.slice(`${bpmBenchmarkPrefix}/files/`.length);
    const absoluteTrackPath = path.resolve(bpmBenchmarkDir, fileName);

    if (!absoluteTrackPath.startsWith(path.resolve(bpmBenchmarkDir))) {
      sendError(res, 403, "Forbidden");
      return;
    }
    streamFile(req, res, absoluteTrackPath);
    return;
  }

  const filePath = resolveRequestPath(requestUrl);

  if (!filePath) {
    sendError(res, 403, "Forbidden");
    return;
  }
  streamFile(req, res, filePath);
});

server.listen(port, () => {
  const pageUrl = `http://localhost:${port}/${requestedPage.replace(/\\/g, "/")}`;
  console.log(`Serving ${root}`);
  if (fs.existsSync(defaultLibraryDir)) {
    console.log(`Default library ${defaultLibraryDir}`);
  }
  console.log(pageUrl);
});
