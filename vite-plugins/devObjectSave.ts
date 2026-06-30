import { writeFileSync } from 'fs';
import { resolve } from 'path';
import type { Plugin } from 'vite';

const OBJECTS_PATH = resolve(__dirname, '../data/objects.json');

function readRequestBody(req: import('http').IncomingMessage): Promise<string> {
  return new Promise((resolvePromise, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => resolvePromise(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Dev-only middleware: POST /__dev/save-objects writes data/objects.json. */
export function devObjectSavePlugin(): Plugin {
  return {
    name: 'dev-object-save',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.url !== '/__dev/save-objects' || req.method !== 'POST') {
          next();
          return;
        }

        try {
          const raw = await readRequestBody(req);
          const payload = JSON.parse(raw) as unknown;

          if (!isPlainObject(payload)) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ ok: false, error: 'Expected a JSON object.' }));
            return;
          }

          for (const [key, def] of Object.entries(payload)) {
            if (!isPlainObject(def)) {
              res.statusCode = 400;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ ok: false, error: `Invalid definition for "${key}".` }));
              return;
            }
            if (
              typeof def.sizeClass !== 'string' ||
              typeof def.mass !== 'number' ||
              typeof def.color !== 'string' ||
              typeof def.shape !== 'string' ||
              !Array.isArray(def.scale) ||
              def.scale.length !== 3
            ) {
              res.statusCode = 400;
              res.setHeader('Content-Type', 'application/json');
              res.end(
                JSON.stringify({ ok: false, error: `Missing required fields on "${key}".` })
              );
              return;
            }
          }

          writeFileSync(OBJECTS_PATH, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');

          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ ok: true }));
        } catch (err) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ ok: false, error: String(err) }));
        }
      });
    },
  };
}
