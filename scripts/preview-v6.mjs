import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync, mkdirSync, renameSync, copyFileSync, unlinkSync } from 'node:fs';
import { join, extname } from 'node:path';
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';

const dist = join(process.cwd(), 'dist');
const out = '/workspace/fisio-tuany-preview/v6';
mkdirSync(out, { recursive: true });

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.xml': 'application/xml',
  '.txt': 'text/plain; charset=utf-8',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
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
  await page.waitForFunction(() => {
    const pre = document.querySelector('[data-preloader]');
    return !pre && document.documentElement.classList.contains('motion-ready');
  }, { timeout: 14000 }).catch(async () => {
    await page.evaluate(() => {
      document.querySelector('[data-preloader]')?.remove();
      document.documentElement.classList.add('motion-ready');
      document.body.style.overflow = '';
    });
  });
  await page.waitForTimeout(1200);
}

async function smoothScroll(page, totalMs = 20000) {
  await page.evaluate(async (ms) => {
    const start = performance.now();
    const max = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
    await new Promise((r) => setTimeout(r, 700));
    return new Promise((resolve) => {
      const tick = (now) => {
        const t = Math.min(1, (now - start - 700) / (ms - 700));
        if (t < 0) { requestAnimationFrame(tick); return; }
        window.scrollTo(0, max * ease(Math.max(0, t)));
        if (t < 1) requestAnimationFrame(tick);
        else setTimeout(resolve, 500);
      };
      requestAnimationFrame(tick);
    });
  }, totalMs);
}

async function mouseWander(page) {
  const pts = [
    [220, 180], [720, 260], [1100, 320], [980, 480],
    [640, 420], [400, 560], [860, 200], [300, 300],
  ];
  for (const [x, y] of pts) {
    await page.mouse.move(x, y, { steps: 18 });
    await page.waitForTimeout(180);
  }
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

async function shot(name, width, height, fullPage = true, selector = null, goto = '/') {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  if (goto === '/') await waitIntro(page);
  else {
    await page.goto(`${base}${goto}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(900);
  }
  const path = join(out, name);
  if (selector) {
    await page.locator(selector).first().scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    await page.locator(selector).first().screenshot({ path });
  } else {
    await page.screenshot({ path, fullPage });
  }
  await context.close();
  console.log('shot', name);
}

{
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  await page.goto(`${base}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-preloader]', { timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(1100);
  await page.screenshot({ path: join(out, '00-preloader-mid.png'), fullPage: false });
  await context.close();
  console.log('shot 00-preloader-mid.png');
}

await shot('01-desktop-full-1440.png', 1440, 900, true);
await shot('02-mobile-full-390.png', 390, 844, true);
await shot('03-hero-after-intro.png', 1440, 900, false, '.hero');
await shot('04-servicos-page.png', 1440, 900, true, null, '/servicos/');
await shot('05-sobre-page.png', 1440, 900, false, 'main', '/sobre/');
await shot('06-contato-page.png', 1440, 900, false, 'main', '/contato/');

// kinetic + night stills
{
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  await waitIntro(page);
  await page.locator('.kinetic').first().scrollIntoViewIfNeeded().catch(() => {});
  await page.waitForTimeout(400);
  await page.screenshot({ path: join(out, '07-kinetic-band.png'), fullPage: false });
  await page.locator('.night-band').first().scrollIntoViewIfNeeded().catch(() => {});
  await page.waitForTimeout(500);
  await page.screenshot({ path: join(out, '08-night-band.png'), fullPage: false });
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(700);
  await page.screenshot({ path: join(out, '09-reveal-footer.png'), fullPage: false });
  await context.close();
  console.log('shot kinetic/night/footer');
}

// desktop video: cursor + webgl + scroll + transitions
{
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    hasTouch: false,
    isMobile: false,
    recordVideo: { dir: out, size: { width: 1440, height: 900 } },
  });
  const page = await context.newPage();
  await page.goto(`${base}/`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(3200);
  await page.waitForFunction(() => !document.querySelector('[data-preloader]'), { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(600);
  await mouseWander(page);
  // hover cards for cursor morph
  const card = page.locator('[data-cursor="Ver"]').first();
  if (await card.count()) {
    const box = await card.boundingBox();
    if (box) {
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 20 });
      await page.waitForTimeout(700);
    }
  }
  await smoothScroll(page, 16000);
  await page.click('a[href="/servicos/"]');
  await page.waitForTimeout(1800);
  await page.click('a[href="/sobre/"]');
  await page.waitForTimeout(1600);
  await page.click('a[href="/contato/"]');
  await page.waitForTimeout(1600);
  await page.click('a[href="/"]');
  await page.waitForTimeout(1400);
  const video = page.video();
  await context.close();
  const vpath = await video.path();
  const webm = join(out, '10-desktop-scroll-1440.webm');
  const mp4 = join(out, '10-desktop-scroll-1440.mp4');
  renameSafe(vpath, webm);
  await convertToMp4(webm, mp4);
  try { unlinkSync(webm); } catch {}
  console.log('desktop video');
}

{
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1,
    hasTouch: true,
    isMobile: true,
    recordVideo: { dir: out, size: { width: 390, height: 844 } },
  });
  const page = await context.newPage();
  await page.goto(`${base}/`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);
  await page.waitForFunction(() => !document.querySelector('[data-preloader]'), { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(500);
  await smoothScroll(page, 12000);
  const toggle = page.locator('[data-nav-toggle]');
  if (await toggle.count()) {
    await toggle.click();
    await page.waitForTimeout(700);
    await page.click('.nav-overlay a[href="/servicos/"]');
    await page.waitForTimeout(1600);
  }
  const video = page.video();
  await context.close();
  const vpath = await video.path();
  const webm = join(out, '11-mobile-scroll-390.webm');
  const mp4 = join(out, '11-mobile-scroll-390.mp4');
  renameSafe(vpath, webm);
  await convertToMp4(webm, mp4);
  try { unlinkSync(webm); } catch {}
  console.log('mobile video');
}

await browser.close();
server.close();
console.log('v6 preview done');
