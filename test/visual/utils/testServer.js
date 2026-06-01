import http from 'http';
import fs from 'fs';
import path from 'path';
import {
  getSunoProductionDetail,
  getSunoProductionsCatalog,
} from '../../../scripts/sunoLibraryServerSupport.mjs';

class TestServer {
  constructor() {
    this.server = null;
    this.port = null;
  }

  async start() {
    const projectRoot = process.cwd();
    const defaultLibraryDir = process.env.JAMPAL_LIBRARY_DIR || 'F:\\chiavetta musica';
    const libraryPrefix = '/__jam-library__';
    const bpmBenchmarkDir = path.join(projectRoot, 'BPMtest');
    const bpmBenchmarkPrefix = '/__jam-bpmtest__';
    const sunoProductionsDir = process.env.JAMPAL_SUNO_LIBRARY_DIR || 'F:\\_CODEX\\Audio2VideoPal\\SunoProductions\\SongLibrary';
    const sunoProductionsPrefix = '/__suno-productions__';
    const audioPattern = /\.(mp3|ogg|opus|wav|m4a|aac|flac)$/i;

    const contentTypes = {
      '.aac': 'audio/aac',
      '.css': 'text/css; charset=utf-8',
      '.flac': 'audio/flac',
      '.html': 'text/html; charset=utf-8',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.js': 'application/javascript; charset=utf-8',
      '.json': 'application/json; charset=utf-8',
      '.m4a': 'audio/mp4',
      '.map': 'application/json; charset=utf-8',
      '.mp3': 'audio/mpeg',
      '.ogg': 'audio/ogg',
      '.opus': 'audio/ogg',
      '.png': 'image/png',
      '.svg': 'image/svg+xml',
      '.wav': 'audio/wav',
      '.wasm': 'application/wasm',
    };

    const parseKnownBpmFromName = (name) => {
      const match = String(name || '').match(/(\d+(?:\.\d+)?)\s*-\s*bpm|(\d+(?:\.\d+)?)\s*bpm/i);
      const bpm = Number(match?.[1] || match?.[2] || 0);
      return Number.isFinite(bpm) && bpm > 0 ? bpm : 0;
    };

    this.server = http.createServer((req, res) => {
      let filePath;
      const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);

      if (urlPath === '/favicon.ico') {
        res.writeHead(204);
        res.end();
        return;
      }

      if (urlPath === `${libraryPrefix}/index.json`) {
        fs.readdir(defaultLibraryDir, { withFileTypes: true }, (err, entries) => {
          const tracks = err
            ? []
            : entries
              .filter((entry) => entry.isFile() && audioPattern.test(entry.name))
              .map((entry) => {
                const absoluteTrackPath = path.join(defaultLibraryDir, entry.name);
                const size = fs.statSync(absoluteTrackPath).size;
                return {
                  name: entry.name,
                  size,
                  url: `${libraryPrefix}/files/${encodeURIComponent(entry.name)}`,
                };
              });

          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({
            label: path.basename(defaultLibraryDir),
            path: defaultLibraryDir,
            tracks,
          }));
        });
        return;
      }

      if (urlPath === `${bpmBenchmarkPrefix}/index.json`) {
        fs.readdir(bpmBenchmarkDir, { withFileTypes: true }, (err, entries) => {
          if (err) {
            res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end('Not found');
            return;
          }

          const tracks = entries
            .filter((entry) => entry.isFile() && audioPattern.test(entry.name))
            .map((entry) => {
              const absoluteTrackPath = path.join(bpmBenchmarkDir, entry.name);
              const size = fs.statSync(absoluteTrackPath).size;
              const knownBpm = parseKnownBpmFromName(entry.name);

              return {
                id: `${entry.name}:${size}:${knownBpm}`,
                name: entry.name,
                size,
                knownBpm,
                durationLabel: '',
                url: `${bpmBenchmarkPrefix}/files/${encodeURIComponent(entry.name)}`,
              };
            });

          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({
            label: 'BPMtest',
            path: bpmBenchmarkDir,
            tracks,
          }));
        });
        return;
      }

      if (urlPath === `${sunoProductionsPrefix}/index.json`) {
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(getSunoProductionsCatalog({
          sunoProductionsDir,
          prefix: sunoProductionsPrefix,
        })));
        return;
      }

      if (urlPath.startsWith(`${bpmBenchmarkPrefix}/files/`)) {
        const fileName = urlPath.slice(`${bpmBenchmarkPrefix}/files/`.length);
        filePath = path.join(bpmBenchmarkDir, fileName);
      } else if (urlPath.startsWith(`${sunoProductionsPrefix}/songs/`) && urlPath.endsWith('.json')) {
        const songId = urlPath.slice(`${sunoProductionsPrefix}/songs/`.length, -'.json'.length);
        const detail = getSunoProductionDetail({
          sunoProductionsDir,
          prefix: sunoProductionsPrefix,
          songId,
        });
        if (!detail) {
          res.writeHead(404);
          res.end('Not found');
          return;
        }
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(detail));
        return;
      } else if (urlPath.startsWith(`${sunoProductionsPrefix}/audio/`)) {
        const songId = urlPath.slice(`${sunoProductionsPrefix}/audio/`.length).replace(/\.mp3$/i, '');
        const detail = getSunoProductionDetail({
          sunoProductionsDir,
          prefix: sunoProductionsPrefix,
          songId,
        });
        filePath = detail?.packagedAudioPath || '';
      } else if (urlPath.startsWith(`${libraryPrefix}/files/`)) {
        const fileName = urlPath.slice(`${libraryPrefix}/files/`.length);
        filePath = path.join(defaultLibraryDir, fileName);
      } else if (req.url === '/' || req.url === '/test-js.html') {
        filePath = path.join(process.cwd(), 'test/visual/test-js.html');
      } else if (req.url === '/test-wasm.html') {
        filePath = path.join(process.cwd(), 'test/visual/test-wasm.html');
      } else if (req.url.startsWith('/')) {
        filePath = path.join(projectRoot, req.url);
      } else {
        res.writeHead(404);
        res.end('Not found');
        return;
      }

      fs.readFile(filePath, (err, content) => {
        if (err) {
          res.writeHead(404);
          res.end('Not found');
          return;
        }

        const ext = path.extname(filePath);
        const contentType = contentTypes[ext] || 'application/octet-stream';

        res.writeHead(200, { 'Content-Type': contentType });
        res.end(content);
      });
    });

    return new Promise((resolve) => {
      this.server.listen(0, 'localhost', () => {
        this.port = this.server.address().port;
        resolve(this.port);
      });
    });
  }

  async stop() {
    if (this.server) {
      return new Promise((resolve) => {
        this.server.close(resolve);
      });
    }
  }

  getUrl() {
    return `http://localhost:${this.port}`;
  }
}

export default TestServer;
