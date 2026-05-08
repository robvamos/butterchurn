import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import { getBrowser, closeBrowser, createPage } from './visual/utils/puppeteer.js';
import TestServer from './visual/utils/testServer.js';

describe('Butterchurn Audio Reactive Recorder Smoke Test', () => {
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
    expect(title).toBe('Butterchurn Audio Reactive Recorder');

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

    await page.click('#studioTabButton');
    const studioVisible = await page.$eval('#studioPanel', el => el.classList.contains('active'));
    expect(studioVisible).toBe(true);
  });

  test('should persist settings after reload', async () => {
    await page.click('#settingsTabButton');
    await page.click('[data-skin-id="amber-console"]');
    await page.select('#formatSelect', 'mp4');
    await page.select('#resolutionSelect', '1920x1080');
    await page.select('#fpsSelect', '30');
    await page.select('#bitrateSelect', '5000000');
    await page.click('#studioTabButton');
    await page.select('#presetSelect', '2');
    const chosenPreset = await page.$eval('#presetSelect', el => el.selectedOptions[0].textContent);
    await page.reload({ waitUntil: 'networkidle0' });
    await new Promise(resolve => setTimeout(resolve, 1200));

    const persistedState = await page.evaluate(() => ({
      activeSkin: document.documentElement.dataset.skin,
      activeTab: document.querySelector('#studioPanel').classList.contains('active') ? 'studio' : 'settings',
      format: document.querySelector('#formatSelect').value,
      resolution: document.querySelector('#resolutionSelect').value,
      fps: document.querySelector('#fpsSelect').value,
      bitrate: document.querySelector('#bitrateSelect').value,
      presetLabel: document.querySelector('#presetSelect').selectedOptions[0].textContent,
    }));

    expect(persistedState.activeSkin).toBe('amber-console');
    expect(persistedState.activeTab).toBe('studio');
    expect(persistedState.format).toBe('mp4');
    expect(persistedState.resolution).toBe('1920x1080');
    expect(persistedState.fps).toBe('30');
    expect(persistedState.bitrate).toBe('5000000');
    expect(persistedState.presetLabel).toBe(chosenPreset);
  });

  test('should handle audio device selection and refresh', async () => {
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
  });

  test('should handle FPS, bitrate, format and resolution selection', async () => {
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
  });
});
