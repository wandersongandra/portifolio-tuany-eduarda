import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync, mkdirSync, renameSync, copyFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { join, extname } from 'node:path';
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';

const dist = join(process.cwd(), 'dist');
const out = '/workspace/fisio-tuany-preview/v6b';
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
  await page.waitForFunction(() => {
    const pre = document.querySelector('[data-preloader]');
    return (!pre || pre.classList.contains('is-done')) && (
      document.documentElement.classList.contains('motion-ready') ||
      document.documentElement.classList.contains('motion-reduced')
    );
  }, { timeout: 16000 }).catch(async () => {
    await page.evaluate(() => {
      document.querySelector('[data-preloader]')?.remove();
      document.documentElement.classList.add('motion-ready');
      document.body.style.overflow = '';
    });
  });
  await page.waitForTimeout(700);
}

async function scrollToPct(page, pct) {
  await page.evaluate((p) => {
    const max = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    window.scrollTo(0, max * p);
  }, pct);
  await page.waitForTimeout(450);
}

const browser = await chromium.launch({ headless: true });
const routes = [
  { path: '/', slug: 'home' },
  { path: '/sobre/', slug: 'sobre' },
  { path: '/servicos/', slug: 'servicos' },
  { path: '/contato/', slug: 'contato' },
];
const pcts = [
  { p: 0, tag: '00' },
  { p: 0.25, tag: '25' },
  { p: 0.5, tag: '50' },
  { p: 0.75, tag: '75' },
  { p: 1, tag: '100' },
];

const report = { issues: [], checks: [] };

async function captureSet(label, viewport, isMobile) {
  for (const route of routes) {
    const context = await browser.newContext({
      viewport,
      deviceScaleFactor: 1,
      hasTouch: isMobile,
      isMobile,
    });
    const page = await context.newPage();
    await page.goto(`${base}${route.path}`, { waitUntil: 'networkidle' });
    if (route.path === '/') await page.waitForTimeout(2800);
    await waitReady(page);

    // Diagnostic on home desktop at top
    if (route.slug === 'home' && !isMobile) {
      const diag = await page.evaluate(() => {
        const main = document.querySelector('main#conteudo');
        const footer = document.querySelector('[data-reveal-footer]');
        const spacer = document.querySelector('[data-footer-spacer]');
        const night = document.querySelector('.night-band');
        const badge = document.querySelector('.footer-giant__disc');
        const ms = main ? getComputedStyle(main) : null;
        const fs = footer ? getComputedStyle(footer) : null;
        const nightText = night?.querySelector('h2')?.innerText?.trim() || '';
        const nightOpacity = night?.querySelector('.flip-char__inner')
          ? getComputedStyle(night.querySelector('.flip-char__inner')).opacity
          : null;
        return {
          hasReveal: document.documentElement.classList.contains('has-reveal-footer'),
          mainZ: ms?.zIndex,
          mainBg: ms?.backgroundColor,
          footerPos: fs?.position,
          footerZ: fs?.zIndex,
          spacerH: spacer ? spacer.getBoundingClientRect().height : 0,
          footerH: footer ? footer.getBoundingClientRect().height : 0,
          badgeRadius: badge ? getComputedStyle(badge).borderRadius : null,
          nightText,
          nightOpacity,
        };
      });
      report.checks.push({ at: 'home-top-desktop', ...diag });
      if (diag.footerPos === 'fixed' && (diag.mainZ === 'auto' || Number(diag.mainZ) <= Number(diag.footerZ || 0))) {
        report.issues.push('main z-index not above fixed footer');
      }
      if (diag.footerPos === 'fixed' && diag.spacerH < 100) {
        report.issues.push(`spacer too small: ${diag.spacerH}`);
      }
      if (!diag.nightText) report.issues.push('night band h2 empty');
    }

    for (const { p, tag } of pcts) {
      await scrollToPct(page, p);
      // sample mid-viewport pixels for "footer bleed" on non-end scrolls (desktop home)
      if (route.slug === 'home' && !isMobile && p < 1) {
        const bleed = await page.evaluate(() => {
          const footer = document.querySelector('[data-reveal-footer]');
          if (!footer) return null;
          const fr = footer.getBoundingClientRect();
          // footer should be behind content: its top should be at bottom of viewport when fixed,
          // but content should cover it. Check if any graphite footer text is the topmost at center.
          const x = Math.floor(window.innerWidth / 2);
          const y = Math.floor(window.innerHeight * 0.72);
          const el = document.elementFromPoint(x, y);
          const inFooter = !!(el && el.closest('[data-reveal-footer]'));
          return { inFooter, el: el?.className || el?.tagName, frTop: fr.top, vh: window.innerHeight };
        });
        if (bleed?.inFooter) {
          report.issues.push(`footer bleed at ${tag}% home desktop (hit ${bleed.el})`);
        }
        report.checks.push({ sample: `home-${tag}`, bleed });
      }

      const name = `vp-${label}-${route.slug}-${tag}.png`;
      await page.screenshot({ path: join(out, name), fullPage: false });
      console.log('shot', name);
    }

    // Extra key section shots on home desktop
    if (route.slug === 'home' && !isMobile) {
      for (const [sel, name] of [
        ['.hero', 'vp-desk-hero.png'],
        ['.kinetic', 'vp-desk-kinetic.png'],
        ['.night-band', 'vp-desk-night.png'],
        ['.horizon', 'vp-desk-horizon.png'],
        ['.site-footer', 'vp-desk-footer.png'],
      ]) {
        const loc = page.locator(sel).first();
        if (await loc.count()) {
          await loc.scrollIntoViewIfNeeded();
          await page.waitForTimeout(500);
          // force flip visible if needed
          if (sel === '.night-band') {
            await page.evaluate(() => {
              document.querySelectorAll('.night-band .flip-char__inner').forEach((n) => {
                n.style.opacity = '1';
                n.style.transform = 'none';
              });
            });
            await page.waitForTimeout(200);
          }
          await page.screenshot({ path: join(out, name), fullPage: false });
          console.log('shot', name);
        }
      }
    }

    await context.close();
  }
}

await captureSet('desk', { width: 1440, height: 900 }, false);
await captureSet('mob', { width: 390, height: 844 }, true);

// Videos
{
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    recordVideo: { dir: out, size: { width: 1440, height: 900 } },
  });
  const page = await context.newPage();
  await page.goto(`${base}/`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);
  await waitReady(page);
  for (const p of [0, 0.2, 0.4, 0.6, 0.8, 1]) {
    await scrollToPct(page, p);
    await page.waitForTimeout(350);
  }
  await page.click('a[href="/servicos/"]');
  await page.waitForTimeout(1600);
  await page.click('a[href="/sobre/"]');
  await page.waitForTimeout(1400);
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
    deviceScaleFactor: 1,
    hasTouch: true,
    isMobile: true,
    recordVideo: { dir: out, size: { width: 390, height: 844 } },
  });
  const page = await context.newPage();
  await page.goto(`${base}/`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2800);
  await waitReady(page);
  for (const p of [0, 0.35, 0.7, 1]) {
    await scrollToPct(page, p);
    await page.waitForTimeout(300);
  }
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
console.log('ISSUES', report.issues);
console.log('v6b preview done');
if (report.issues.length) process.exitCode = 2;
