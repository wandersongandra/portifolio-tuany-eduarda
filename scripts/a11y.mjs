import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';

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
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.xml': 'application/xml',
  '.txt': 'text/plain; charset=utf-8',
  '.woff2': 'font/woff2',
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

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const paths = ['/', '/sobre/', '/servicos/', '/contato/'];
const violations = [];
for (const path of paths) {
  const page = await context.newPage();
  await page.goto(`${base}${path}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  for (const v of results.violations || []) {
    violations.push({ ...v, _path: path });
  }
  await page.close();
  console.log('a11y checked', path, (results.violations || []).length);
}

await browser.close();
server.close();
if (violations.length) {
  console.error(`a11y: ${violations.length} violation(s)`);
  for (const v of violations) {
    console.error(`\n[${v.impact}] ${v.id}: ${v.help}`);
    for (const n of v.nodes.slice(0, 5)) {
      console.error(`  - ${n.target.join(', ')}`);
      console.error(`    ${n.failureSummary}`);
    }
  }
  process.exit(1);
}

console.log('a11y: 0 violations (axe wcag2a/aa + wcag21a/aa)');
