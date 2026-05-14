import {
  loadBpmBenchmarkEntry,
  saveBpmBenchmarkEntry,
  saveBpmBenchmarkRun,
} from "./bpmBenchmarkDb.js";

function buildBpmBenchmarkFileId(track) {
  if (!track) {
    return "";
  }
  return track.id || `${track.name}:${track.knownBpm || 0}:${track.size || 0}`;
}

async function loadBpmBenchmarkManifest() {
  const origin = window.location.origin;
  const localhost4174 = `${window.location.protocol}//localhost:4174/__jam-bpmtest__/index.json`;
  const loopback4174 = `${window.location.protocol}//127.0.0.1:4174/__jam-bpmtest__/index.json`;
  const candidateUrls = [
    "/__jam-bpmtest__/index.json",
    `${origin}/__jam-bpmtest__/index.json`,
    localhost4174,
    loopback4174,
  ];
  const attempts = [];

  for (const url of candidateUrls) {
    try {
      const response = await fetch(url, { cache: "no-store" });
      attempts.push(`${url} -> ${response.status}`);
      if (!response.ok) {
        continue;
      }

      const manifest = await response.json();
      const tracks = Array.isArray(manifest?.tracks)
        ? manifest.tracks.map((track) => ({
          ...track,
          id: track.id || buildBpmBenchmarkFileId(track),
        }))
        : [];
      if (tracks.length > 0) {
        return tracks;
      }
      attempts.push(`${url} -> empty`);
    } catch (error) {
      attempts.push(`${url} -> ${error.message}`);
    }
  }

  throw new Error(`catalog unavailable (${attempts.join("; ")})`);
}

async function loadBpmBenchmarkState(track) {
  if (!track) {
    return null;
  }
  return loadBpmBenchmarkEntry(buildBpmBenchmarkFileId(track));
}

async function saveBpmBenchmarkState(track, patch) {
  if (!track) {
    throw new Error("track is required");
  }
  const fileId = buildBpmBenchmarkFileId(track);
  return saveBpmBenchmarkEntry(fileId, {
    trackName: track.name,
    knownBpm: track.knownBpm,
    durationLabel: track.durationLabel || "",
    sourceUrl: track.url,
    ...patch,
  });
}

async function appendBpmBenchmarkRun(track, run) {
  if (!track) {
    throw new Error("track is required");
  }
  const fileId = buildBpmBenchmarkFileId(track);
  return saveBpmBenchmarkRun(fileId, {
    trackName: track.name,
    knownBpm: track.knownBpm,
    durationLabel: track.durationLabel || "",
    ...run,
  });
}

export {
  appendBpmBenchmarkRun,
  buildBpmBenchmarkFileId,
  loadBpmBenchmarkManifest,
  loadBpmBenchmarkState,
  saveBpmBenchmarkState,
};
