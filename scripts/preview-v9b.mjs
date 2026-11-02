import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync, mkdirSync, renameSync, copyFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { join, extname } from 'node:path';
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';

const dist = join(process.cwd(), 'dist');
const out = '/workspace/fisio-tuany-preview/v9b';
const frames = join(out, 'frames');
mkdirSync(frames, { recursive: true });

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
  await page.waitForTimeout(700);
}

async function forceReady(page) {
  await page.evaluate(() => {
    document.querySelector('[data-preloader]')?.remove();
    document.body.style.overflow = '';
    document.documentElement.classList.add('motion-ready', 'js-motion');
  });
}

async function settleScroll(page, pct) {
  await page.evaluate((p) => {
    const max = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    window.scrollTo({ top: max * p, left: 0, behavior: 'instant' });
  }, pct);
  await page.evaluate(() => document.documentElement.classList.remove('lenis-scrolling'));
  await page.waitForTimeout(1100);
}

const browser = await chromium.launch({ headless: true });
const report = { issues: [], samples: 0, pass: 0, fail: 0, headerChecks: [] };

const pctsSweep = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1];
const routes = [
  { path: '/', slug: 'home' },
  { path: '/sobre/', slug: 'sobre' },
  { path: '/servicos/', slug: 'servicos' },
  { path: '/contato/', slug: 'contato' },
];

async function runSweep(label, viewport, isMobile) {
  for (const route of routes) {
    const context = await browser.newContext({ viewport, deviceScaleFactor: 1, hasTouch: isMobile, isMobile });
    const page = await context.newPage();
    await page.goto(`${base}${route.path}`, { waitUntil: 'networkidle' });
    if (route.path === '/') await page.waitForTimeout(2400);
    await waitReady(page);

    for (const pct of pctsSweep) {
      await settleScroll(page, pct);
      const check = await page.evaluate(() => {
        const header = document.querySelector('.site-header');
        const hr = header?.getBoundingClientRect();
        const headerTop = hr ? hr.top : null;
        const headerOk = headerTop !== null && Math.abs(headerTop) < 1.5;
        return { headerTop, headerOk };
      });
      report.samples++;
      if (check.headerOk) report.pass++;
      else {
        report.fail++;
        report.issues.push({ route: route.path, pct, label, headerTop: check.headerTop });
      }
      report.headerChecks.push({ label, route: route.slug, pct, ...check });
      const name = `${label}-${route.slug}-${String(Math.round(pct * 100)).padStart(3, '0')}.png`;
      await page.screenshot({ path: join(out, name), fullPage: false });
    }
    await context.close();
  }
}

console.log('sweep desk…');
await runSweep('desk', { width: 1440, height: 900 }, false);
console.log('sweep mob…');
await runSweep('mob', { width: 390, height: 844 }, true);

// ——— Animation frames at 25 / 50 / 75 % ———
const animPcts = [0.25, 0.5, 0.75];

async function shotFrames(device, viewport, isMobile) {
  const ctx = await browser.newContext({ viewport, hasTouch: isMobile, isMobile, deviceScaleFactor: 1 });
  const page = await ctx.newPage();

  // HERO circle reveal frames
  await page.goto(`${base}/`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  await forceReady(page);
  for (const p of animPcts) {
    await page.evaluate((progress) => {
      const photo = document.querySelector('[data-hero-photo]');
      const stage = document.querySelector('[data-photo-stage="hero"]');
      const inner = photo?.querySelector('[data-photo-inner]');
      const face = '50% 26%';
      // progress 0→1 maps circle 0% → 140%, then inset at end
      const r = progress < 0.85 ? progress * (140 / 0.85) : 140;
      if (photo) {
        photo.style.clipPath = `circle(${r}% at ${face})`;
        photo.classList.toggle('is-card', progress >= 0.95);
      }
      if (inner) {
        const s = 1.15 - 0.15 * Math.min(1, progress / 0.85);
        inner.style.transform = `scale(${s})`;
        inner.style.transformOrigin = face;
      }
      if (stage) {
        stage.classList.remove('is-open'); // hero has no blinds anyway
        stage.classList.toggle('is-color', progress > 0.35);
        const duo = stage.querySelector('.photo-stage__duotone');
        if (duo) duo.style.opacity = String(Math.max(0, 1 - progress * 1.2));
      }
      // Hide cursor blob
      document.querySelector('.c-cursor')?.style.setProperty('opacity', '0');
    }, p);
    await page.waitForTimeout(120);
    const name = `${device}-hero-p${Math.round(p * 100)}.png`;
    await page.screenshot({ path: join(frames, name), fullPage: false });
    console.log('frame', name);
  }

  // HOME SOBRE teaser — image blinds mid
  await page.evaluate(() => {
    const el = document.querySelector('#sobre');
    if (el) window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 60);
  });
  await page.waitForTimeout(400);
  // Ensure blind backgrounds filled
  await page.evaluate(() => {
    const stage = document.querySelector('#sobre [data-photo-stage="sobre"]');
    if (!stage) return;
    const img = stage.querySelector('img');
    const src = img?.currentSrc || img?.src;
    const pos = img?.style.objectPosition || '50% 12%';
    stage.querySelectorAll('[data-blind-img]').forEach((el) => {
      if (src) {
        el.style.backgroundImage = `url("${src}")`;
        el.style.backgroundPosition = pos;
        el.style.backgroundSize = 'cover';
      }
    });
  });
  for (const p of animPcts) {
    await page.evaluate((progress) => {
      const stage = document.querySelector('#sobre [data-photo-stage="sobre"]');
      if (!stage) return;
      stage.classList.remove('is-open', 'is-color', 'is-morph-arrived');
      const duo = stage.querySelector('.photo-stage__duotone');
      if (duo) duo.style.opacity = String(Math.max(0, 0.9 - progress));
      const reveals = [...stage.querySelectorAll('[data-blind-reveal]')];
      const n = reveals.length || 1;
      // center-outward: center strips open first
      const mid = (n - 1) / 2;
      reveals.forEach((el, i) => {
        const dist = Math.abs(i - mid) / Math.max(1, mid);
        // strip local progress: starts when global progress passes dist threshold
        const local = Math.max(0, Math.min(1, (progress - dist * 0.45) / 0.55));
        el.style.transform = `scaleX(${local})`;
        el.style.transformOrigin = '50% 50%';
      });
      document.querySelector('.c-cursor')?.style.setProperty('opacity', '0');
    }, p);
    await page.waitForTimeout(100);
    const name = `${device}-home-sobre-slat-p${Math.round(p * 100)}.png`;
    await page.screenshot({ path: join(frames, name), fullPage: false });
    console.log('frame', name);
  }

  // HOME CONTATO teaser — face circle
  await page.evaluate(() => {
    const el = document.querySelector('#contato');
    if (el) window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 50);
  });
  await page.waitForTimeout(400);
  for (const p of animPcts) {
    await page.evaluate((progress) => {
      const photo = document.querySelector('[data-contato-photo]');
      const stage = photo?.querySelector('[data-photo-stage]');
      const face = '50% 26%';
      const r = progress < 0.85 ? progress * (145 / 0.85) : 145;
      if (photo) {
        photo.style.clipPath = `circle(${r}% at ${face})`;
        photo.style.opacity = '1';
        photo.classList.toggle('is-revealed', progress >= 0.95);
      }
      if (stage) {
        stage.classList.add('is-open'); // no blinds during circle path
        stage.classList.toggle('is-color', progress > 0.35);
        const duo = stage.querySelector('.photo-stage__duotone');
        if (duo) duo.style.opacity = String(Math.max(0, 1 - progress * 1.2));
      }
      document.querySelector('.c-cursor')?.style.setProperty('opacity', '0');
    }, p);
    await page.waitForTimeout(100);
    const name = `${device}-home-contato-p${Math.round(p * 100)}.png`;
    await page.screenshot({ path: join(frames, name), fullPage: false });
    console.log('frame', name);
  }

  // /sobre/ page — blinds if any + pin mid looks (keep pin)
  await page.goto(`${base}/sobre/`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  await waitReady(page);
  for (const p of animPcts) {
    await page.evaluate((progress) => {
      const stage = document.querySelector('[data-photo-stage="sobre"]');
      const photo = document.querySelector('[data-sobre-photo]');
      if (stage) {
        const img = stage.querySelector('img');
        const src = img?.currentSrc || img?.src;
        const pos = img?.style.objectPosition || '50% 12%';
        stage.querySelectorAll('[data-blind-img]').forEach((el) => {
          if (src) {
            el.style.backgroundImage = `url("${src}")`;
            el.style.backgroundPosition = pos;
            el.style.backgroundSize = 'cover';
          }
        });
        stage.classList.remove('is-open', 'is-color');
        const duo = stage.querySelector('.photo-stage__duotone');
        if (duo) duo.style.opacity = String(Math.max(0, 0.85 - progress));
        const reveals = [...stage.querySelectorAll('[data-blind-reveal]')];
        const n = reveals.length || 1;
        const mid = (n - 1) / 2;
        reveals.forEach((el, i) => {
          const dist = Math.abs(i - mid) / Math.max(1, mid);
          const local = Math.max(0, Math.min(1, (progress - dist * 0.45) / 0.55));
          el.style.transform = `scaleX(${local})`;
          el.style.transformOrigin = '50% 50%';
        });
      }
      // pin scrub mid visual
      if (photo && window.matchMedia('(min-width: 901px)').matches) {
        const w = 72 - progress * 20; // 72vw → ~52
        photo.style.width = `min(${w}vw, ${34 - progress * 6}rem)`;
      }
      document.querySelector('.c-cursor')?.style.setProperty('opacity', '0');
      window.scrollTo(0, 40);
    }, p);
    await page.waitForTimeout(100);
    const name = `${device}-sobre-page-p${Math.round(p * 100)}.png`;
    await page.screenshot({ path: join(frames, name), fullPage: false });
    console.log('frame', name);
  }

  // /contato/ page
  await page.goto(`${base}/contato/`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  await waitReady(page);
  for (const p of animPcts) {
    await page.evaluate((progress) => {
      const photo = document.querySelector('[data-contato-photo]');
      const stage = photo?.querySelector('[data-photo-stage]');
      const face = '50% 26%';
      const r = progress < 0.85 ? progress * (145 / 0.85) : 145;
      if (photo) {
        photo.style.clipPath = `circle(${r}% at ${face})`;
        photo.style.opacity = '1';
      }
      if (stage) {
        stage.classList.add('is-open');
        const duo = stage.querySelector('.photo-stage__duotone');
        if (duo) duo.style.opacity = String(Math.max(0, 1 - progress * 1.2));
      }
      document.querySelector('.c-cursor')?.style.setProperty('opacity', '0');
    }, p);
    await page.waitForTimeout(100);
    const name = `${device}-contato-page-p${Math.round(p * 100)}.png`;
    await page.screenshot({ path: join(frames, name), fullPage: false });
    console.log('frame', name);
  }

  // MORPH mid frames: home → sobre
  await page.goto(`${base}/`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1800);
  await waitReady(page);
  await page.evaluate(() => {
    const el = document.querySelector('#sobre');
    if (el) window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 40);
    document.querySelector('.c-cursor')?.style.setProperty('opacity', '0');
    document.documentElement.classList.add('is-page-transition');
  });
  await page.waitForTimeout(500);
  // Open blinds fully on source so morph carries full image
  await page.evaluate(() => {
    const stage = document.querySelector('#sobre [data-photo-stage="sobre"]');
    if (!stage) return;
    stage.classList.add('is-open', 'is-color');
    const duo = stage.querySelector('.photo-stage__duotone');
    if (duo) duo.style.opacity = '0';
  });
  for (const p of animPcts) {
    // Click and capture during transition window
    const clickP = page.click('#sobre a[href="/sobre/"], #sobre [data-photo-stage="sobre"]').catch(() =>
      page.click('a[href="/sobre/"]')
    );
    await page.waitForTimeout(120 + p * 280);
    const name = `${device}-morph-p${Math.round(p * 100)}.png`;
    await page.screenshot({ path: join(frames, name), fullPage: false });
    console.log('frame', name);
    await clickP.catch(() => {});
    await page.waitForTimeout(900);
    // go back for next mid capture
    if (p < 0.75) {
      await page.goto(`${base}/`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(1200);
      await waitReady(page);
      await page.evaluate(() => {
        const el = document.querySelector('#sobre');
        if (el) window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 40);
        document.querySelector('.c-cursor')?.style.setProperty('opacity', '0');
        document.documentElement.classList.add('is-page-transition');
        const stage = document.querySelector('#sobre [data-photo-stage="sobre"]');
        stage?.classList.add('is-open', 'is-color');
      });
      await page.waitForTimeout(400);
    }
  }

  await ctx.close();
}

console.log('frames desk…');
await shotFrames('desk', { width: 1440, height: 900 }, false);
console.log('frames mob…');
await shotFrames('mob', { width: 390, height: 844 }, true);

// Dedicated mid stills (legacy names for review)
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(`${base}/`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  await forceReady(page);
  await page.evaluate(() => {
    const photo = document.querySelector('[data-hero-photo]');
    const stage = document.querySelector('[data-photo-stage="hero"]');
    const inner = photo?.querySelector('[data-photo-inner]');
    if (photo) {
      photo.style.clipPath = 'circle(42% at 50% 26%)';
      photo.classList.remove('is-card');
    }
    if (inner) {
      inner.style.transform = 'scale(1.08)';
      inner.style.transformOrigin = '50% 26%';
    }
    if (stage) {
      stage.classList.toggle('is-color', false);
      const duo = stage.querySelector('.photo-stage__duotone');
      if (duo) duo.style.opacity = '0.55';
    }
    document.querySelector('.c-cursor')?.remove();
  });
  await page.screenshot({ path: join(out, 'mid-hero-mask-reveal.png'), fullPage: false });
  console.log('mid-hero-mask-reveal');

  await page.evaluate(() => {
    const el = document.querySelector('#sobre');
    if (el) window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 60);
  });
  await page.waitForTimeout(350);
  await page.evaluate(() => {
    const stage = document.querySelector('#sobre [data-photo-stage="sobre"]');
    if (!stage) return;
    const img = stage.querySelector('img');
    const src = img?.currentSrc || img?.src;
    const pos = img?.style.objectPosition || '50% 12%';
    stage.querySelectorAll('[data-blind-img]').forEach((el) => {
      if (src) {
        el.style.backgroundImage = `url("${src}")`;
        el.style.backgroundPosition = pos;
        el.style.backgroundSize = 'cover';
      }
    });
    stage.classList.remove('is-open', 'is-color');
    const duo = stage.querySelector('.photo-stage__duotone');
    if (duo) duo.style.opacity = '0.5';
    const reveals = [...stage.querySelectorAll('[data-blind-reveal]')];
    const n = reveals.length;
    const mid = (n - 1) / 2;
    reveals.forEach((el, i) => {
      const dist = Math.abs(i - mid) / Math.max(1, mid);
      const local = dist < 0.35 ? 1 : dist < 0.7 ? 0.45 : 0;
      el.style.transform = `scaleX(${local})`;
      el.style.transformOrigin = '50% 50%';
    });
    document.querySelector('.c-cursor')?.remove();
  });
  await page.screenshot({ path: join(out, 'mid-slat-reveal.png'), fullPage: false });
  console.log('mid-slat-reveal');

  await page.evaluate(() => {
    const el = document.querySelector('#contato');
    if (el) window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 50);
  });
  await page.waitForTimeout(350);
  await page.evaluate(() => {
    const photo = document.querySelector('[data-contato-photo]');
    const stage = photo?.querySelector('[data-photo-stage]');
    if (photo) {
      photo.style.clipPath = 'circle(38% at 50% 26%)';
      photo.style.opacity = '1';
      photo.classList.remove('is-revealed');
    }
    if (stage) {
      stage.classList.add('is-open');
      const duo = stage.querySelector('.photo-stage__duotone');
      if (duo) duo.style.opacity = '0.5';
    }
    document.querySelector('.c-cursor')?.remove();
  });
  await page.screenshot({ path: join(out, 'mid-contato-reveal.png'), fullPage: false });
  console.log('mid-contato-reveal');
  await ctx.close();
}

// Header check deep in night section
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(`${base}/`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  await waitReady(page);
  const night = await page.evaluate(() => {
    const band = document.querySelector('.night-band, [data-theme-section], #faq, .faq');
    if (band) {
      const y = band.getBoundingClientRect().top + window.scrollY;
      window.scrollTo(0, y + 40);
    } else {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      window.scrollTo(0, max * 0.72);
    }
    return new Promise((r) => setTimeout(() => {
      const hr = document.querySelector('.site-header')?.getBoundingClientRect();
      r({ top: hr?.top ?? null, y: window.scrollY });
    }, 800));
  });
  report.headerChecks.push({ label: 'night-section', ...night });
  await page.screenshot({ path: join(out, 'check-header-night.png'), fullPage: false });
  console.log('header night', night);
  await ctx.close();
}

// Sobre pin start/end keep
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(`${base}/sobre/`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await waitReady(page);
  await page.evaluate(() => {
    const photo = document.querySelector('[data-sobre-photo]');
    const copy = document.querySelector('.sobre__copy');
    if (photo) { photo.style.width = 'min(72vw, 34rem)'; photo.style.maxWidth = '34rem'; }
    if (copy) copy.style.opacity = '0.2';
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(250);
  await page.screenshot({ path: join(out, 'mid-sobre-pin-start.png'), fullPage: false });
  await page.evaluate(() => {
    const photo = document.querySelector('[data-sobre-photo]');
    const copy = document.querySelector('.sobre__copy');
    if (photo) { photo.style.width = '100%'; photo.style.maxWidth = '28rem'; }
    if (copy) copy.style.opacity = '1';
    const max = document.documentElement.scrollHeight - window.innerHeight;
    window.scrollTo(0, max * 0.35);
  });
  await page.waitForTimeout(400);
  await page.screenshot({ path: join(out, 'mid-sobre-pin-end.png'), fullPage: false });
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
  await page.waitForTimeout(2600);
  await waitReady(page);
  for (const p of [0, 0.2, 0.4, 0.6, 0.8, 1]) await settleScroll(page, p);
  await page.evaluate(() => {
    const el = document.querySelector('#sobre');
    if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 40, behavior: 'instant' });
  });
  await page.waitForTimeout(800);
  const sobrePhoto = page.locator('#sobre [data-photo-stage="sobre"]');
  if (await sobrePhoto.count()) await sobrePhoto.click();
  else await page.click('a[href="/sobre/"]');
  await page.waitForTimeout(1600);
  await page.click('a[href="/servicos/"]');
  await page.waitForTimeout(1200);
  await page.click('a[href="/contato/"]');
  await page.waitForTimeout(1300);
  await page.click('a[href="/"]');
  await page.waitForTimeout(1100);
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
  await page.waitForTimeout(2600);
  await waitReady(page);
  for (const p of [0, 0.25, 0.5, 0.75, 1]) await settleScroll(page, p);
  await page.click('[data-nav-toggle]');
  await page.waitForTimeout(800);
  await page.locator('[data-nav-overlay] a[href="/contato/"]').click();
  await page.waitForTimeout(1300);
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
console.log('done', { samples: report.samples, pass: report.pass, fail: report.fail, issues: report.issues.length });
