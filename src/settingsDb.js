const DB_NAME = "audio-reactive-recorder-db";
const STORE_NAME = "app-settings";
const DB_VERSION = 1;

const defaultSettings = {
  activeTab: "studio",
  audioDeviceId: "",
  format: "webm",
  fps: "60",
  presetName: "",
  resolution: "1280x720",
  skinId: "midnight-signal",
  cycleSeconds: "15",
  bitrate: "10000000",
};

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.addEventListener("upgradeneeded", () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME);
      }
    });

    request.addEventListener("success", () => resolve(request.result));
    request.addEventListener("error", () => reject(request.error));
  });
}

async function withStore(mode, callback) {
  const database = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, mode);
    const store = transaction.objectStore(STORE_NAME);

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

  await withStore("readonly", (store) => {
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
  return withStore("readwrite", (store) => {
    store.put(value, key);
  });
}

export { defaultSettings };
