import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';
import { LinkChecker } from 'linkinator';

const dist = join(process.cwd(), 'dist');
if (!existsSync(join(dist, 'index.html'))) {
  console.error('dist/index.html não encontrado. Rode npm run build antes.');
  process.exit(1);
}

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.xml': 'application/xml',
  '.txt': 'text/plain; charset=utf-8',
};

const server = createServer((req, res) => {
  const url = new URL(req.url || '/', 'http://127.0.0.1');
  let path = decodeURIComponent(url.pathname);
  if (path.endsWith('/')) path += 'index.html';
  const file = join(dist, path);
  if (!file.startsWith(dist) || !existsSync(file) || statSync(file).isDirectory()) {
    res.writeHead(404);
    res.end('Not found');
    return;
  }
  res.writeHead(200, { 'Content-Type': mime[extname(file)] || 'application/octet-stream' });
  res.end(readFileSync(file));
});

await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const { port } = server.address();
const base = `http://127.0.0.1:${port}`;

const checker = new LinkChecker();
const result = await checker.check({
  path: base,
  recurse: true,
  linksToSkip: [
    /^https?:\/\/(?!127\.0\.0\.1)/, // skip external in CI-ish check; we still list them
  ],
});

// Re-run including externals but only report broken internals as fail;
// externals that fail (instagram etc.) are warnings.
const full = await checker.check({
  path: base,
  recurse: true,
});

server.close();

const brokenInternal = full.links.filter(
  (l) => l.state === 'BROKEN' && String(l.url).startsWith(base)
);
const brokenExternal = full.links.filter(
  (l) => l.state === 'BROKEN' && !String(l.url).startsWith(base)
);

console.log(`links: scanned ${full.links.length}`);
if (brokenExternal.length) {
  console.warn(`links: ${brokenExternal.length} external warning(s)`);
  for (const l of brokenExternal.slice(0, 10)) {
    console.warn(`  ⚠ ${l.status} ${l.url}`);
  }
}
if (brokenInternal.length) {
  console.error(`links: ${brokenInternal.length} broken internal link(s)`);
  for (const l of brokenInternal) {
    console.error(`  ✖ ${l.status} ${l.url}`);
  }
  process.exit(1);
}

console.log('links: all internal links OK');
