import { loadAsset, saveAsset } from "./settingsDb.js";

const JAMMER_LAB_ASSET_KEY = "jammerLabSnapshots";

const defaultJammerLabState = {
  settings: {
    kickPitch: "38",
    kickDecay: "34",
    snareDecay: "18",
    hatBrightness: "52",
    labBpm: "104",
    labBars: "4",
    labStyle: "steady",
    labDynamics: "62",
    instrumentDeck: [],
    rating: "3",
    notes: "",
  },
  favorites: [],
  updatedAt: null,
};

async function loadJammerLabState() {
  const state = await loadAsset(JAMMER_LAB_ASSET_KEY);
  if (!state) {
    return structuredClone(defaultJammerLabState);
  }

  return {
    settings: {
      ...defaultJammerLabState.settings,
      ...(state.settings || {}),
    },
    favorites: Array.isArray(state.favorites) ? state.favorites : [],
    updatedAt: state.updatedAt || null,
  };
}

async function saveJammerLabSettings(settings) {
  const existing = await loadJammerLabState();
  const nextState = {
    ...existing,
    settings: {
      ...existing.settings,
      ...settings,
    },
    updatedAt: new Date().toISOString(),
  };
  await saveAsset(JAMMER_LAB_ASSET_KEY, nextState);
  return nextState;
}

async function saveJammerLabFavorite(favorite) {
  const existing = await loadJammerLabState();
  const nextFavorite = {
    id: favorite.id || `lab-${Date.now()}`,
    createdAt: favorite.createdAt || new Date().toISOString(),
    drummerId: favorite.drummerId || "reactive-kit",
    rating: favorite.rating || "3",
    notes: favorite.notes || "",
    settings: { ...(favorite.settings || {}) },
  };

  const nextState = {
    ...existing,
    settings: {
      ...existing.settings,
      ...(favorite.settings || {}),
      rating: nextFavorite.rating,
      notes: nextFavorite.notes,
    },
    favorites: [nextFavorite, ...existing.favorites].slice(0, 12),
    updatedAt: new Date().toISOString(),
  };

  await saveAsset(JAMMER_LAB_ASSET_KEY, nextState);
  return nextState;
}

export { JAMMER_LAB_ASSET_KEY, loadJammerLabState, saveJammerLabFavorite, saveJammerLabSettings };
