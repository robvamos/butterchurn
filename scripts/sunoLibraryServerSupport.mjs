import fs from "node:fs";
import path from "node:path";

export const defaultSunoCollectionsPath = "F:\\_CODEX\\Audio2VideoPal\\SunoProductions\\collection-membership.json";

export function readJsonFileSafe(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      return null;
    }

    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

export function buildSunoAudioUrl(prefix, songId) {
  return `${prefix}/audio/${encodeURIComponent(songId)}.mp3`;
}

export function buildSunoDetailUrl(prefix, songId) {
  return `${prefix}/songs/${encodeURIComponent(songId)}.json`;
}

function buildSunoTrackSummary(entry, prefix) {
  const packagePath = entry?.package_path;
  const packageDir = packagePath && fs.existsSync(packagePath) ? packagePath : null;
  const metadata = packageDir ? readJsonFileSafe(path.join(packageDir, "song.metadata.json")) : null;
  const blueprint = packageDir ? readJsonFileSafe(path.join(packageDir, "storytelling", "video-blueprint.json")) : null;
  const generation = metadata?.generation || {};
  const scenePlan = Array.isArray(blueprint?.scene_plan) ? blueprint.scene_plan : [];

  return {
    songId: entry.song_id,
    title: entry.title || metadata?.title || "Untitled Suno song",
    visibility: entry.visibility || metadata?.visibility || "public",
    durationSeconds: Number(generation.duration_seconds || blueprint?.total_duration_seconds || 0),
    promptExcerpt: String(generation.prompt_text || metadata?.lyrics?.text || "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 220),
    tags: Array.isArray(generation.tags) ? generation.tags : [],
    persona: generation.persona || null,
    sceneCount: scenePlan.length,
    audioUrl: buildSunoAudioUrl(prefix, entry.song_id),
    detailUrl: buildSunoDetailUrl(prefix, entry.song_id),
  };
}

export function getSunoProductionsCatalog({ sunoProductionsDir, prefix }) {
  const indexEntries = readJsonFileSafe(path.join(sunoProductionsDir, "index.json"));

  if (!Array.isArray(indexEntries)) {
    return {
      label: "Suno productions",
      path: sunoProductionsDir,
      tracks: [],
    };
  }

  return {
    label: "Suno productions",
    path: sunoProductionsDir,
    tracks: indexEntries.map((entry) => buildSunoTrackSummary(entry, prefix)),
  };
}

export function getSunoProductionDetail({
  sunoProductionsDir,
  prefix,
  songId,
  collectionsFilePath = defaultSunoCollectionsPath,
}) {
  const indexEntries = readJsonFileSafe(path.join(sunoProductionsDir, "index.json"));
  const entry = Array.isArray(indexEntries)
    ? indexEntries.find((candidate) => candidate?.song_id === songId)
    : null;

  if (!entry?.package_path || !fs.existsSync(entry.package_path)) {
    return null;
  }

  return {
    songId: entry.song_id,
    title: entry.title || "Untitled Suno song",
    visibility: entry.visibility || "public",
    audioUrl: buildSunoAudioUrl(prefix, entry.song_id),
    packagedAudioPath: entry.packaged_audio_path || "",
    metadata: readJsonFileSafe(path.join(entry.package_path, "song.metadata.json")) || {},
    storytelling: readJsonFileSafe(path.join(entry.package_path, "storytelling", "storytelling-map.json")) || {},
    videoBlueprint: readJsonFileSafe(path.join(entry.package_path, "storytelling", "video-blueprint.json")) || {},
    visualManifest: readJsonFileSafe(path.join(entry.package_path, "storytelling", "visual-generation-manifest.json")) || {},
    collectionMembership: readJsonFileSafe(collectionsFilePath)?.song_to_collections?.[entry.song_id] || [],
  };
}
