import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync, mkdirSync, renameSync, copyFileSync, unlinkSync } from 'node:fs';
import { join, extname } from 'node:path';
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';

const dist = join(process.cwd(), 'dist');
const out = '/workspace/fisio-tuany-preview/v4';
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

async function waitIntro(page) {
  await page.goto(`${base}/`, { waitUntil: 'networkidle' });
  // wait until preloader gone OR motion-ready + no preloader
  await page.waitForFunction(() => {
    const pre = document.querySelector('[data-preloader]');
    return !pre && document.documentElement.classList.contains('motion-ready');
  }, { timeout: 12000 }).catch(async () => {
    // failsafe: force hide
    await page.evaluate(() => {
      document.querySelector('[data-preloader]')?.remove();
      document.documentElement.classList.add('motion-ready');
      document.body.style.overflow = '';
    });
  });
  await page.waitForTimeout(1400); // hero entrance after intro
}

async function smoothScroll(page, totalMs = 22000) {
  await page.evaluate(async (ms) => {
    const start = performance.now();
    const max = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
    await new Promise((r) => setTimeout(r, 900));
    return new Promise((resolve) => {
      const tick = (now) => {
        const t = Math.min(1, (now - start - 900) / (ms - 900));
        if (t < 0) { requestAnimationFrame(tick); return; }
        window.scrollTo(0, max * ease(Math.max(0, t)));
        if (t < 1) requestAnimationFrame(tick);
        else setTimeout(resolve, 700);
      };
      requestAnimationFrame(tick);
    });
  }, totalMs);
}

function convertToMp4(webm, mp4) {
  return new Promise((resolve) => {
    const ff = spawn('ffmpeg', ['-y', '-i', webm, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', mp4], { stdio: ['ignore', 'ignore', 'pipe'] });
    ff.on('close', (code) => resolve(code === 0));
    ff.on('error', () => resolve(false));
  });
}

function renameSafe(from, to) {
  try { renameSync(from, to); }
  catch { copyFileSync(from, to); try { unlinkSync(from); } catch {} }
}

const browser = await chromium.launch({ headless: true });

async function shot(name, width, height, fullPage = true, selector = null) {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  await waitIntro(page);
  const path = join(out, name);
  if (selector) {
    await page.locator(selector).first().scrollIntoViewIfNeeded();
    await page.waitForTimeout(700);
    await page.locator(selector).first().screenshot({ path });
  } else {
    await page.screenshot({ path, fullPage });
  }
  await context.close();
  console.log('shot', name);
}

// mid-preloader frame (capture while logo draws)
{
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  await page.goto(`${base}/`, { waitUntil: 'domcontentloaded' });
  // wait until preloader visible, then grab mid-animation
  await page.waitForSelector('[data-preloader]', { timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(900);
  await page.screenshot({ path: join(out, '00-preloader-mid.png'), fullPage: false });
  await context.close();
  console.log('shot 00-preloader-mid.png');
}

await shot('01-desktop-full-1440.png', 1440, 900, true);
await shot('02-mobile-full-390.png', 390, 844, true);
await shot('03-hero-after-intro.png', 1440, 900, false, '.hero');
await shot('04-servicos.png', 1440, 900, false, '#servicos');
await shot('05-como-funciona.png', 1440, 900, false, '#como-funciona');
await shot('06-contato.png', 1440, 900, false, '#contato');

// desktop video — include intro
{
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    recordVideo: { dir: out, size: { width: 1440, height: 900 } },
  });
  const page = await context.newPage();
  await page.goto(`${base}/`, { waitUntil: 'networkidle' });
  // record intro (~3s) then scroll
  await page.waitForTimeout(3200);
  await page.waitForFunction(() => !document.querySelector('[data-preloader]'), { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(800);
  await smoothScroll(page, 22000);
  const video = page.video();
  await context.close();
  const vpath = await video.path();
  const webm = join(out, '07-desktop-scroll-1440.webm');
  const mp4 = join(out, '07-desktop-scroll-1440.mp4');
  renameSafe(vpath, webm);
  await convertToMp4(webm, mp4);
  try { unlinkSync(webm); } catch {}
  console.log('desktop video');
}

// mobile video
{
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1,
    recordVideo: { dir: out, size: { width: 390, height: 844 } },
  });
  const page = await context.newPage();
  await page.goto(`${base}/`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(3200);
  await page.waitForFunction(() => !document.querySelector('[data-preloader]'), { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(600);
  await smoothScroll(page, 20000);
  const video = page.video();
  await context.close();
  const vpath = await video.path();
  const webm = join(out, '08-mobile-scroll-390.webm');
  const mp4 = join(out, '08-mobile-scroll-390.mp4');
  renameSafe(vpath, webm);
  await convertToMp4(webm, mp4);
  try { unlinkSync(webm); } catch {}
  console.log('mobile video');
}

await browser.close();
server.close();
console.log('v4 preview done');
