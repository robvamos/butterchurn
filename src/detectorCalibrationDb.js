import { loadAsset, saveAsset } from "./settingsDb.js";

const DETECTOR_CALIBRATION_ASSET_KEY = "jammerDetectorCalibrationCatalog";

const defaultCalibrationState = {
  histories: {},
  updatedAt: null,
};

async function loadDetectorCalibrationCatalog() {
  const state = await loadAsset(DETECTOR_CALIBRATION_ASSET_KEY);
  if (!state) {
    return structuredClone(defaultCalibrationState);
  }

  return {
    histories: state.histories && typeof state.histories === "object" ? state.histories : {},
    updatedAt: state.updatedAt || null,
  };
}

async function loadDetectorCalibrationHistory(songId) {
  if (!songId) {
    return [];
  }
  const catalog = await loadDetectorCalibrationCatalog();
  return Array.isArray(catalog.histories?.[songId]) ? catalog.histories[songId] : [];
}

async function saveDetectorCalibrationRun(songId, run) {
  if (!songId) {
    throw new Error("songId is required");
  }

  const catalog = await loadDetectorCalibrationCatalog();
  const existing = Array.isArray(catalog.histories?.[songId]) ? catalog.histories[songId] : [];
  const nextHistory = [
    {
      ...run,
      songId,
      savedAt: new Date().toISOString(),
    },
    ...existing,
  ].slice(0, 24);

  const nextCatalog = {
    histories: {
      ...catalog.histories,
      [songId]: nextHistory,
    },
    updatedAt: new Date().toISOString(),
  };

  await saveAsset(DETECTOR_CALIBRATION_ASSET_KEY, nextCatalog);
  return nextHistory;
}

export {
  DETECTOR_CALIBRATION_ASSET_KEY,
  loadDetectorCalibrationCatalog,
  loadDetectorCalibrationHistory,
  saveDetectorCalibrationRun,
};
