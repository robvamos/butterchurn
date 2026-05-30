import { describe, test, expect } from '@jest/globals';
import { buildBpmBenchmarkManifestUrls } from '../src/bpmBenchmarkService.js';

describe('bpmBenchmarkService', () => {
  test('builds same-origin manifest URLs before any configured fallback URLs', () => {
    const locationLike = {
      origin: 'http://localhost:4173',
    };
    const globalObject = {
      __JAMPAL_BPM_BENCHMARK_MANIFEST_URL__: 'http://localhost:4174/__jam-bpmtest__/index.json',
      __JAMPAL_BPM_BENCHMARK_MANIFEST_URLS__: [
        'http://127.0.0.1:4174/__jam-bpmtest__/index.json',
        'http://localhost:4174/__jam-bpmtest__/index.json',
      ],
    };

    expect(buildBpmBenchmarkManifestUrls(locationLike, globalObject)).toEqual([
      '/__jam-bpmtest__/index.json',
      'http://localhost:4173/__jam-bpmtest__/index.json',
      'http://localhost:4174/__jam-bpmtest__/index.json',
      'http://127.0.0.1:4174/__jam-bpmtest__/index.json',
    ]);
  });

  test('ignores blank configured entries and deduplicates URLs', () => {
    const locationLike = {
      origin: 'https://jam.example',
    };
    const globalObject = {
      __JAMPAL_BPM_BENCHMARK_MANIFEST_URL__: '   ',
      __JAMPAL_BPM_BENCHMARK_MANIFEST_URLS__: [
        '',
        'https://jam.example/__jam-bpmtest__/index.json',
        'https://jam.example/__jam-bpmtest__/index.json',
      ],
    };

    expect(buildBpmBenchmarkManifestUrls(locationLike, globalObject)).toEqual([
      '/__jam-bpmtest__/index.json',
      'https://jam.example/__jam-bpmtest__/index.json',
    ]);
  });
});
