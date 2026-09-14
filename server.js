#!/usr/bin/env node
/**
 * Green H2 Plant Digital Twin — local development server.
 *
 * Zero dependencies: plain Node http + fs. Serves ./public over http://localhost.
 *
 * Serving over http://localhost (rather than opening the file directly) matters
 * for this app: localhost is a secure origin, so the browser's Geolocation API
 * works in Live Mode, which it does not on file:// pages.
 *
 *   node server.js              → http://localhost:3000
 *   node server.js --port 8080  → http://localhost:8080
 *   PORT=8080 node server.js
 *   node server.js --host 0.0.0.0   (expose on the LAN)
 */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');

const ROOT = path.join(__dirname, 'public');

const argv = process.argv.slice(2);
const argOf = (name) => {
  const i = argv.indexOf(`--${name}`);
  return i !== -1 && argv[i + 1] ? argv[i + 1] : null;
};

const PORT = Number(argOf('port') || process.env.PORT || 3000);
// Bind to loopback by default; --host 0.0.0.0 opts in to exposing it on the network.
const HOST = argOf('host') || process.env.HOST || '127.0.0.1';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.map': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
};

const stat = promisify(fs.stat);

function send(res, status, body, headers = {}) {
  res.writeHead(status, { 'Content-Length': Buffer.byteLength(body), ...headers });
  res.end(body);
}

/** Resolve a URL path to a file inside ROOT, or null if it escapes ROOT. */
function resolveSafe(urlPath) {
  let decoded;
  try {
    decoded = decodeURIComponent(urlPath.split('?')[0].split('#')[0]);
  } catch {
    return null; // malformed percent-encoding
  }
  const target = path.resolve(ROOT, '.' + path.posix.normalize(decoded));
  if (target !== ROOT && !target.startsWith(ROOT + path.sep)) return null;
  return target;
}

const server = http.createServer(async (req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return send(res, 405, 'Method Not Allowed', { 'Content-Type': MIME['.txt'], Allow: 'GET, HEAD' });
  }

  let file = resolveSafe(req.url || '/');
  if (!file) return send(res, 403, 'Forbidden', { 'Content-Type': MIME['.txt'] });

  try {
    let info = await stat(file);
    if (info.isDirectory()) {
      file = path.join(file, 'index.html');
      info = await stat(file);
    }

    const ext = path.extname(file).toLowerCase();
    const type = MIME[ext] || 'application/octet-stream';
    // Vendored libraries are immutable and versioned; app sources must never go
    // stale while you are editing them.
    const cache = file.includes(`${path.sep}vendor${path.sep}`)
      ? 'public, max-age=31536000, immutable'
      : 'no-cache';

    res.writeHead(200, {
      'Content-Type': type,
      'Content-Length': info.size,
      'Cache-Control': cache,
      'X-Content-Type-Options': 'nosniff',
    });
    if (req.method === 'HEAD') return res.end();

    fs.createReadStream(file)
      .on('error', () => res.destroy())
      .pipe(res);
  } catch (err) {
    if (err.code === 'ENOENT' || err.code === 'ENOTDIR') {
      return send(res, 404, `404 — not found: ${req.url}`, { 'Content-Type': MIME['.txt'] });
    }
    console.error(err);
    return send(res, 500, 'Internal Server Error', { 'Content-Type': MIME['.txt'] });
  }
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n  Port ${PORT} is already in use. Try:  node server.js --port ${PORT + 1}\n`);
    process.exit(1);
  }
  throw err;
});

server.listen(PORT, HOST, () => {
  const shown = HOST === '0.0.0.0' ? 'localhost' : HOST;
  console.log(`\n  Green H₂ Digital Twin running at  http://${shown}:${PORT}`);
  console.log(`  Serving ${ROOT}`);
  console.log('  Press Ctrl+C to stop.\n');
});

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => server.close(() => process.exit(0)));
}
