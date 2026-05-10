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
  deckPresets: [],
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
    deckPresets: Array.isArray(state.deckPresets) ? state.deckPresets : [],
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

async function saveJammerDeckPreset(preset) {
  const existing = await loadJammerLabState();
  const nextPreset = {
    id: preset.id || `deck-${Date.now()}`,
    createdAt: preset.createdAt || new Date().toISOString(),
    name: preset.name || "Deck preset",
    settings: { ...(preset.settings || {}) },
  };

  const deduped = existing.deckPresets.filter((entry) => entry.id !== nextPreset.id && entry.name !== nextPreset.name);
  const nextState = {
    ...existing,
    settings: {
      ...existing.settings,
      ...(preset.settings || {}),
    },
    deckPresets: [nextPreset, ...deduped].slice(0, 16),
    updatedAt: new Date().toISOString(),
  };

  await saveAsset(JAMMER_LAB_ASSET_KEY, nextState);
  return nextState;
}

export { JAMMER_LAB_ASSET_KEY, loadJammerLabState, saveJammerDeckPreset, saveJammerLabFavorite, saveJammerLabSettings };
