import { loadAsset, saveAsset } from "./settingsDb.js";

const SONG_ANALYSIS_ASSET_KEY = "jammerSongAnalysisCatalog";

const defaultSongAnalysisState = {
  analyses: {},
  references: {},
  updatedAt: null,
};

async function loadSongAnalysisCatalog() {
  const state = await loadAsset(SONG_ANALYSIS_ASSET_KEY);
  if (!state) {
    return structuredClone(defaultSongAnalysisState);
  }

  return {
    analyses: state.analyses && typeof state.analyses === "object" ? state.analyses : {},
    references: state.references && typeof state.references === "object" ? state.references : {},
    updatedAt: state.updatedAt || null,
  };
}

async function loadSongAnalysis(songId) {
  const catalog = await loadSongAnalysisCatalog();
  return catalog.analyses?.[songId] || null;
}

async function saveSongAnalysis(songId, analysis) {
  const catalog = await loadSongAnalysisCatalog();
  const nextCatalog = {
    analyses: {
      ...catalog.analyses,
      [songId]: {
        ...analysis,
        songId,
        savedAt: new Date().toISOString(),
      },
    },
    references: catalog.references,
    updatedAt: new Date().toISOString(),
  };
  await saveAsset(SONG_ANALYSIS_ASSET_KEY, nextCatalog);
  return nextCatalog.analyses[songId];
}

async function loadSongReference(songId) {
  const catalog = await loadSongAnalysisCatalog();
  return catalog.references?.[songId] || null;
}

async function saveSongReference(songId, reference) {
  const catalog = await loadSongAnalysisCatalog();
  const existing = catalog.references?.[songId];
  const existingSources = Array.isArray(existing?.externalReferences) ? existing.externalReferences : [];
  const incomingSources = Array.isArray(reference?.externalReferences)
    ? reference.externalReferences
    : (reference ? [reference] : []);
  const mergedSources = [...existingSources];
  incomingSources.forEach((entry) => {
    if (!entry || typeof entry !== "object") {
      return;
    }
    const duplicate = mergedSources.find((source) =>
      String(source.provider || "") === String(entry.provider || "")
      && String(source.sourceUrl || "") === String(entry.sourceUrl || "")
      && Number(source.bpm || 0) === Number(entry.bpm || 0)
      && String(source.key || "") === String(entry.key || "")
      && String(source.altKey || "") === String(entry.altKey || "")
    );
    if (!duplicate) {
      mergedSources.push(entry);
    }
  });
  const nextReference = {
    ...(existing && typeof existing === "object" ? existing : {}),
    ...(reference && typeof reference === "object" ? reference : {}),
    externalReferences: mergedSources,
    songId,
    savedAt: new Date().toISOString(),
  };
  const nextCatalog = {
    analyses: catalog.analyses,
    references: {
      ...catalog.references,
      [songId]: nextReference,
    },
    updatedAt: new Date().toISOString(),
  };
  await saveAsset(SONG_ANALYSIS_ASSET_KEY, nextCatalog);
  return nextReference;
}

export {
  SONG_ANALYSIS_ASSET_KEY,
  loadSongAnalysis,
  loadSongAnalysisCatalog,
  loadSongReference,
  saveSongAnalysis,
  saveSongReference,
};
