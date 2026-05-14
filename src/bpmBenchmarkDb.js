import { loadAsset, saveAsset } from "./settingsDb.js";

const BPM_BENCHMARK_ASSET_KEY = "jammerBpmBenchmarkCatalog";

const defaultBenchmarkState = {
  entries: {},
  updatedAt: null,
};

async function loadBpmBenchmarkCatalog() {
  const state = await loadAsset(BPM_BENCHMARK_ASSET_KEY);
  if (!state) {
    return structuredClone(defaultBenchmarkState);
  }

  return {
    entries: state.entries && typeof state.entries === "object" ? state.entries : {},
    updatedAt: state.updatedAt || null,
  };
}

async function loadBpmBenchmarkEntry(fileId) {
  if (!fileId) {
    return null;
  }
  const catalog = await loadBpmBenchmarkCatalog();
  return catalog.entries?.[fileId] || null;
}

async function saveBpmBenchmarkEntry(fileId, entry) {
  if (!fileId) {
    throw new Error("fileId is required");
  }

  const catalog = await loadBpmBenchmarkCatalog();
  const existing = catalog.entries?.[fileId] || {};
  const nextEntry = {
    ...existing,
    ...entry,
    fileId,
    savedAt: new Date().toISOString(),
  };

  const nextCatalog = {
    entries: {
      ...catalog.entries,
      [fileId]: nextEntry,
    },
    updatedAt: new Date().toISOString(),
  };

  await saveAsset(BPM_BENCHMARK_ASSET_KEY, nextCatalog);
  return nextEntry;
}

async function saveBpmBenchmarkRun(fileId, run) {
  if (!fileId) {
    throw new Error("fileId is required");
  }

  const entry = (await loadBpmBenchmarkEntry(fileId)) || {};
  const existingHistory = Array.isArray(entry.history) ? entry.history : [];
  const nextHistory = [
    {
      ...run,
      fileId,
      savedAt: new Date().toISOString(),
    },
    ...existingHistory,
  ].slice(0, 40);

  return saveBpmBenchmarkEntry(fileId, {
    ...entry,
    latestRun: nextHistory[0],
    history: nextHistory,
  });
}

export {
  BPM_BENCHMARK_ASSET_KEY,
  loadBpmBenchmarkCatalog,
  loadBpmBenchmarkEntry,
  saveBpmBenchmarkEntry,
  saveBpmBenchmarkRun,
};
