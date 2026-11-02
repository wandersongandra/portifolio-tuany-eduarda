import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

type Clean = () => void;

const reduce = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const mobile = () => window.matchMedia('(max-width: 900px)').matches;
const fine = () => window.matchMedia('(pointer: fine)').matches;

export function initCustomCursor(cleanups: Clean[]) {
  if (reduce() || mobile() || !fine()) return;
  document.documentElement.classList.add('has-cursor');
  const root = document.createElement('div');
  root.className = 'c-cursor';
  root.innerHTML = `<span class="c-cursor__dot"></span><span class="c-cursor__label"></span>`;
  document.body.appendChild(root);
  const label = root.querySelector('.c-cursor__label') as HTMLElement;
  let x = 0, y = 0, tx = 0, ty = 0;
  const move = (e: MouseEvent) => { tx = e.clientX; ty = e.clientY; };
  const tick = () => {
    x += (tx - x) * 0.22;
    y += (ty - y) * 0.22;
    root.style.transform = `translate3d(${x}px, ${y}px, 0)`;
  };
  const ticker = () => tick();
  gsap.ticker.add(ticker);
  window.addEventListener('mousemove', move, { passive: true });

  const setMode = (mode: string, text = '') => {
    root.dataset.mode = mode;
    label.textContent = text;
  };

  document.querySelectorAll<HTMLElement>('[data-cursor]').forEach((el) => {
    const enter = () => setMode('card', el.dataset.cursor || 'Ver');
    const leave = () => setMode('');
    el.addEventListener('mouseenter', enter);
    el.addEventListener('mouseleave', leave);
    cleanups.push(() => {
      el.removeEventListener('mouseenter', enter);
      el.removeEventListener('mouseleave', leave);
    });
  });
  document.querySelectorAll('a, button, .btn, summary').forEach((el) => {
    const enter = () => setMode('link');
    const leave = () => setMode('');
    el.addEventListener('mouseenter', enter);
    el.addEventListener('mouseleave', leave);
    cleanups.push(() => {
      el.removeEventListener('mouseenter', enter);
      el.removeEventListener('mouseleave', leave);
    });
  });

  cleanups.push(() => {
    gsap.ticker.remove(ticker);
    window.removeEventListener('mousemove', move);
    root.remove();
    document.documentElement.classList.remove('has-cursor');
  });
}

export function initMagneticNav(cleanups: Clean[]) {
  if (reduce() || mobile() || !fine()) return;
  document.querySelectorAll<HTMLElement>('.nav__list a, .brand').forEach((el) => {
    const move = (e: MouseEvent) => {
      const r = el.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2);
      const dy = e.clientY - (r.top + r.height / 2);
      gsap.to(el, { x: dx * 0.28, y: dy * 0.28, duration: 0.35, ease: 'power3.out' });
    };
    const leave = () => gsap.to(el, { x: 0, y: 0, duration: 0.55, ease: 'elastic.out(1, 0.45)' });
    el.addEventListener('mousemove', move);
    el.addEventListener('mouseleave', leave);
    cleanups.push(() => {
      el.removeEventListener('mousemove', move);
      el.removeEventListener('mouseleave', leave);
    });
  });
}

export function initButtonFills(cleanups: Clean[]) {
  if (reduce()) return;
  document.querySelectorAll<HTMLElement>('.btn').forEach((btn) => {
    if (btn.dataset.fillBound) return;
    btn.dataset.fillBound = '1';
    const ink = document.createElement('span');
    ink.className = 'btn__ink';
    ink.setAttribute('aria-hidden', 'true');
    btn.prepend(ink);
    const enter = (e: MouseEvent) => {
      const r = btn.getBoundingClientRect();
      const x = e.clientX - r.left;
      const y = e.clientY - r.top;
      ink.style.left = `${x}px`;
      ink.style.top = `${y}px`;
      gsap.fromTo(ink, { scale: 0, opacity: 0.35 }, { scale: 12, opacity: 0.18, duration: 0.55, ease: 'power2.out' });
    };
    const leave = () => gsap.to(ink, { opacity: 0, duration: 0.35 });
    btn.addEventListener('mouseenter', enter);
    btn.addEventListener('mouseleave', leave);
    // ripple
    const down = (e: MouseEvent) => {
      const r = btn.getBoundingClientRect();
      const ripple = document.createElement('span');
      ripple.className = 'btn__ripple';
      ripple.style.left = `${e.clientX - r.left}px`;
      ripple.style.top = `${e.clientY - r.top}px`;
      btn.appendChild(ripple);
      gsap.fromTo(ripple, { scale: 0, opacity: 0.35 }, {
        scale: 18, opacity: 0, duration: 0.7, ease: 'power2.out',
        onComplete: () => ripple.remove(),
      });
    };
    btn.addEventListener('pointerdown', down);
    cleanups.push(() => {
      btn.removeEventListener('mouseenter', enter);
      btn.removeEventListener('mouseleave', leave);
      btn.removeEventListener('pointerdown', down);
      ink.remove();
    });
  });
}

export function initScrollHud(cleanups: Clean[]) {
  const pct = document.querySelector<HTMLElement>('[data-scroll-pct]');
  const sec = document.querySelector<HTMLElement>('[data-scroll-sec]');
  if (!pct || reduce()) return;
  const sections = Array.from(document.querySelectorAll('main section, main .section, [data-big-type], .horizon, .kinetic'));
  const st = ScrollTrigger.create({
    start: 0,
    end: 'max',
    onUpdate: (self) => {
      pct.textContent = String(Math.round(self.progress * 100)).padStart(2, '0');
      let idx = 1;
      sections.forEach((s, i) => {
        const r = s.getBoundingClientRect();
        if (r.top < window.innerHeight * 0.45) idx = i + 1;
      });
      if (sec) sec.textContent = String(idx).padStart(2, '0');
    },
  });
  cleanups.push(() => st.kill());
}

export function initCharFlip(cleanups: Clean[]) {
  if (reduce()) return;
  document.querySelectorAll<HTMLElement>('[data-flip]').forEach((el) => {
    if (el.dataset.flipDone || el.dataset.splitDone) return;
    const text = el.textContent?.trim() || '';
    if (!text) return;
    el.setAttribute('aria-label', text);
    el.innerHTML = '';
    const wrap = document.createElement('span');
    wrap.className = 'flip-wrap';
    wrap.setAttribute('aria-hidden', 'true');
    [...text].forEach((ch) => {
      const cell = document.createElement('span');
      cell.className = 'flip-char';
      if (ch === ' ') cell.classList.add('is-space');
      cell.innerHTML = `<span class="flip-char__inner">${ch === ' ' ? '&nbsp;' : ch}</span>`;
      wrap.appendChild(cell);
    });
    el.appendChild(wrap);
    el.dataset.flipDone = '1';
    const inners = el.querySelectorAll('.flip-char__inner');
    gsap.set(inners, { rotateX: -85, opacity: 0, yPercent: 35, transformOrigin: '50% 100%' });
    const play = () => {
      gsap.to(inners, {
        rotateX: 0,
        opacity: 1,
        yPercent: 0,
        duration: 0.7,
        stagger: 0.018,
        ease: 'power3.out',
        overwrite: 'auto',
      });
    };
    const st = ScrollTrigger.create({
      trigger: el,
      start: 'top 90%',
      once: true,
      onEnter: play,
    });
    // If already in view (or ST missed due to pins), show content.
    requestAnimationFrame(() => {
      const r = el.getBoundingClientRect();
      if (r.top < window.innerHeight * 0.92 && r.bottom > 0) play();
    });
    window.setTimeout(() => {
      const anyHidden = Array.from(inners).some((n) => Number(getComputedStyle(n as Element).opacity) < 0.05);
      if (anyHidden) gsap.set(inners, { rotateX: 0, opacity: 1, yPercent: 0 });
    }, 1800);
    cleanups.push(() => st.kill());
  });
}

export function initKinetic(cleanups: Clean[]) {
  const track = document.querySelector<HTMLElement>('[data-kinetic-track]');
  if (!track || reduce()) return;
  const w = track.scrollWidth / 2 || 1;
  const tw = gsap.to(track, { x: -w, duration: 28, ease: 'none', repeat: -1 });
  cleanups.push(() => tw.kill());
}

export function initHorizon(cleanups: Clean[]) {
  const pin = document.querySelector('.horizon__pin');
  const track = document.querySelector<HTMLElement>('[data-horizon-track]');
  if (!pin || !track || reduce()) return;
  const getScroll = () => Math.max(0, track.scrollWidth - window.innerWidth + 48);
  if (mobile()) {
    // simple drag-free CSS scroll on touch — leave as flex wrap? keep horizontal overflow scroll
    (pin as HTMLElement).style.overflowX = 'auto';
    return;
  }
  const headerOffset = () => {
    const header = document.querySelector<HTMLElement>('.site-header');
    return header ? Math.ceil(header.getBoundingClientRect().height) : 68;
  };
  const st = ScrollTrigger.create({
    trigger: pin,
    start: () => `top top+=${headerOffset()}`,
    end: () => `+=${getScroll() + window.innerHeight * 0.35}`,
    pin: true,
    scrub: 1,
    anticipatePin: 1,
    onUpdate: (self) => {
      const x = -getScroll() * self.progress;
      const skew = gsap.utils.clamp(-10, 10, self.getVelocity() / 280);
      gsap.set(track, { x, skewX: skew });
    },
  });
  cleanups.push(() => st.kill());
}

export function initHeroZoom(cleanups: Clean[]) {
  // v9d: NEVER pin the hero — pin+pinSpacing at scroll 0 left a huge cream gap
  // under the header (pin-spacer / fixed mis-measure). Soft scrub zoom only.
  if (reduce() || mobile()) return;
  const hero = document.querySelector<HTMLElement>('.hero');
  if (!hero) return;
  const inner = hero.querySelector<HTMLElement>('.hero__grid') || hero;
  // Ensure no leftover pin/transform from a prior ClientRouter visit
  gsap.set(hero, { clearProps: 'position,top,left,width,zIndex,margin,padding,transform' });
  gsap.set(inner, { clearProps: 'transform' });
  const st = ScrollTrigger.create({
    trigger: hero,
    start: 'top top',
    end: 'bottom top',
    scrub: true,
    pin: false,
    onUpdate: (self) => {
      const s = 1 + self.progress * 0.06;
      gsap.set(inner, { scale: s, transformOrigin: '50% 40%' });
    },
  });
  cleanups.push(() => {
    st.kill();
    gsap.set(inner, { clearProps: 'transform' });
    gsap.set(hero, { clearProps: 'position,top,left,width,zIndex,margin,padding,transform' });
  });
}

export function initEmblemPath(cleanups: Clean[]) {
  const path = document.querySelector<SVGPathElement>('[data-emblem-stroke]');
  const svg = document.querySelector('[data-emblem-path]');
  if (!path || !svg || reduce() || mobile()) return;
  const len = path.getTotalLength();
  gsap.set(path, { strokeDasharray: len, strokeDashoffset: len });
  const tw = gsap.to(path, {
    strokeDashoffset: 0,
    ease: 'none',
    scrollTrigger: {
      trigger: document.querySelector('main'),
      start: 'top top',
      end: 'bottom bottom',
      scrub: 0.6,
    },
  });
  cleanups.push(() => tw.kill());
}

export function initNightTheme(cleanups: Clean[]) {
  if (reduce()) return;
  document.querySelectorAll<HTMLElement>('[data-theme]').forEach((el) => {
    const theme = el.dataset.theme || 'cream';
    const st = ScrollTrigger.create({
      trigger: el,
      start: 'top 55%',
      end: 'bottom 40%',
      onEnter: () => document.documentElement.dataset.theme = theme,
      onEnterBack: () => document.documentElement.dataset.theme = theme,
      onLeave: () => { if (document.documentElement.dataset.theme === theme) document.documentElement.dataset.theme = 'cream'; },
      onLeaveBack: () => { if (document.documentElement.dataset.theme === theme) document.documentElement.dataset.theme = 'cream'; },
    });
    cleanups.push(() => st.kill());
  });
}

export function initRevealFooter(cleanups: Clean[]) {
  const wrap = document.querySelector<HTMLElement>('[data-reveal-footer]');
  const spacer = document.querySelector<HTMLElement>('[data-footer-spacer]');
  if (!wrap || !spacer) return;

  // Mobile / reduced-motion: static footer, no reveal shell.
  if (reduce() || mobile()) {
    document.documentElement.classList.remove('has-reveal-footer');
    spacer.style.height = '0px';
    document.documentElement.style.removeProperty('--footer-h');
    return;
  }

  document.documentElement.classList.add('has-reveal-footer');
  const sync = () => {
    const h = Math.ceil(wrap.getBoundingClientRect().height);
    spacer.style.height = `${h}px`;
    document.documentElement.style.setProperty('--footer-h', `${h}px`);
  };
  sync();
  // Recalc after fonts/images
  requestAnimationFrame(sync);
  window.setTimeout(sync, 120);
  window.setTimeout(sync, 600);
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(sync) : null;
  ro?.observe(wrap);
  window.addEventListener('resize', sync, { passive: true });
  cleanups.push(() => {
    window.removeEventListener('resize', sync);
    ro?.disconnect();
    document.documentElement.classList.remove('has-reveal-footer');
    document.documentElement.style.removeProperty('--footer-h');
  });
}

export function initRgbHover(cleanups: Clean[]) {
  if (reduce() || !fine()) return;
  document.querySelectorAll<HTMLElement>('[data-rgb-hover]').forEach((el) => {
    const move = (e: MouseEvent) => {
      const r = el.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - 0.5;
      const py = (e.clientY - r.top) / r.height - 0.5;
      el.style.setProperty('--rx', `${px * 12}px`);
      el.style.setProperty('--ry', `${py * 8}px`);
      el.classList.add('is-rgb');
    };
    const leave = () => {
      el.classList.remove('is-rgb');
      el.style.setProperty('--rx', '0px');
      el.style.setProperty('--ry', '0px');
    };
    el.addEventListener('mousemove', move);
    el.addEventListener('mouseleave', leave);
    cleanups.push(() => {
      el.removeEventListener('mousemove', move);
      el.removeEventListener('mouseleave', leave);
    });
  });
}

export async function initWebGL(cleanups: Clean[]) {
  const canvas = document.querySelector<HTMLCanvasElement>('[data-webgl-scene]');
  if (!canvas) return;
  try {
    const mod = await import('./webgl-scene');
    const handle = await mod.createWebGLScene(canvas);
    if (handle) {
      const liquid = document.querySelector<HTMLElement>('[data-liquid-mesh]');
      if (liquid) liquid.style.opacity = '0';
      cleanups.push(() => {
        handle.destroy();
        if (liquid) liquid.style.opacity = '';
      });
    }
  } catch {
    // static fallback: keep LiquidMesh / CSS blobs
  }
}

export function initSharedMorph(cleanups: Clean[]) {
  if (reduce()) return;
  document.querySelectorAll<HTMLElement>('[data-cursor="Ver"], [data-card]').forEach((el) => {
    const down = () => {
      el.style.viewTransitionName = 'shared-hero';
      window.setTimeout(() => {
        el.style.viewTransitionName = '';
      }, 900);
    };
    el.addEventListener('pointerdown', down);
    cleanups.push(() => el.removeEventListener('pointerdown', down));
  });
  document.querySelectorAll<HTMLElement>('.page-hero, .hero__visual, [data-shared-hero]').forEach((el) => {
    el.style.viewTransitionName = 'shared-hero';
  });
}


export function forceRevealsInView() {
  const nodes = document.querySelectorAll<HTMLElement>(
    '.reveal, .split-line__inner, .flip-char__inner, [data-card], [data-step], [data-hero-line] .hero-line__inner, .hero__badges li, .clip-reveal, [data-distort-photo]'
  );
  nodes.forEach((el) => {
    const r = el.getBoundingClientRect();
    if (r.bottom > 0 && r.top < window.innerHeight * 0.98) {
      gsap.set(el, { opacity: 1, y: 0, yPercent: 0, rotateX: 0, clearProps: 'filter' });
      el.classList.add('is-visible');
      el.style.clipPath = 'none';
    }
  });
}
