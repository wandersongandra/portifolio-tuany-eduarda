import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync, mkdirSync } from 'node:fs';
import { join, extname } from 'node:path';
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { promisify } from 'node:util';

const dist = join(process.cwd(), 'dist');
const out = '/workspace/fisio-tuany-preview/v2';
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

async function smoothScroll(page, totalMs = 18000) {
  await page.evaluate(async (ms) => {
    const start = performance.now();
    const max = document.documentElement.scrollHeight - window.innerHeight;
    const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
    // pause at top for hero entrance
    await new Promise((r) => setTimeout(r, 1600));
    return new Promise((resolve) => {
      const tick = (now) => {
        const t = Math.min(1, (now - start - 1600) / (ms - 1600));
        if (t < 0) {
          requestAnimationFrame(tick);
          return;
        }
        window.scrollTo(0, max * ease(Math.max(0, t)));
        if (t < 1) requestAnimationFrame(tick);
        else {
          setTimeout(resolve, 600);
        }
      };
      requestAnimationFrame(tick);
    });
  }, totalMs);
}

const browser = await chromium.launch({ headless: true });

// --- still screenshots ---
async function shot(name, width, height, fullPage = true, selector = null) {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  await page.goto(`${base}/`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1800); // allow hero entrance
  const path = join(out, name);
  if (selector) {
    const loc = page.locator(selector).first();
    await loc.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    await loc.screenshot({ path });
  } else {
    await page.screenshot({ path, fullPage });
  }
  await context.close();
  console.log('shot', name);
}

await shot('01-desktop-full-1440.png', 1440, 900, true);
await shot('02-mobile-full-390.png', 390, 844, true);
await shot('03-hero-desktop.png', 1440, 900, false, '.hero');
await shot('04-servicos-desktop.png', 1440, 900, false, '#servicos');
await shot('05-contato-desktop.png', 1440, 900, false, '#contato');

// --- desktop video via Playwright record ---
{
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    recordVideo: { dir: out, size: { width: 1440, height: 900 } },
  });
  const page = await context.newPage();
  await page.goto(`${base}/`, { waitUntil: 'networkidle' });
  await smoothScroll(page, 20000);
  const video = page.video();
  await context.close();
  const vpath = await video.path();
  // Playwright writes webm; convert to mp4 if ffmpeg exists
  const dest = join(out, '07-desktop-scroll-1440.mp4');
  const webmDest = join(out, '07-desktop-scroll-1440.webm');
  await renameSafe(vpath, webmDest);
  await convertToMp4(webmDest, dest);
  console.log('video desktop done');
}

// --- mobile video ---
{
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1,
    recordVideo: { dir: out, size: { width: 390, height: 844 } },
  });
  const page = await context.newPage();
  await page.goto(`${base}/`, { waitUntil: 'networkidle' });
  await smoothScroll(page, 18000);
  const video = page.video();
  await context.close();
  const vpath = await video.path();
  const dest = join(out, '08-mobile-scroll-390.mp4');
  const webmDest = join(out, '08-mobile-scroll-390.webm');
  await renameSafe(vpath, webmDest);
  await convertToMp4(webmDest, dest);
  console.log('video mobile done');
}

await browser.close();
server.close();
console.log('preview-v2 complete');

async function renameSafe(from, to) {
  const { renameSync, copyFileSync, unlinkSync } = await import('node:fs');
  try {
    renameSync(from, to);
  } catch {
    copyFileSync(from, to);
    try { unlinkSync(from); } catch {}
  }
}

function convertToMp4(webm, mp4) {
  return new Promise((resolve) => {
    const ff = spawn('ffmpeg', [
      '-y', '-i', webm,
      '-c:v', 'libx264', '-pix_fmt', 'yuv420p',
      '-movflags', '+faststart',
      '-an',
      mp4,
    ], { stdio: ['ignore', 'ignore', 'pipe'] });
    let err = '';
    ff.stderr.on('data', (d) => { err += d.toString(); });
    ff.on('close', (code) => {
      if (code === 0) {
        console.log('converted', mp4);
        resolve(true);
      } else {
        console.warn('ffmpeg failed, keeping webm. code=', code);
        console.warn(err.slice(-400));
        resolve(false);
      }
    });
    ff.on('error', () => {
      console.warn('ffmpeg not available, keeping webm');
      resolve(false);
    });
  });
}
