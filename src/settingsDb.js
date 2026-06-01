const DB_NAME = "audio-reactive-recorder-db";
const STORE_NAME = "app-settings";
const ASSET_STORE_NAME = "app-assets";
const DB_VERSION = 5;

const defaultSettings = {
  activeTab: "studio",
  audioDeviceId: "",
  autoCycleEnabled: true,
  format: "webm",
  fps: "60",
  playerBassGain: "0",
  playerAutoplay: true,
  playerCurrentTime: "0",
  playerMidGain: "0",
  playerSourceKind: "",
  playerTrackIndex: "0",
  playerTrebleGain: "0",
  playerVolume: "82",
  presetName: "",
  resolution: "1280x720",
  skinId: "midnight-signal",
  visualizerEnabled: true,
  cycleSeconds: "15",
  bitrate: "10000000",
  jammerDrummerId: "reactive-kit",
  jammerDetectionEnabled: false,
  jammerDetectorMode: "fusion",
  jammerEnabled: false,
  jammerFeel: "assist",
  jammerFollowSource: "auto",
  jammerTimingModel: "kalman",
  jammerHumanize: "18",
  jammerIntensity: "55",
  jammerDensity: "48",
  jammerSwing: "8",
  jammerTempo: "104",
  jammerVolume: "72",
  sunoSearchQuery: "",
  sunoSelectedSongId: "",
  sunoVisibilityFilter: "all",
  jammerMainPanelCollapsed: false,
  jammerLabOpen: true,
  jammerStrategiesOpen: false,
  jammerDeckLibraryOpen: false,
  detectorCalibrationCollapsed: false,
  detectionPanelCollapsed: false,
  moduleContributionsCollapsed: false,
  bpmBenchmarkCollapsed: false,
  detectionExperimentCollapsed: false,
  wiringPanelCollapsed: false,
  stagePanelCollapsed: false,
  detectionExperimentConfig: null,
  detectionExperimentPluginConfigs: null,
  detectionExperimentChartWindowSeconds: 8,
  detectionExperimentPresets: [],
  detectionExperimentLastPresetId: "",
  detectionExperimentSoloEnabled: false,
};

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.addEventListener("upgradeneeded", () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME);
      }
      if (!database.objectStoreNames.contains(ASSET_STORE_NAME)) {
        database.createObjectStore(ASSET_STORE_NAME);
      }
    });

    request.addEventListener("success", () => resolve(request.result));
    request.addEventListener("error", () => reject(request.error));
  });
}

async function withStore(storeName, mode, callback) {
  const database = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, mode);
    const store = transaction.objectStore(storeName);

    let callbackResult;
    try {
      callbackResult = callback(store);
    } catch (error) {
      database.close();
      reject(error);
      return;
    }

    transaction.addEventListener("complete", () => {
      database.close();
      resolve(callbackResult);
    });
    transaction.addEventListener("error", () => {
      database.close();
      reject(transaction.error);
    });
    transaction.addEventListener("abort", () => {
      database.close();
      reject(transaction.error || new Error("Settings transaction aborted"));
    });
  });
}

export async function loadSettings() {
  const settings = { ...defaultSettings };

  await withStore(STORE_NAME, "readonly", (store) => {
    Object.keys(defaultSettings).forEach((key) => {
      const request = store.get(key);
      request.addEventListener("success", () => {
        if (request.result !== undefined) {
          settings[key] = request.result;
        }
      });
    });
  });

  return settings;
}

export async function saveSetting(key, value) {
  return withStore(STORE_NAME, "readwrite", (store) => {
    store.put(value, key);
  });
}

export async function loadAsset(key) {
  let result;

  await withStore(ASSET_STORE_NAME, "readonly", (store) => {
    const request = store.get(key);
    request.addEventListener("success", () => {
      result = request.result;
    });
  });

  return result;
}

export async function saveAsset(key, value) {
  return withStore(ASSET_STORE_NAME, "readwrite", (store) => {
    store.put(value, key);
  });
}

export async function deleteAsset(key) {
  return withStore(ASSET_STORE_NAME, "readwrite", (store) => {
    store.delete(key);
  });
}

export { defaultSettings };
