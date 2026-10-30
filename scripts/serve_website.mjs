import { createServer } from 'node:http';
import pg from 'pg';
import { createAPI } from './contribution_api.mjs';
import { checkSchema } from '../db/migrate.mjs';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';

// Serve a fixed public asset list, never the checkout, runtime files or credentials.
const files = {
  '/index.html': 'text/html; charset=utf-8', '/style.css': 'text/css; charset=utf-8',
  '/render-markdown.mjs': 'text/javascript; charset=utf-8', '/vendor/markdown-it.mjs': 'text/javascript; charset=utf-8',
  '/vendor/markdown-it-LICENSE.txt': 'text/plain; charset=utf-8',
  '/library.mjs': 'text/javascript; charset=utf-8',
  '/app.mjs': 'text/javascript; charset=utf-8', '/contribution.mjs': 'text/javascript; charset=utf-8',
  '/favicon.svg': 'image/svg+xml', '/assets/hero.png': 'image/png',
  '/assets/NanumGothic-Regular.ttf': 'font/ttf', '/assets/NanumGothic-Bold.ttf': 'font/ttf',
  '/assets/OFL.txt': 'text/plain; charset=utf-8', '/robots.txt': 'text/plain; charset=utf-8',
};
const policy = "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; font-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";

export function createSiteServer(options = {}) {
  const api = createAPI(options);
  const assets = new Map(Object.entries(files).map(([path, type]) => {
    const body = readFileSync(new URL(`../dist${path}`, import.meta.url));
    return [path, { body, type, etag: `"${createHash('sha256').update(body).digest('hex')}"` }];
  }));
  return createServer({ requestTimeout: 15000, headersTimeout: 10000 }, (req, res) => {
    res.setHeader('Content-Security-Policy', policy);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    res.setHeader('X-Frame-Options', 'DENY');
    const apiPath = req.url.split('?')[0];
    if (apiPath.startsWith('/api/')) { void api(req, res, apiPath); return; }
    if (!['GET', 'HEAD'].includes(req.method)) {
      res.writeHead(405, { Allow: 'GET, HEAD' }); res.end(); return;
    }
    let path;
    try { path = decodeURIComponent(req.url.split('?')[0]); }
    catch { res.writeHead(400); res.end(); return; }
    const asset = assets.get(path === '/' ? '/index.html' : path);
    if (!asset) { res.writeHead(404); res.end(); return; }
    res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
    res.setHeader('ETag', asset.etag);
    if (req.headers['if-none-match'] === asset.etag) { res.writeHead(304); res.end(); return; }
    res.writeHead(200, { 'Content-Type': asset.type, 'Content-Length': asset.body.length });
    res.end(req.method === 'HEAD' ? undefined : asset.body);
  });
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const port = Number(process.env.PORT || 4318);
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('PORT must be between 1024 and 65535');
  if (!process.env.DATABASE_URL || !process.env.PUBLIC_ORIGIN || !process.env.RATE_LIMIT_SECRET) throw new Error('Database, public origin and rate secret are required');
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 8, connectionTimeoutMillis: 5000, statement_timeout: 10000 });
  pool.on('error', () => console.error('Database connection interrupted'));
  await checkSchema(pool);
  const server = createSiteServer({ pool, origin: process.env.PUBLIC_ORIGIN, rateSecret: process.env.RATE_LIMIT_SECRET, trustProxy: process.env.TRUST_CLOUDFLARE === 'true' });
  server.listen(port, '127.0.0.1', () => console.log(`Website listening on http://127.0.0.1:${port}`));
  for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => server.close(() => void pool.end()));
}
