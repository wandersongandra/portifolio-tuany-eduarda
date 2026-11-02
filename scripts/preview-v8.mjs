import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync, mkdirSync, renameSync, copyFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { join, extname } from 'node:path';
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';

const dist = join(process.cwd(), 'dist');
const out = '/workspace/fisio-tuany-preview/v8';
mkdirSync(out, { recursive: true });

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
  '.avif': 'image/avif',
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

async function waitReady(page) {
  await page.waitForFunction(() => (
    document.documentElement.classList.contains('motion-ready') ||
    document.documentElement.classList.contains('motion-reduced')
  ), { timeout: 16000 }).catch(async () => {
    await page.evaluate(() => {
      document.querySelector('[data-preloader]')?.remove();
      document.documentElement.classList.add('motion-ready');
      document.body.style.overflow = '';
    });
  });
  await page.waitForTimeout(900);
}

async function settleScroll(page, pct) {
  await page.evaluate((p) => {
    const max = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    window.scrollTo({ top: max * p, left: 0, behavior: 'instant' });
  }, pct);
  // stop Lenis inertia if present
  await page.evaluate(() => {
    document.documentElement.classList.remove('lenis-scrolling');
  });
  await page.waitForTimeout(1200); // settle for reveals
}

const browser = await chromium.launch({ headless: true });
const routes = [
  { path: '/', slug: 'home' },
  { path: '/sobre/', slug: 'sobre' },
  { path: '/servicos/', slug: 'servicos' },
  { path: '/contato/', slug: 'contato' },
];
const pcts = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1];

const report = { issues: [], samples: 0, pass: 0, fail: 0 };

async function runSuite(label, viewport, isMobile) {
  for (const route of routes) {
    const context = await browser.newContext({
      viewport,
      deviceScaleFactor: 1,
      hasTouch: isMobile,
      isMobile,
    });
    const page = await context.newPage();
    await page.goto(`${base}${route.path}`, { waitUntil: 'networkidle' });
    if (route.path === '/') await page.waitForTimeout(2600);
    await waitReady(page);

    for (const pct of pcts) {
      await settleScroll(page, pct);
      const check = await page.evaluate(() => {
        const header = document.querySelector('.site-header');
        const hr = header?.getBoundingClientRect();
        const headerTop = hr ? hr.top : null;
        const headerOk = headerTop !== null && Math.abs(headerTop) < 1;

        // text opacity in viewport
        const textNodes = [];
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT);
        let n;
        while ((n = walker.nextNode())) {
          const el = n;
          if (!(el instanceof HTMLElement)) continue;
          if (el.closest('.site-header, .scroll-hud, .c-cursor, .page-curtain, .preloader, [aria-hidden="true"]')) continue;
          const style = getComputedStyle(el);
          if (style.display === 'none' || style.visibility === 'hidden') continue;
          const r = el.getBoundingClientRect();
          if (r.width < 8 || r.height < 8) continue;
          if (r.bottom < 0 || r.top > innerHeight) continue;
          // has direct text
          const hasText = [...el.childNodes].some((c) => c.nodeType === 3 && c.textContent.trim().length > 1);
          if (!hasText) continue;
          const op = parseFloat(style.opacity);
          textNodes.push({ tag: el.tagName, cls: (el.className || '').toString().slice(0, 40), op, top: r.top });
        }
        const lowText = textNodes.filter((t) => t.op < 0.95);

        // large empty solid blocks: sample grid for uniform color regions without text/img
        const emptyBlocks = [];
        const stepY = 40;
        for (let y = 70; y < innerHeight - 40; y += stepY) {
          const el = document.elementFromPoint(Math.floor(innerWidth / 2), y);
          if (!el || !(el instanceof HTMLElement)) continue;
          if (el.closest('.site-header, .scroll-hud, .c-cursor, .page-curtain, canvas, svg, img, a, button, p, h1, h2, h3, li, span')) continue;
          const r = el.getBoundingClientRect();
          if (r.height < 120 || r.width < innerWidth * 0.5) continue;
          const text = (el.innerText || '').replace(/\s+/g, ' ').trim();
          const hasMedia = !!el.querySelector('img, svg, canvas, video');
          // skip known intentional full-bleed with content
          if (text.length > 12 || hasMedia) continue;
          // graphite/cream empty section heuristic
          const bg = getComputedStyle(el).backgroundColor;
          if (bg === 'rgba(0, 0, 0, 0)' || bg === 'transparent') continue;
          emptyBlocks.push({
            cls: (el.className || '').toString().slice(0, 50),
            tag: el.tagName,
            h: Math.round(r.height),
            bg,
            y,
            textLen: text.length,
          });
        }

        return { headerTop, headerOk, lowText: lowText.slice(0, 8), emptyBlocks: emptyBlocks.slice(0, 6) };
      });

      report.samples += 1;
      const tag = `${label}-${route.slug}-${String(Math.round(pct * 100)).padStart(2, '0')}`;
      let failed = false;
      if (!check.headerOk) {
        report.issues.push(`${tag}: headerTop=${check.headerTop}`);
        failed = true;
      }
      if (check.lowText.length) {
        report.issues.push(`${tag}: low-opacity text ${JSON.stringify(check.lowText.slice(0, 3))}`);
        failed = true;
      }
      if (check.emptyBlocks.length) {
        report.issues.push(`${tag}: empty blocks ${JSON.stringify(check.emptyBlocks.slice(0, 2))}`);
        failed = true;
      }
      if (failed) report.fail += 1;
      else report.pass += 1;

      // save key viewport shots every 25% + mobile 25 home
      const pctRound = Math.round(pct * 100);
      if (pctRound % 25 === 0 || (isMobile && route.slug === 'home' && pctRound === 20)) {
        const name = `vp-${label}-${route.slug}-${String(pctRound).padStart(2, '0')}.png`;
        await page.screenshot({ path: join(out, name), fullPage: false });
        console.log('shot', name, failed ? 'FAIL' : 'ok');
      }
    }
    await context.close();
  }
}

await runSuite('desk', { width: 1440, height: 900 }, false);
await runSuite('mob', { width: 390, height: 844 }, true);

// Special stills: mobile menu open + mid page-transition
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  await page.goto(`${base}/`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2200);
  await waitReady(page);
  await page.click('[data-nav-toggle]');
  await page.waitForTimeout(700);
  await page.screenshot({ path: join(out, 'vp-mob-menu-open.png'), fullPage: false });
  console.log('shot vp-mob-menu-open.png');
  await ctx.close();
}
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(`${base}/`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  await waitReady(page);
  // trigger curtain cover without waiting for navigation complete
  await page.evaluate(() => {
    const c = document.querySelector('[data-page-curtain]');
    if (!c) return;
    c.classList.add('is-active');
    document.documentElement.dataset.route = 'servicos';
    const a = c.querySelector('.page-curtain__panel--a');
    const b = c.querySelector('.page-curtain__panel--b');
    const mark = c.querySelector('.page-curtain__mark');
    const wipe = c.querySelector('.page-curtain__wipe');
    if (a) a.style.transform = 'scaleY(1)';
    if (b) b.style.transform = 'scaleY(0.65)';
    if (wipe) { wipe.style.transform = 'scale(2.2)'; wipe.style.opacity = '1'; }
    if (mark) { mark.style.opacity = '1'; mark.style.transform = 'scale(1)'; }
  });
  await page.waitForTimeout(200);
  await page.screenshot({ path: join(out, 'vp-desk-transition-mid.png'), fullPage: false });
  console.log('shot vp-desk-transition-mid.png');
  await ctx.close();
}

// Videos
{
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    recordVideo: { dir: out, size: { width: 1440, height: 900 } },
  });
  const page = await context.newPage();
  await page.goto(`${base}/`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2800);
  await waitReady(page);
  for (const p of [0, 0.2, 0.4, 0.6, 0.8, 1]) {
    await settleScroll(page, p);
  }
  // hover moments on portrait + card
  const photo = page.locator('[data-photo-tilt]').first();
  if (await photo.count()) {
    const box = await photo.boundingBox();
    if (box) {
      await page.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.3);
      await page.waitForTimeout(400);
      await page.mouse.move(box.x + box.width * 0.7, box.y + box.height * 0.5);
      await page.waitForTimeout(400);
    }
  }
  await page.click('a[href="/servicos/"]');
  await page.waitForTimeout(1500);
  await page.click('a[href="/sobre/"]');
  await page.waitForTimeout(1300);
  await page.click('a[href="/"]');
  await page.waitForTimeout(1200);
  const video = page.video();
  await context.close();
  const vpath = await video.path();
  const webm = join(out, 'desk-scroll.webm');
  const mp4 = join(out, 'desk-scroll.mp4');
  renameSafe(vpath, webm);
  await convertToMp4(webm, mp4);
  try { unlinkSync(webm); } catch {}
  console.log('desk video');
}
{
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
    recordVideo: { dir: out, size: { width: 390, height: 844 } },
  });
  const page = await context.newPage();
  await page.goto(`${base}/`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2800);
  await waitReady(page);
  for (const p of [0, 0.25, 0.5, 0.75, 1]) {
    await settleScroll(page, p);
  }
  await page.click('[data-nav-toggle]');
  await page.waitForTimeout(900);
  await page.locator('[data-nav-overlay] a[href="/contato/"]').click();
  await page.waitForTimeout(1400);
  const video = page.video();
  await context.close();
  const vpath = await video.path();
  const webm = join(out, 'mob-scroll.webm');
  const mp4 = join(out, 'mob-scroll.mp4');
  renameSafe(vpath, webm);
  await convertToMp4(webm, mp4);
  try { unlinkSync(webm); } catch {}
  console.log('mob video');
}

await browser.close();
server.close();
writeFileSync(join(out, 'verify-report.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify({ samples: report.samples, pass: report.pass, fail: report.fail, issues: report.issues.slice(0, 30) }, null, 2));
console.log('v8 done');
if (report.fail) process.exitCode = 2;
