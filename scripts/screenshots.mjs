import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync, mkdirSync } from 'node:fs';
import { join, extname } from 'node:path';
import { chromium } from 'playwright';

const dist = join(process.cwd(), 'dist');
const out = '/workspace/fisio-tuany-preview';
mkdirSync(out, { recursive: true });

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
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
    res.writeHead(404); res.end('Not found'); return;
  }
  res.writeHead(200, { 'Content-Type': mime[extname(file)] || 'application/octet-stream' });
  res.end(readFileSync(file));
});

await new Promise((r) => server.listen(0, '127.0.0.1', r));
const { port } = server.address();
const base = `http://127.0.0.1:${port}`;

const browser = await chromium.launch({ headless: true });

async function shoot(name, width, height, fullPage = true, selector = null) {
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  await page.goto(`${base}/`, { waitUntil: 'networkidle' });
  // force reveals visible for screenshots
  await page.addStyleTag({ content: '.reveal{opacity:1!important;transform:none!important}' });
  await page.waitForTimeout(400);
  const path = join(out, name);
  if (selector) {
    const loc = page.locator(selector).first();
    await loc.scrollIntoViewIfNeeded();
    await page.waitForTimeout(200);
    await loc.screenshot({ path });
  } else {
    await page.screenshot({ path, fullPage });
  }
  await context.close();
  console.log('saved', path);
}

await shoot('01-desktop-full-1440.png', 1440, 900, true);
await shoot('02-mobile-full-390.png', 390, 844, true);
await shoot('03-hero-desktop.png', 1440, 900, false, '.hero');
await shoot('04-servicos-desktop.png', 1440, 900, false, '#servicos');
await shoot('05-contato-desktop.png', 1440, 900, false, '#contato');
await shoot('06-sobre-desktop.png', 1440, 900, false, '#sobre');

await browser.close();
server.close();
console.log('done');
