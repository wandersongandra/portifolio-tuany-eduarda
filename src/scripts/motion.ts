import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';

import {
  initCustomCursor,
  initMagneticNav,
  initButtonFills,
  initScrollHud,
  initCharFlip,
  initKinetic,
  initHorizon,
  initHeroZoom,
  initNightTheme,
  initRevealFooter,
  initRgbHover,
  initWebGL,
  initSharedMorph,
  forceRevealsInView,
} from './effects-v6';
import { initV8, initEmblemPathV8, initFaqSmooth, setRouteCurtainTheme } from './effects-v8';

gsap.registerPlugin(ScrollTrigger);

const reduceMotion = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const isFinePointer = () => window.matchMedia('(pointer: fine)').matches;
const isMobile = () => window.matchMedia('(max-width: 900px)').matches;

let lenis: Lenis | null = null;
let tickerLenis: ((time: number) => void) | null = null;
let cleanups: Array<() => void> = [];
let booted = false;
let pageReady = false;

function on(el: EventTarget | null, type: string, fn: EventListener, opts?: AddEventListenerOptions) {
  if (!el) return;
  el.addEventListener(type, fn, opts);
  cleanups.push(() => el.removeEventListener(type, fn, opts));
}

function syncHeaderHeight() {
  const header = document.querySelector<HTMLElement>('.site-header');
  if (!header) return;
  const h = Math.ceil(header.getBoundingClientRect().height);
  document.documentElement.style.setProperty('--header-h', `${h}px`);
}


function revealAllStatic() {
  document
    .querySelectorAll(
      '.reveal, [data-hero-line], [data-hero-visual], [data-step], [data-card], .split-line, .clip-reveal, .preloader, .big-type__fill'
    )
    .forEach((el) => {
      const h = el as HTMLElement;
      h.style.opacity = '1';
      h.style.transform = 'none';
      h.style.clipPath = 'none';
      h.classList.add('is-visible');
    });
  document.querySelectorAll('.preloader').forEach((el) => el.remove());
  document.documentElement.classList.add('motion-reduced', 'motion-ready');
  document.body.style.overflow = '';
}

function destroyMotion() {
  cleanups.splice(0).forEach((fn) => {
    try { fn(); } catch {}
  });
  ScrollTrigger.getAll().forEach((st) => st.kill());
  if (tickerLenis) {
    gsap.ticker.remove(tickerLenis);
    tickerLenis = null;
  }
  if (lenis) {
    lenis.destroy();
    lenis = null;
  }
  gsap.globalTimeline.clear();
  document.documentElement.classList.remove('motion-ready', 'has-como-pin', 'has-reveal-footer');
  delete document.documentElement.dataset.theme;
}

function splitHeadlines() {
  document.querySelectorAll<HTMLElement>('h1.page-title, h1.section__title, h2.section__title').forEach((el) => {
    if (!el.hasAttribute('data-split') && !el.hasAttribute('data-flip')) el.setAttribute('data-split', '');
  });
  document.querySelectorAll<HTMLElement>('[data-split]').forEach((el) => {
    if (el.dataset.splitDone) return;
    const text = el.textContent?.trim() || '';
    if (!text) return;
    el.setAttribute('aria-label', text);
    el.innerHTML = '';
    const words = text.split(/\s+/);
    const line = document.createElement('span');
    line.className = 'split-line';
    line.setAttribute('aria-hidden', 'true');
    const inner = document.createElement('span');
    inner.className = 'split-line__inner';
    words.forEach((w, i) => {
      const word = document.createElement('span');
      word.className = 'split-word';
      word.textContent = w + (i < words.length - 1 ? '\u00A0' : '');
      inner.appendChild(word);
    });
    line.appendChild(inner);
    el.appendChild(line);
    el.dataset.splitDone = '1';
  });
}

function initLenis() {
  if (reduceMotion() || isMobile()) return null;
  lenis = new Lenis({
    duration: 1.15,
    easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    smoothWheel: true,
    touchMultiplier: 1.2,
  });
  lenis.on('scroll', ScrollTrigger.update);
  tickerLenis = (time: number) => lenis?.raf(time * 1000);
  gsap.ticker.add(tickerLenis);
  gsap.ticker.lagSmoothing(0);
  return lenis;
}

function initPreloader(): Promise<void> {
  const pre = document.querySelector<HTMLElement>('[data-preloader]');
  if (!pre || reduceMotion()) {
    pre?.remove();
    return Promise.resolve();
  }
  document.body.style.overflow = 'hidden';
  const lines = pre.querySelectorAll('.preloader__line');
  const mark = pre.querySelector('.preloader__mark');
  const bar = pre.querySelector('.preloader__bar');
  const barFill = pre.querySelector('.preloader__bar span');
  const wipe = pre.querySelector('.preloader__wipe');
  const maskEl = pre.querySelector<HTMLElement>('[data-preloader-mask]');
  const ring = pre.querySelector<HTMLElement>('[data-preloader-ring]');
  if (maskEl) gsap.set(maskEl, { clipPath: 'circle(0% at 50% 50%)' });

  return new Promise((resolve) => {
    const tl = gsap.timeline({
      defaults: { ease: 'power3.out' },
      onComplete: () => {
        pre.classList.add('is-done');
        pre.remove();
        document.body.style.overflow = '';
        resolve();
      },
    });
    if (maskEl) {
      tl.to(maskEl, { clipPath: 'circle(72% at 50% 50%)', duration: 1.15, ease: 'power2.inOut' }, 0.05);
    }
    if (ring) {
      tl.fromTo(
        ring,
        { opacity: 0, rotation: -50, scale: 0.9 },
        { opacity: 1, rotate: 0, scale: 1, duration: 1.05, ease: 'power3.out' },
        0.35
      );
    }
    tl.fromTo(lines, { yPercent: 110 }, { yPercent: 0, duration: 0.85, stagger: 0.1 }, 0.85);
    tl.to([mark, bar], { opacity: 1, duration: 0.4 }, 1.15);
    tl.to(barFill, { width: '100%', duration: 0.7, ease: 'power2.inOut' }, 1.15);
    tl.to(pre.querySelector('.preloader__inner'), { y: -20, opacity: 0, duration: 0.4 }, 1.95);
    tl.to(wipe, { scaleY: 1, duration: 0.65, ease: 'power4.inOut' }, 1.95);
    tl.to(pre, { yPercent: -100, duration: 0.7, ease: 'power4.inOut' }, 2.4);
  });
}

function initHeader() {
  const header = document.querySelector<HTMLElement>('.site-header');
  if (header) {
    const onScroll = () => header.classList.toggle('is-scrolled', window.scrollY > 24);
    onScroll();
    on(window, 'scroll', onScroll, { passive: true });
  }

  const overlay = document.querySelector<HTMLElement>('[data-nav-overlay]');
  const toggle = document.querySelector<HTMLElement>('[data-nav-toggle]');
  const syncHeaderH = () => {
    const h = header?.offsetHeight || 68;
    document.documentElement.style.setProperty('--header-h', `${h}px`);
  };
  syncHeaderH();
  on(window, 'resize', syncHeaderH);
  const open = () => {
    if (!overlay || !toggle) return;
    syncHeaderH();
    overlay.hidden = false;
    requestAnimationFrame(() => overlay.classList.add('is-open'));
    toggle.classList.add('is-open');
    toggle.setAttribute('aria-expanded', 'true');
    toggle.setAttribute('aria-label', 'Fechar menu');
    document.body.style.overflow = 'hidden';
  };
  const close = () => {
    if (!overlay || !toggle) return;
    overlay.classList.remove('is-open');
    toggle.classList.remove('is-open');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-label', 'Abrir menu');
    document.body.style.overflow = '';
    window.setTimeout(() => { overlay.hidden = true; }, 280);
  };
  on(toggle, 'click', () => {
    if (overlay?.classList.contains('is-open')) close();
    else open();
  });
  overlay?.querySelectorAll('[data-nav-link]').forEach((a) => on(a, 'click', () => close()));
  on(overlay?.querySelector('.nav-overlay__bg') || null, 'click', () => close());
  on(document, 'keydown', (e) => {
    if ((e as KeyboardEvent).key === 'Escape') close();
  });
}

function initHero(delay = 0) {
  const hero = document.querySelector('.hero');
  if (!hero) return;
  const lines = hero.querySelectorAll<HTMLElement>('[data-hero-line] .hero-line__inner');
  const visual = hero.querySelector<HTMLElement>('[data-hero-visual]');
  const badges = hero.querySelectorAll<HTMLElement>('.hero__badges li');
  const blobs = hero.querySelectorAll<HTMLElement>('.blob');
  const tl = gsap.timeline({ delay });
  if (lines.length) {
    gsap.set(lines, { yPercent: 115, opacity: 0 });
    tl.to(lines, { yPercent: 0, opacity: 1, duration: 1.05, stagger: 0.09, ease: 'power3.out' }, 0);
  }
  if (visual) {
    gsap.set(visual, { opacity: 0, y: 28 });
    tl.to(visual, { opacity: 1, y: 0, duration: 1, ease: 'power3.out' }, 0.2);
  }
  if (badges.length) {
    gsap.set(badges, { opacity: 0, y: 12 });
    tl.to(badges, { opacity: 1, y: 0, stagger: 0.06, duration: 0.5 }, 0.45);
  }
  if (blobs.length && !isMobile()) {
    blobs.forEach((b, i) => {
      gsap.to(b, {
        x: i % 2 ? 30 : -24,
        y: i % 2 ? -18 : 22,
        duration: 7 + i * 1.4,
        yoyo: true,
        repeat: -1,
        ease: 'sine.inOut',
      });
    });
  }
}

function initSectionReveals() {
  const mob = isMobile();
  const start = mob ? 'top 92%' : 'top 88%';
  const dur = mob ? 0.45 : 0.85;
  const y0 = mob ? 12 : 22;
  document.querySelectorAll<HTMLElement>('.reveal').forEach((el) => {
    gsap.fromTo(
      el,
      { opacity: 0, y: y0 },
      {
        opacity: 1,
        y: 0,
        duration: dur,
        ease: 'power3.out',
        scrollTrigger: { trigger: el, start, once: true },
      }
    );
  });
  document.querySelectorAll<HTMLElement>('[data-stagger]').forEach((wrap) => {
    const kids = wrap.querySelectorAll<HTMLElement>('[data-card], [data-step]');
    if (!kids.length) return;
    gsap.fromTo(
      kids,
      { opacity: 0, y: mob ? 14 : 26 },
      {
        opacity: 1,
        y: 0,
        stagger: mob ? 0.05 : 0.1,
        duration: mob ? 0.4 : 0.75,
        ease: 'power3.out',
        scrollTrigger: { trigger: wrap, start: mob ? 'top 92%' : 'top 82%', once: true },
      }
    );
  });
}

function initSplitReveals() {
  document.querySelectorAll('.split-line__inner').forEach((el) => {
    gsap.fromTo(
      el,
      { yPercent: 110 },
      {
        yPercent: 0,
        duration: 0.95,
        ease: 'power3.out',
        scrollTrigger: { trigger: el, start: isMobile() ? 'top 92%' : 'top 90%', once: true },
      }
    );
  });
}

function initClipReveals() {
  document.querySelectorAll<HTMLElement>('.clip-reveal, [data-distort-photo]').forEach((el) => {
    gsap.fromTo(
      el,
      { clipPath: 'inset(12% 12% 12% 12% round 24px)', scale: 1.06, filter: 'blur(6px)' },
      {
        clipPath: 'inset(0% 0% 0% 0% round 0px)',
        scale: 1,
        filter: 'blur(0px)',
        duration: 1.25,
        ease: 'power3.out',
        scrollTrigger: { trigger: el, start: 'top 80%' },
      }
    );
  });
}

function initPathDraw() {
  document.querySelectorAll<SVGPathElement>('.flow-path path').forEach((path) => {
    const len = path.getTotalLength?.() ?? 800;
    gsap.set(path, { strokeDasharray: len, strokeDashoffset: len });
    gsap.to(path, {
      strokeDashoffset: 0,
      ease: 'none',
      scrollTrigger: { trigger: path.closest('svg') || path, start: 'top 85%', end: 'bottom 40%', scrub: true },
    });
  });
}

function initBgShifts() {
  const map: Record<string, string> = {
    cream: '#F7F3EE',
    sage: '#F3E6E3',
    sand: '#EBE5DF',
    deep: '#E8DFD6',
  };
  document.querySelectorAll<HTMLElement>('[data-bg]').forEach((el) => {
    const key = el.dataset.bg || 'cream';
    ScrollTrigger.create({
      trigger: el,
      start: 'top 55%',
      end: 'bottom 45%',
      onEnter: () => gsap.to(document.body, { '--page-bg': map[key] || map.cream, duration: 0.6 }),
      onEnterBack: () => gsap.to(document.body, { '--page-bg': map[key] || map.cream, duration: 0.6 }),
    });
  });
}

function initComoPin() {
  if (isMobile() || reduceMotion()) return;
  const pin = document.querySelector<HTMLElement>('.como-pin');
  const track = document.querySelector<HTMLElement>('.como-pin__track');
  const progress = document.querySelector<HTMLElement>('.como-pin__progress span');
  if (!pin || !track) return;
  document.documentElement.classList.add('has-como-pin');
  const total = () => Math.max(0, track.scrollWidth - window.innerWidth + 48);
  const headerOffset = () => {
    const header = document.querySelector<HTMLElement>('.site-header');
    return header ? Math.ceil(header.getBoundingClientRect().height) : 68;
  };
  ScrollTrigger.create({
    trigger: pin,
    start: () => `top top+=${headerOffset()}`,
    end: () => `+=${total() + window.innerHeight * 0.4}`,
    pin: true,
    scrub: 1,
    anticipatePin: 1,
    onUpdate: (self) => {
      gsap.set(track, { x: -total() * self.progress });
      if (progress) gsap.set(progress, { width: `${self.progress * 100}%` });
    },
  });
}

function initMagneticButtons() {
  if (!isFinePointer() || isMobile()) return;
  document.querySelectorAll<HTMLElement>('.btn--magnetic').forEach((btn) => {
    const move = (e: MouseEvent) => {
      const r = btn.getBoundingClientRect();
      const x = e.clientX - (r.left + r.width / 2);
      const y = e.clientY - (r.top + r.height / 2);
      gsap.to(btn, { x: x * 0.22, y: y * 0.22, duration: 0.35, ease: 'power3.out' });
    };
    const leave = () => gsap.to(btn, { x: 0, y: 0, duration: 0.55, ease: 'power3.out' });
    on(btn, 'mousemove', move as EventListener);
    on(btn, 'mouseleave', leave);
  });
}

function initCardTilt() {
  if (!isFinePointer() || isMobile()) return;
  document.querySelectorAll<HTMLElement>('[data-tilt]').forEach((card) => {
    const glow = card.querySelector<HTMLElement>('.card__glow');
    const move = (e: MouseEvent) => {
      const r = card.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width;
      const py = (e.clientY - r.top) / r.height;
      gsap.to(card, {
        rotateX: (py - 0.5) * -7,
        rotateY: (px - 0.5) * 9,
        y: -2,
        duration: 0.35,
        transformPerspective: 800,
        ease: 'power3.out',
      });
      if (glow) {
        glow.style.opacity = '1';
        glow.style.left = `${px * 100}%`;
        glow.style.top = `${py * 100}%`;
      }
    };
    const leave = () => {
      gsap.to(card, { rotateX: 0, rotateY: 0, y: 0, duration: 0.55, ease: 'power3.out' });
      if (glow) glow.style.opacity = '0';
    };
    on(card, 'mousemove', move as EventListener);
    on(card, 'mouseleave', leave);
  });
}

function initFaq() {
  /* replaced by initFaqSmooth in effects-v8 */
}

function initMarquee() {
  const track = document.querySelector<HTMLElement>('.marquee__track');
  if (!track || reduceMotion()) return;
  const width = track.scrollWidth / 2 || 1;
  gsap.to(track, { x: -width, duration: 30, ease: 'none', repeat: -1 });
}

function initParallaxDecor() {
  if (isMobile()) return;
  document.querySelectorAll<HTMLElement>('[data-parallax]').forEach((el) => {
    const depth = Number(el.dataset.parallax) || 12;
    gsap.to(el, {
      yPercent: depth,
      ease: 'none',
      scrollTrigger: { trigger: el.parentElement || el, start: 'top bottom', end: 'bottom top', scrub: true },
    });
  });
}

function initBigType() {
  const fill = document.querySelector<HTMLElement>('[data-big-fill] .big-type__fill');
  const section = document.querySelector('[data-big-type]');
  if (!fill || !section || reduceMotion() || isMobile()) return;
  gsap.fromTo(
    fill,
    { clipPath: 'inset(0 100% 0 0)' },
    {
      clipPath: 'inset(0 0% 0 0)',
      ease: 'none',
      scrollTrigger: { trigger: section, start: 'top top', end: 'bottom bottom', scrub: true },
    }
  );
}

function initScramble() {
  if (reduceMotion() || !isFinePointer()) return;
  const glyphs = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  document.querySelectorAll<HTMLElement>('[data-scramble]').forEach((el) => {
    const label = el.dataset.label || el.textContent || '';
    let frame = 0;
    let raf = 0;
    const run = () => {
      frame++;
      el.textContent = label
        .split('')
        .map((ch, i) => {
          if (ch === ' ') return ' ';
          if (i < frame / 2) return label[i];
          return glyphs[Math.floor(Math.random() * glyphs.length)];
        })
        .join('');
      if (frame < label.length * 2) raf = requestAnimationFrame(run);
      else el.textContent = label;
    };
    const enter = () => {
      cancelAnimationFrame(raf);
      frame = 0;
      raf = requestAnimationFrame(run);
    };
    const leave = () => {
      cancelAnimationFrame(raf);
      el.textContent = label;
    };
    on(el, 'mouseenter', enter);
    on(el, 'mouseleave', leave);
    cleanups.push(() => cancelAnimationFrame(raf));
  });
}

function initLiquidMesh() {
  const canvas = document.querySelector<HTMLCanvasElement>('[data-liquid-mesh]');
  if (!canvas || reduceMotion() || isMobile()) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const parent = canvas.parentElement || document.body;
  let w = 0, h = 0, raf = 0;
  let mx = 0.5, my = 0.35, tx = 0.5, ty = 0.35;
  const blobs = [
    { x: 0.2, y: 0.25, r: 0.34, c: 'rgba(201,151,143,0.42)' },
    { x: 0.75, y: 0.2, r: 0.4, c: 'rgba(232,223,214,0.55)' },
    { x: 0.55, y: 0.55, r: 0.28, c: 'rgba(201,151,143,0.28)' },
  ];
  const resize = () => {
    const rect = parent.getBoundingClientRect();
    w = Math.max(1, Math.floor(rect.width));
    h = Math.max(1, Math.floor(rect.height));
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  const draw = () => {
    mx += (tx - mx) * 0.06;
    my += (ty - my) * 0.06;
    ctx.clearRect(0, 0, w, h);
    blobs.forEach((b, i) => {
      const cx = (b.x + (mx - 0.5) * (0.18 + i * 0.04)) * w;
      const cy = (b.y + (my - 0.5) * (0.14 + i * 0.03)) * h;
      const grd = ctx.createRadialGradient(cx, cy, 0, cx, cy, b.r * Math.max(w, h));
      grd.addColorStop(0, b.c);
      grd.addColorStop(1, 'rgba(247,243,238,0)');
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.arc(cx, cy, b.r * Math.max(w, h), 0, Math.PI * 2);
      ctx.fill();
    });
    raf = requestAnimationFrame(draw);
  };
  const move = (e: MouseEvent) => {
    const r = parent.getBoundingClientRect();
    tx = (e.clientX - r.left) / Math.max(1, r.width);
    ty = (e.clientY - r.top) / Math.max(1, r.height);
  };
  resize();
  draw();
  on(window, 'resize', resize, { passive: true });
  on(window, 'mousemove', move as EventListener, { passive: true });
  cleanups.push(() => cancelAnimationFrame(raf));
}

function initWaPlaceholder() {
  document.querySelectorAll<HTMLAnchorElement>('[data-wa-cta]').forEach((a) => {
    if (!a.getAttribute('href')?.startsWith('#')) return;
    on(a, 'click', (e) => {
      // stay on contato anchor / page — no invented phone
    });
  });
}

async function runPageMotion(opts: { withPreloader: boolean }) {
  document.documentElement.classList.add('js-motion');
  if (reduceMotion()) {
    revealAllStatic();
    initHeader();
    initFaqSmooth(cleanups);
    initWaPlaceholder();
    return;
  }
  splitHeadlines();
  initLenis();
  initHeader();
  if (opts.withPreloader) await initPreloader();
  else document.querySelector('[data-preloader]')?.remove();
  document.documentElement.classList.add('motion-ready');
  initHero(opts.withPreloader ? 0.05 : 0);
  initLiquidMesh();
  initSplitReveals();
  initClipReveals();
  initSectionReveals();
  initPathDraw();
  initBgShifts();
  initComoPin();
  initMagneticButtons();
  initCardTilt();
  initFaqSmooth(cleanups);
  initMarquee();
  initParallaxDecor();
  initBigType();
  initScramble();
  initCustomCursor(cleanups);
  initMagneticNav(cleanups);
  initButtonFills(cleanups);
  initScrollHud(cleanups);
  initCharFlip(cleanups);
  initKinetic(cleanups);
  initHorizon(cleanups);
  initHeroZoom(cleanups);
  initEmblemPathV8(cleanups);
  initNightTheme(cleanups);
  initRevealFooter(cleanups);
  initRgbHover(cleanups);
  void initWebGL(cleanups);
  initSharedMorph(cleanups);
  initV8(cleanups);
  initWaPlaceholder();
  syncHeaderHeight();
  on(window, 'resize', syncHeaderHeight, { passive: true });
  // Ensure anything already in view is fully visible (esp. mobile).
  forceRevealsInView();
  window.setTimeout(() => forceRevealsInView(), 400);
  window.setTimeout(() => forceRevealsInView(), 1200);
  requestAnimationFrame(() => ScrollTrigger.refresh());
}

function playCurtainCover(): Promise<void> {
  const curtain = document.querySelector<HTMLElement>('[data-page-curtain]');
  if (!curtain || reduceMotion()) return Promise.resolve();
  setRouteCurtainTheme();
  const a = curtain.querySelector('.page-curtain__panel--a');
  const b = curtain.querySelector('.page-curtain__panel--b');
  const mark = curtain.querySelector('.page-curtain__mark');
  const wipe = curtain.querySelector('.page-curtain__wipe');
  curtain.classList.add('is-active');
  return new Promise((resolve) => {
    const tl = gsap.timeline({ onComplete: () => resolve() });
    tl.fromTo(wipe, { scale: 0, opacity: 0.9 }, { scale: 4.2, opacity: 1, duration: 0.55, ease: 'power3.inOut' }, 0);
    tl.fromTo(a, { scaleY: 0, transformOrigin: 'top' }, { scaleY: 1, duration: 0.42, ease: 'power3.inOut' }, 0.12);
    tl.fromTo(b, { scaleY: 0, transformOrigin: 'bottom' }, { scaleY: 1, duration: 0.42, ease: 'power3.inOut' }, 0.18);
    tl.to(mark, { opacity: 1, scale: 1, duration: 0.3 }, 0.28);
  });
}

function playCurtainReveal(): Promise<void> {
  const curtain = document.querySelector<HTMLElement>('[data-page-curtain]');
  if (!curtain || reduceMotion()) return Promise.resolve();
  const a = curtain.querySelector('.page-curtain__panel--a');
  const b = curtain.querySelector('.page-curtain__panel--b');
  const mark = curtain.querySelector('.page-curtain__mark');
  const wipe = curtain.querySelector('.page-curtain__wipe');
  return new Promise((resolve) => {
    const tl = gsap.timeline({
      onComplete: () => {
        curtain.classList.remove('is-active');
        gsap.set([a, b], { scaleY: 0 });
        gsap.set(mark, { opacity: 0, scale: 0.85 });
        gsap.set(wipe, { scale: 0, opacity: 0 });
        resolve();
      },
    });
    tl.to(mark, { opacity: 0, scale: 1.06, duration: 0.25 }, 0);
    tl.to(wipe, { scale: 0, opacity: 0, duration: 0.45, ease: 'power3.inOut' }, 0.05);
    tl.to([b, a], { scaleY: 0, transformOrigin: 'top', duration: 0.42, stagger: 0.05, ease: 'power3.inOut' }, 0.08);
  });
}

export function bootMotion() {
  if (booted) return;
  booted = true;
  let isFirstLoad = true;

  document.addEventListener('astro:before-preparation', (ev) => {
    if (reduceMotion() || isFirstLoad) return;
    const e = ev as unknown as { loader: () => Promise<void> };
    const original = e.loader;
    e.loader = async () => {
      await playCurtainCover();
      await original();
    };
  });

  document.addEventListener('astro:before-swap', () => {
    destroyMotion();
  });

  document.addEventListener('astro:after-swap', () => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior });
  });

  document.addEventListener('astro:page-load', () => {
    void (async () => {
      if (isFirstLoad) {
        isFirstLoad = false;
        pageReady = true;
        await runPageMotion({ withPreloader: !!document.querySelector('[data-preloader]') });
        return;
      }
      await playCurtainReveal();
      await runPageMotion({ withPreloader: false });
    })();
  });

  // Fallback when ClientRouter is unavailable
  window.setTimeout(() => {
    if (!pageReady) {
      isFirstLoad = false;
      pageReady = true;
      void runPageMotion({ withPreloader: !!document.querySelector('[data-preloader]') });
    }
  }, 50);
}

export async function initMotion() {
  bootMotion();
}
