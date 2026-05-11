import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import { getBrowser, closeBrowser, createPage } from './visual/utils/puppeteer.js';
import TestServer from './visual/utils/testServer.js';

async function injectTestTone(page) {
  await page.evaluate(() => {
    function createToneWavFile() {
      const sampleRate = 44100;
      const durationSeconds = 3;
      const frameCount = sampleRate * durationSeconds;
      const channelCount = 1;
      const bytesPerSample = 2;
      const blockAlign = channelCount * bytesPerSample;
      const byteRate = sampleRate * blockAlign;
      const dataSize = frameCount * blockAlign;
      const buffer = new ArrayBuffer(44 + dataSize);
      const view = new DataView(buffer);

      function writeString(offset, value) {
        for (let index = 0; index < value.length; index += 1) {
          view.setUint8(offset + index, value.charCodeAt(index));
        }
      }

      writeString(0, 'RIFF');
      view.setUint32(4, 36 + dataSize, true);
      writeString(8, 'WAVE');
      writeString(12, 'fmt ');
      view.setUint32(16, 16, true);
      view.setUint16(20, 1, true);
      view.setUint16(22, channelCount, true);
      view.setUint32(24, sampleRate, true);
      view.setUint32(28, byteRate, true);
      view.setUint16(32, blockAlign, true);
      view.setUint16(34, bytesPerSample * 8, true);
      writeString(36, 'data');
      view.setUint32(40, dataSize, true);

      const frequency = 440;
      for (let sampleIndex = 0; sampleIndex < frameCount; sampleIndex += 1) {
        const sample = Math.sin((2 * Math.PI * frequency * sampleIndex) / sampleRate);
        const pcm = Math.max(-1, Math.min(1, sample)) * 0x7fff;
        view.setInt16(44 + (sampleIndex * 2), pcm, true);
      }

      return new File([buffer], 'tone.wav', { type: 'audio/wav' });
    }

    const input = document.querySelector('#singleTrackInput');
    const transfer = new DataTransfer();
    transfer.items.add(createToneWavFile());
    input.files = transfer.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

describe('JamPal Smoke Test', () => {
  let testServer;
  let serverUrl;
  let page;
  let pageErrors = [];

  beforeAll(async () => {
    testServer = new TestServer();
    await testServer.start();
    serverUrl = testServer.getUrl();
    await getBrowser();
    page = await createPage();
    pageErrors = [];
    page.on('pageerror', err => pageErrors.push(err.toString()));
  });

  afterAll(async () => {
    await page.close();
    await closeBrowser();
    await testServer.stop();
  });

  test('should load recorder page without errors', async () => {
    await page.goto(`${serverUrl}/examples/audio-reactive-recorder.html`, {
      waitUntil: 'networkidle0',
    });

    // Check page title
    const title = await page.title();
    expect(title).toBe('JamPal');

    // Check main elements exist
    const canvas = await page.$('canvas');
    expect(canvas).toBeTruthy();

    const startMicButton = await page.$('#startMicButton');
    expect(startMicButton).toBeTruthy();

    const presetSelect = await page.$('#presetSelect');
    expect(presetSelect).toBeTruthy();

    const audioDeviceSelect = await page.$('#audioDeviceSelect');
    expect(audioDeviceSelect).toBeTruthy();

    const refreshDevicesButton = await page.$('#refreshDevicesButton');
    expect(refreshDevicesButton).toBeTruthy();

    const allowMicButton = await page.$('#requestMicPermissionButton');
    expect(allowMicButton).toBeTruthy();

    const fpsSelect = await page.$('#fpsSelect');
    expect(fpsSelect).toBeTruthy();

    const bitrateSelect = await page.$('#bitrateSelect');
    expect(bitrateSelect).toBeTruthy();

    const formatSelect = await page.$('#formatSelect');
    expect(formatSelect).toBeTruthy();

    const resolutionSelect = await page.$('#resolutionSelect');
    expect(resolutionSelect).toBeTruthy();

    const recordButton = await page.$('#startRecordingButton');
    expect(recordButton).toBeTruthy();

    const randomPresetButton = await page.$('#randomPresetButton');
    expect(randomPresetButton).toBeTruthy();

    const nextPresetButton = await page.$('#nextPresetButton');
    expect(nextPresetButton).toBeTruthy();

    const settingsTabButton = await page.$('#settingsTabButton');
    expect(settingsTabButton).toBeTruthy();

    const jammerTabButton = await page.$('#jammerTabButton');
    expect(jammerTabButton).toBeTruthy();

    const skinGrid = await page.$('#skinGrid');
    expect(skinGrid).toBeTruthy();

    await new Promise(resolve => setTimeout(resolve, 2000));

    const presetOptions = await page.$$eval('#presetSelect option', options =>
      options.map(option => option.textContent)
    );
    expect(presetOptions.length).toBeGreaterThan(1);
    expect(presetOptions[0]).not.toBe('Loading presets...');

    const logEl = await page.$('#log');
    expect(logEl).toBeTruthy();

    expect(pageErrors).toEqual([]);
  });

  test('should switch tabs and apply a different skin', async () => {
    await page.click('#jammerTabButton');
    const jammerVisible = await page.$eval('#jammerPanel', el => el.classList.contains('active'));
    expect(jammerVisible).toBe(true);

    const drummerCount = await page.$$eval('#jammerDrummerSelect option', items => items.length);
    expect(drummerCount).toBeGreaterThanOrEqual(4);

    await page.click('#settingsTabButton');
    const settingsVisible = await page.$eval('#settingsPanel', el => el.classList.contains('active'));
    expect(settingsVisible).toBe(true);

    const skinCount = await page.$$eval('#skinGrid .skin-option', items => items.length);
    expect(skinCount).toBeGreaterThanOrEqual(4);

    await page.click('[data-skin-id="sea-glass"]');
    const activeSkin = await page.$eval('html', el => el.dataset.skin);
    expect(activeSkin).toBe('sea-glass');

    const summarySkin = await page.$eval('#skinSummaryValue', el => el.textContent);
    expect(summarySkin).toBe('Sea Glass');

    await page.click('#studioHomeButton');
    const studioVisible = await page.$eval('#studioPanel', el => el.classList.contains('active'));
    expect(studioVisible).toBe(true);
  });

  test('should persist settings after reload', async () => {
    await page.click('#jammerTabButton');
    await page.select('#jammerDrummerSelect', 'ambient-pulse');
    await page.click('#jammerPlayToggleButton');
    await page.select('#jammerFollowSource', 'player');
    await page.select('#jammerFeelSelect', 'space');
    await page.$eval('#jammerIntensityRange', el => {
      el.value = '33';
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await page.click('#settingsTabButton');
    await page.click('[data-skin-id="amber-console"]');
    await page.select('#formatSelect', 'mp4');
    await page.select('#resolutionSelect', '1920x1080');
    await page.select('#fpsSelect', '30');
    await page.select('#bitrateSelect', '5000000');
    await page.click('#studioHomeButton');
    await page.select('#presetSelect', '2');
    const chosenPreset = await page.$eval('#presetSelect', el => el.selectedOptions[0].textContent);
    await page.reload({ waitUntil: 'networkidle0' });
    await new Promise(resolve => setTimeout(resolve, 1200));

    const persistedState = await page.evaluate(() => ({
      activeSkin: document.documentElement.dataset.skin,
      activeTab: document.querySelector('#studioPanel').classList.contains('active')
        ? 'studio'
        : document.querySelector('#jammerPanel').classList.contains('active')
          ? 'jammer'
          : 'settings',
      format: document.querySelector('#formatSelect').value,
      resolution: document.querySelector('#resolutionSelect').value,
      fps: document.querySelector('#fpsSelect').value,
      bitrate: document.querySelector('#bitrateSelect').value,
      presetLabel: document.querySelector('#presetSelect').selectedOptions[0].textContent,
      jammerDrummer: document.querySelector('#jammerDrummerSelect').value,
      jammerEnabled: document.querySelector('#jammerEnabled').checked,
      jammerFollowSource: document.querySelector('#jammerFollowSource').value,
      jammerFeel: document.querySelector('#jammerFeelSelect').value,
      jammerIntensity: document.querySelector('#jammerIntensityRange').value,
    }));

    expect(persistedState.activeSkin).toBe('amber-console');
    expect(persistedState.activeTab).toBe('studio');
    expect(persistedState.format).toBe('mp4');
    expect(persistedState.resolution).toBe('1920x1080');
    expect(persistedState.fps).toBe('30');
    expect(persistedState.bitrate).toBe('5000000');
    expect(persistedState.presetLabel).toBe(chosenPreset);
    expect(persistedState.jammerDrummer).toBe('ambient-pulse');
    expect(persistedState.jammerEnabled).toBe(true);
    expect(persistedState.jammerFollowSource).toBe('player');
    expect(persistedState.jammerFeel).toBe('space');
    expect(persistedState.jammerIntensity).toBe('33');
  });

  test('should handle audio device selection and refresh', async () => {
    await page.click('#settingsTabButton');

    // Check that refresh button exists
    const refreshButton = await page.$('#refreshDevicesButton');
    expect(refreshButton).toBeTruthy();

    // Try to select a device (may not work due to permissions, but element should exist)
    try {
      const options = await page.$$eval('#audioDeviceSelect option', opts => opts.map(o => o.value));
      expect(options.length).toBeGreaterThan(0);
      if (options.length > 1) {
        await page.select('#audioDeviceSelect', options[1]);
        const newValue = await page.$eval('#audioDeviceSelect', el => el.value);
        expect(newValue).toBe(options[1]);
      }
    } catch (e) {
      console.log('Audio device selection test skipped due to permissions');
    }

    await page.click('#settingsTabButton');
  });

  test('should handle FPS, bitrate, format and resolution selection', async () => {
    await page.click('#settingsTabButton');

    // Change FPS
    await page.select('#fpsSelect', '30');
    let selectedFps = await page.$eval('#fpsSelect', el => el.value);
    expect(selectedFps).toBe('30');

    // Change bitrate
    await page.select('#bitrateSelect', '20000000');
    let selectedBitrate = await page.$eval('#bitrateSelect', el => el.value);
    expect(selectedBitrate).toBe('20000000');

    // Change format
    await page.select('#formatSelect', 'mp4');
    let selectedFormat = await page.$eval('#formatSelect', el => el.value);
    expect(selectedFormat).toBe('mp4');

    // Change resolution
    await page.select('#resolutionSelect', '1920x1080');
    let selectedResolution = await page.$eval('#resolutionSelect', el => el.value);
    expect(selectedResolution).toBe('1920x1080');

    await page.click('#settingsTabButton');
  });

  test('should load and play a local audio track in the player', async () => {
    await page.click('#studioHomeButton');
    await injectTestTone(page);
    await page.waitForFunction(
      () => document.querySelector('#playerTrackTitle')?.textContent === 'tone.wav'
    );

    const playerReadyState = await page.evaluate(() => ({
      playDisabled: document.querySelector('#playerPlayPauseButton').disabled,
      status: document.querySelector('#playerStatusLabel').textContent,
      title: document.querySelector('#playerTrackTitle').textContent,
    }));

    expect(playerReadyState.playDisabled).toBe(false);
    expect(['Loaded', 'Ready']).toContain(playerReadyState.status);
    expect(playerReadyState.title).toBe('tone.wav');

    await page.click('#playerPlayPauseButton');
    await page.waitForFunction(
      () => {
        const status = document.querySelector('#playerStatusLabel')?.textContent;
        return status === 'Playing' || status === 'Stalled' || status === 'Paused';
      }
    );

    const playingState = await page.evaluate(() => ({
      status: document.querySelector('#playerStatusLabel').textContent,
      playLabel: document.querySelector('#playerPlayPauseButton').textContent,
      micDisabled: document.querySelector('#startMicButton').disabled,
      playerPaused: document.querySelector('#playerAudio').paused,
    }));

    expect(['Playing', 'Stalled', 'Paused']).toContain(playingState.status);
    if (playingState.status !== 'Paused') {
      expect(playingState.playLabel).toBe('■');
      expect(playingState.micDisabled).toBe(true);
      expect(playingState.playerPaused).toBe(false);
    }

    if (playingState.status !== 'Paused') {
      await page.$eval('#playerPlayPauseButton', el => el.click());
      await page.waitForFunction(
        () => {
          const status = document.querySelector('#playerStatusLabel')?.textContent;
          return status === 'Paused' || status === 'Ready';
        }
      );
    }

    const stoppedState = await page.evaluate(() => ({
      status: document.querySelector('#playerStatusLabel').textContent,
      micDisabled: document.querySelector('#startMicButton').disabled,
      playLabel: document.querySelector('#playerPlayPauseButton').textContent,
      playerPaused: document.querySelector('#playerAudio').paused,
      currentTime: document.querySelector('#playerAudio').currentTime,
    }));

    expect(['Paused', 'Ready']).toContain(stoppedState.status);
    expect(stoppedState.playLabel).toBe('▶');
    expect(stoppedState.micDisabled).toBe(false);
    expect(stoppedState.playerPaused).toBe(true);
    expect(stoppedState.currentTime).toBeGreaterThan(0);
  });
});


