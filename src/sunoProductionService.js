const DEFAULT_SUNO_PRODUCTIONS_MANIFEST_URL = "/__suno-productions__/index.json";
const DEFAULT_SUNO_PRODUCTIONS_DETAIL_BASE_URL = "/__suno-productions__/songs";

async function readJson(url) {
  const response = await fetch(url, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Request failed (${response.status})`);
  }

  return response.json();
}

export async function loadSunoProductionsCatalog(manifestUrl = DEFAULT_SUNO_PRODUCTIONS_MANIFEST_URL) {
  const payload = await readJson(manifestUrl);
  const tracks = Array.isArray(payload?.tracks) ? payload.tracks : [];

  return {
    label: payload?.label || "Suno productions",
    path: payload?.path || "",
    tracks,
  };
}

export async function loadSunoProductionDetail(
  songId,
  baseUrl = DEFAULT_SUNO_PRODUCTIONS_DETAIL_BASE_URL
) {
  if (!songId) {
    throw new Error("Missing Suno song id");
  }

  return readJson(`${baseUrl}/${encodeURIComponent(songId)}.json`);
}

