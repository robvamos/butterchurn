import { loadAsset, saveAsset } from "./settingsDb.js";
import { defaultReactiveStrategies } from "../jammer/drums/reactiveStrategies.js";

const JAMMER_STRATEGY_ASSET_KEY = "jammerReactiveStrategies";

function cloneDefaultStrategies() {
  return defaultReactiveStrategies.map((strategy) => structuredClone(strategy));
}

function normalizeStrategyState(state) {
  const defaults = cloneDefaultStrategies();
  const entries = Array.isArray(state?.entries) ? state.entries : [];
  const mergedEntries = entries.length > 0 ? entries : defaults;

  return {
    entries: mergedEntries
      .map((strategy, index) => ({
        ...structuredClone(defaults[index] || {}),
        ...strategy,
        enabled: strategy?.enabled !== false,
        priority: Number(strategy?.priority ?? defaults[index]?.priority ?? 0),
        when: {
          ...(defaults[index]?.when || {}),
          ...(strategy?.when || {}),
        },
        patch: {
          ...(defaults[index]?.patch || {}),
          ...(strategy?.patch || {}),
        },
      }))
      .sort((left, right) => Number(right.priority || 0) - Number(left.priority || 0)),
    updatedAt: state?.updatedAt || null,
  };
}

async function loadJammerReactiveStrategies() {
  const state = await loadAsset(JAMMER_STRATEGY_ASSET_KEY);
  if (!state) {
    const seeded = {
      entries: cloneDefaultStrategies(),
      updatedAt: new Date().toISOString(),
    };
    await saveAsset(JAMMER_STRATEGY_ASSET_KEY, seeded);
    return seeded.entries;
  }

  return normalizeStrategyState(state).entries;
}

async function saveJammerReactiveStrategies(entries) {
  const nextState = normalizeStrategyState({
    entries,
    updatedAt: new Date().toISOString(),
  });
  await saveAsset(JAMMER_STRATEGY_ASSET_KEY, nextState);
  return nextState.entries;
}

export { JAMMER_STRATEGY_ASSET_KEY, loadJammerReactiveStrategies, saveJammerReactiveStrategies };
