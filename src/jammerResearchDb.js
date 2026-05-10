import { loadAsset, saveAsset } from "./settingsDb.js";
import { RHYTHM_RESEARCH_SEED_VERSION, rhythmResearchSeed } from "../jammer/research/rhythmCatalog.js";

const JAMMER_RESEARCH_ASSET_KEY = "jammerResearchCatalog";

function buildCatalogPayload(existingEntries = []) {
  const existingById = new Map((existingEntries || []).map((entry) => [entry.id, entry]));

  const entries = rhythmResearchSeed.map((entry) => {
    const previous = existingById.get(entry.id);
    return {
      ...entry,
      bookmarked: previous?.bookmarked || false,
      notes: previous?.notes || "",
      lastReviewedAt: previous?.lastReviewedAt || null,
    };
  });

  return {
    key: JAMMER_RESEARCH_ASSET_KEY,
    seedVersion: RHYTHM_RESEARCH_SEED_VERSION,
    updatedAt: new Date().toISOString(),
    entryCount: entries.length,
    entries,
  };
}

async function syncJammerResearchCatalog() {
  const existing = await loadAsset(JAMMER_RESEARCH_ASSET_KEY);

  if (existing?.seedVersion === RHYTHM_RESEARCH_SEED_VERSION && Array.isArray(existing.entries)) {
    return existing;
  }

  const payload = buildCatalogPayload(existing?.entries);
  await saveAsset(JAMMER_RESEARCH_ASSET_KEY, payload);
  return payload;
}

async function loadJammerResearchCatalog() {
  const catalog = await loadAsset(JAMMER_RESEARCH_ASSET_KEY);
  if (catalog?.entries?.length) {
    return catalog;
  }

  return syncJammerResearchCatalog();
}

export { JAMMER_RESEARCH_ASSET_KEY, loadJammerResearchCatalog, syncJammerResearchCatalog };
