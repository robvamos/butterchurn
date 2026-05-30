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

function normalizeCandidateUrl(url) {
  return typeof url === "string" ? url.trim() : "";
}

function getConfiguredManifestUrls(globalObject = globalThis) {
  const explicitSingleUrl = normalizeCandidateUrl(globalObject?.__JAMPAL_BPM_BENCHMARK_MANIFEST_URL__);
  const explicitUrlList = Array.isArray(globalObject?.__JAMPAL_BPM_BENCHMARK_MANIFEST_URLS__)
    ? globalObject.__JAMPAL_BPM_BENCHMARK_MANIFEST_URLS__.map(normalizeCandidateUrl).filter(Boolean)
    : [];

  return explicitSingleUrl ? [explicitSingleUrl, ...explicitUrlList] : explicitUrlList;
}

function buildBpmBenchmarkManifestUrls(locationLike = globalThis?.location, globalObject = globalThis) {
  const sameOriginPath = "/__jam-bpmtest__/index.json";
  const sameOriginUrl = locationLike?.origin ? `${locationLike.origin}${sameOriginPath}` : sameOriginPath;

  return Array.from(
    new Set([
      sameOriginPath,
      sameOriginUrl,
      ...getConfiguredManifestUrls(globalObject),
    ].filter(Boolean))
  );
}

async function loadBpmBenchmarkManifest() {
  const candidateUrls = buildBpmBenchmarkManifestUrls(window.location, globalThis);
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
  buildBpmBenchmarkManifestUrls,
  loadBpmBenchmarkManifest,
  loadBpmBenchmarkState,
  saveBpmBenchmarkState,
};
