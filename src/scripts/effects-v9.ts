import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

type Clean = Array<() => void>;

const reduce = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const fine = () => window.matchMedia('(pointer: fine)').matches;
const mobile = () => window.matchMedia('(max-width: 900px)').matches;

const MORPH_KEY = 'tuany-photo-morph';

/** Face anchor inside portrait frames (object-position ~16–18% from top). */
const FACE_AT = '50% 26%';

function consumeMorphArrival(role: string): boolean {
  try {
    const v = sessionStorage.getItem(MORPH_KEY);
    if (v && v === role) {
      sessionStorage.removeItem(MORPH_KEY);
      return true;
    }
  } catch {
    /* ignore */
  }
  return false;
}

function markMorphDeparture(role: 'sobre' | 'contato') {
  try {
    sessionStorage.setItem(MORPH_KEY, role);
  } catch {
    /* ignore */
  }
}

/** Fill each blind strip with the portrait image as a background slice. */
function ensureBlindImages(stage: HTMLElement) {
  const img =
    stage.querySelector<HTMLImageElement>('.photo-stage__base img') ||
    stage.querySelector<HTMLImageElement>('img');
  if (!img) return;
  const apply = () => {
    const src = img.currentSrc || img.src;
    if (!src) return;
    const pos = img.style.objectPosition || '50% 18%';
    stage.querySelectorAll<HTMLElement>('[data-blind-img]').forEach((el) => {
      el.style.backgroundImage = `url("${src}")`;
      el.style.backgroundPosition = pos;
      el.style.backgroundSize = 'cover';
    });
  };
  if (img.complete && (img.currentSrc || img.src)) apply();
  else img.addEventListener('load', apply, { once: true });
  // srcset may swap currentSrc shortly after decode
  window.setTimeout(apply, 120);
  window.setTimeout(apply, 400);
}

/**
 * Image-native blinds: each strip scaleX 0→1 from its center,
 * revealing the photo beneath — never opaque cream/graphite blocks.
 */
function openBlinds(
  stage: HTMLElement,
  opts: { delay?: number; stagger?: number; duration?: number; from?: 'center' | 'start' | 'end' | 'random' } = {}
) {
  ensureBlindImages(stage);
  const reveals = stage.querySelectorAll<HTMLElement>('[data-blind-reveal]');
  if (!reveals.length) {
    stage.classList.add('is-open', 'is-color');
    return null;
  }
  gsap.set(reveals, { scaleX: 0, transformOrigin: '50% 50%' });
  const tw = gsap.to(reveals, {
    scaleX: 1,
    duration: opts.duration ?? (mobile() ? 0.55 : 0.8),
    stagger: {
      each: opts.stagger ?? (mobile() ? 0.032 : 0.045),
      from: opts.from ?? 'center',
    },
    ease: 'power3.inOut',
    delay: opts.delay ?? 0,
    onComplete: () => stage.classList.add('is-open'),
  });
  gsap.to(stage.querySelector('.photo-stage__duotone'), {
    opacity: 0,
    duration: mobile() ? 0.65 : 1.0,
    ease: 'power2.out',
    delay: (opts.delay ?? 0) + 0.2,
    onComplete: () => stage.classList.add('is-color'),
  });
  return tw;
}

function showFully(stage: HTMLElement | null | undefined) {
  if (!stage) return;
  stage.classList.add('is-open', 'is-color');
  const duo = stage.querySelector<HTMLElement>('.photo-stage__duotone');
  if (duo) gsap.set(duo, { opacity: 0 });
  const reveals = stage.querySelectorAll<HTMLElement>('[data-blind-reveal]');
  if (reveals.length) gsap.set(reveals, { scaleX: 1 });
}

/** Vertical image blinds + duotone → natural color (scroll-triggered). */
export function initSlatReveals(cleanups: Clean) {
  document.querySelectorAll<HTMLElement>('[data-photo-stage]').forEach((stage) => {
    const role = stage.dataset.photoStage || '';
    if (reduce()) {
      showFully(stage);
      return;
    }
    // Hero: circle-only narrative. Contato invite owns its own reveal.
    if (role === 'hero') return;
    if (role === 'contato' && stage.closest('[data-cta-mask], [data-contato-photo]')) return;

    // Arrived via shared-element morph — photo already fully visible; skip re-reveal
    if (consumeMorphArrival(role)) {
      showFully(stage);
      stage.classList.add('is-morph-arrived');
      return;
    }

    ensureBlindImages(stage);
    const parent = stage.closest('figure, .contato__photo, .sobre__photo') || stage;
    const tw = gsap.timeline({
      scrollTrigger: {
        trigger: parent,
        start: 'top 82%',
        once: true,
      },
    });
    const reveals = stage.querySelectorAll<HTMLElement>('[data-blind-reveal]');
    gsap.set(reveals, { scaleX: 0, transformOrigin: '50% 50%' });
    tw.to(
      reveals,
      {
        scaleX: 1,
        duration: mobile() ? 0.55 : 0.85,
        stagger: { each: mobile() ? 0.03 : 0.042, from: 'center' },
        ease: 'power3.inOut',
      },
      0
    );
    tw.to(
      stage.querySelector('.photo-stage__duotone'),
      {
        opacity: 0,
        duration: 0.95,
        ease: 'power2.out',
      },
      0.18
    );
    tw.add(() => stage.classList.add('is-open', 'is-color'));
    cleanups.push(() => tw.kill());
  });
}

/**
 * Hero: circle ONLY (no slats). Face-first from emblem/face center.
 * Scale 1.15→1, duotone→color. Circle expands until the full photo is
 * visible, then snaps to inset rounded rect (never interpolates circle↔inset).
 */
export function initHeroPhotoNarrative(cleanups: Clean) {
  const photo = document.querySelector<HTMLElement>('[data-hero-photo]');
  const stage = photo?.querySelector<HTMLElement>('[data-photo-stage="hero"]');
  const badge = document.querySelector<HTMLElement>('[data-hero-badge]');
  const inner = photo?.querySelector<HTMLElement>('[data-photo-inner]');
  if (!photo) return;

  if (reduce()) {
    photo.classList.add('is-card');
    showFully(stage);
    photo.style.clipPath = 'none';
    return;
  }

  gsap.set(photo, { clipPath: `circle(0% at ${FACE_AT})` });
  if (inner) gsap.set(inner, { scale: 1.15, transformOrigin: FACE_AT });
  if (stage) {
    const duo = stage.querySelector('.photo-stage__duotone');
    if (duo) gsap.set(duo, { opacity: 1 });
  }

  const tl = gsap.timeline({ delay: 0.05 });
  // Grow circle — face enters first and stays fully visible inside the circle
  tl.to(
    photo,
    {
      clipPath: `circle(78% at ${FACE_AT})`,
      duration: mobile() ? 0.9 : 1.2,
      ease: 'power2.inOut',
    },
    0
  );
  if (inner) {
    tl.to(
      inner,
      {
        scale: 1,
        duration: mobile() ? 1.0 : 1.3,
        ease: 'power2.out',
      },
      0
    );
  }
  if (stage) {
    tl.to(
      stage.querySelector('.photo-stage__duotone'),
      {
        opacity: 0,
        duration: mobile() ? 0.75 : 1.05,
        ease: 'power2.out',
      },
      0.2
    );
  }
  // Expand past the card so mid-frames never show a sliced face, then snap to inset
  tl.to(
    photo,
    {
      clipPath: `circle(140% at ${FACE_AT})`,
      duration: mobile() ? 0.45 : 0.55,
      ease: 'power2.out',
      onComplete: () => {
        gsap.set(photo, { clipPath: 'inset(0% 0% 0% 0% round 1.45rem)' });
        photo.classList.add('is-card');
        showFully(stage);
      },
    },
    mobile() ? 0.75 : 0.95
  );
  cleanups.push(() => tl.kill());

  if (inner) {
    const st = ScrollTrigger.create({
      trigger: '.hero',
      start: 'top top',
      end: 'bottom top',
      scrub: true,
      onUpdate: (self) => {
        const p = self.progress;
        const zoom = 1 + p * (mobile() ? 0.06 : 0.14);
        const y = p * (mobile() ? 10 : 28);
        gsap.set(inner, { scale: zoom, y, transformOrigin: '50% 22%' });
        if (badge && fine() && !mobile()) {
          gsap.set(badge, { rotate: p * 28 });
        }
      },
    });
    cleanups.push(() => {
      st.kill();
      gsap.set(inner, { clearProps: 'transform' });
      if (badge) gsap.set(badge, { clearProps: 'transform' });
    });
  }
}

/**
 * Sobre page: full-body starts large (near full-viewport, pinned)
 * and scrub-contracts into the framed sticky slot while credentials light up.
 */
export function initSobrePinNarrative(cleanups: Clean) {
  const section = document.querySelector<HTMLElement>('[data-sobre-mode="page"]');
  if (!section) return;
  const grid = section.querySelector<HTMLElement>('[data-sobre-grid]');
  const photo = section.querySelector<HTMLElement>('[data-sobre-photo]');
  const stage = photo?.querySelector<HTMLElement>('[data-photo-stage]');
  const copy = section.querySelector<HTMLElement>('.sobre__copy');
  const items = section.querySelectorAll<HTMLElement>('.sobre__creds > div, .sobre__panel li');
  if (!grid || !photo) return;

  section.classList.add('sobre--pin');

  // Morph arrival: show photo fully, skip blinds
  if (consumeMorphArrival('sobre')) {
    showFully(stage);
    stage?.classList.add('is-morph-arrived');
  }

  if (reduce() || mobile()) {
    if (reduce()) return;
    const tw = gsap.fromTo(
      items,
      { opacity: 0.35 },
      {
        opacity: 1,
        stagger: 0.1,
        duration: 0.5,
        scrollTrigger: { trigger: section, start: 'top 70%', once: true },
      }
    );
    cleanups.push(() => tw.kill());
    return;
  }

  gsap.set(photo, {
    width: 'min(72vw, 34rem)',
    maxWidth: '34rem',
    borderRadius: '1.75rem',
  });
  if (copy) gsap.set(copy, { opacity: 0.15, y: 24 });
  gsap.set(items, { opacity: 0.25 });

  const tl = gsap.timeline({
    scrollTrigger: {
      trigger: section,
      start: 'top top+=72',
      end: '+=120%',
      scrub: 0.65,
      pin: true,
      anticipatePin: 1,
    },
  });
  tl.to(
    photo,
    {
      width: '100%',
      maxWidth: '28rem',
      borderRadius: '1.25rem',
      ease: 'none',
      duration: 1,
    },
    0
  );
  if (copy) {
    tl.to(copy, { opacity: 1, y: 0, ease: 'none', duration: 0.55 }, 0.25);
  }
  tl.to(items, { opacity: 1, stagger: 0.08, ease: 'none', duration: 0.5 }, 0.45);
  cleanups.push(() => {
    tl.scrollTrigger?.kill();
    tl.kill();
    gsap.set([photo, copy, items], { clearProps: 'all' });
  });
}

/**
 * Contato: face-first circle reveal (centered on face, not CTA corner).
 * No opaque overlay blocks. Circle expands past the card then clears.
 */
export function initContatoInvite(cleanups: Clean) {
  const section = document.querySelector<HTMLElement>('[data-contato-section]');
  const photo = section?.querySelector<HTMLElement>('[data-contato-photo]');
  const cta = section?.querySelector<HTMLElement>('[data-contato-cta]');
  const stage = photo?.querySelector<HTMLElement>('[data-photo-stage]');
  const inner = photo?.querySelector<HTMLElement>('[data-photo-inner]');
  if (!section || !photo) return;

  if (reduce()) {
    photo.classList.add('is-revealed');
    showFully(stage);
    photo.style.clipPath = 'none';
    return;
  }

  if (consumeMorphArrival('contato')) {
    photo.classList.add('is-revealed');
    showFully(stage);
    stage?.classList.add('is-morph-arrived');
    gsap.set(photo, { clearProps: 'clipPath', opacity: 1 });
    return;
  }

  // Face-centered circle — face is the first thing visible
  gsap.set(photo, {
    clipPath: `circle(0% at ${FACE_AT})`,
    opacity: 1,
  });
  if (stage) {
    // Keep base visible under circle (hero-style); hide blinds for this path
    stage.classList.add('is-open'); // suppress blinds layer
    const duo = stage.querySelector('.photo-stage__duotone');
    if (duo) gsap.set(duo, { opacity: 1 });
  }

  const runInvite = () => {
    if (photo.dataset.inviteRan === '1') return;
    photo.dataset.inviteRan = '1';
    const tl = gsap.timeline();
    tl.to(
      photo,
      {
        clipPath: `circle(72% at ${FACE_AT})`,
        duration: mobile() ? 0.8 : 1.05,
        ease: 'power2.inOut',
      },
      0
    );
    if (stage) {
      tl.to(
        stage.querySelector('.photo-stage__duotone'),
        { opacity: 0, duration: 0.9, ease: 'power2.out' },
        0.2
      );
    }
    tl.to(
      photo,
      {
        clipPath: `circle(145% at 50% 40%)`,
        duration: 0.5,
        ease: 'power2.out',
        onComplete: () => {
          gsap.set(photo, { clearProps: 'clipPath' });
          photo.classList.add('is-revealed');
          showFully(stage);
        },
      },
      0.7
    );
    cleanups.push(() => tl.kill());
  };

  const st = ScrollTrigger.create({
    trigger: section,
    start: 'top 78%',
    once: true,
    onEnter: runInvite,
  });
  cleanups.push(() => st.kill());

  // IntersectionObserver backup — Lenis/native scroll races can miss ST onEnter
  const io = new IntersectionObserver(
    (entries) => {
      if (entries.some((e) => e.isIntersecting && e.intersectionRatio > 0.12)) {
        runInvite();
        io.disconnect();
      }
    },
    { threshold: [0.12, 0.25], rootMargin: '0px 0px -15% 0px' }
  );
  io.observe(section);
  cleanups.push(() => io.disconnect());

  requestAnimationFrame(() => {
    const top = section.getBoundingClientRect().top;
    if (top < window.innerHeight * 0.78) runInvite();
  });

  if (cta && inner && fine() && !mobile()) {
    const enter = () => {
      gsap.to(inner, { scale: 1.08, filter: 'brightness(1.08)', duration: 0.45, ease: 'power2.out' });
      gsap.to(photo, { boxShadow: '0 18px 40px rgba(0,0,0,0.28)', duration: 0.45 });
    };
    const leave = () => {
      gsap.to(inner, { scale: 1.0, filter: 'brightness(1)', duration: 0.55, ease: 'power3.out' });
      gsap.to(photo, { boxShadow: 'none', duration: 0.55 });
    };
    cta.addEventListener('mouseenter', enter);
    cta.addEventListener('mouseleave', leave);
    cleanups.push(() => {
      cta.removeEventListener('mouseenter', enter);
      cta.removeEventListener('mouseleave', leave);
    });
  }
}

/**
 * Shared-element continuity + morph-arrival flag so destination skips re-reveal.
 * Also suppress page-title named transition during photo morph to avoid ghost text.
 */
export function initPhotoBridges(cleanups: Clean) {
  if (reduce()) return;

  const setName = (el: HTMLElement | null, name: string) => {
    if (!el) return;
    el.style.viewTransitionName = name;
  };

  const onPointer = (e: Event) => {
    const a = (e.target as HTMLElement).closest('a') as HTMLAnchorElement | null;
    if (!a) return;
    const href = a.getAttribute('href') || '';
    const bridge = a.dataset.photoBridge;
    const toSobre = href.includes('/sobre') || bridge === 'sobre';
    const toContato = href.includes('/contato') || bridge === 'contato';

    if (toSobre) {
      markMorphDeparture('sobre');
      const src =
        document.querySelector<HTMLElement>('[data-photo-stage="sobre"]') ||
        document.querySelector<HTMLElement>('[data-hero-photo]');
      setName(src, 'photo-sobre');
      // Avoid competing page-title morph → ghost overlapping headings
      document.querySelectorAll<HTMLElement>('.page-title, [data-split]').forEach((el) => {
        el.style.viewTransitionName = 'none';
      });
      window.setTimeout(() => {
        if (src) src.style.viewTransitionName = '';
      }, 1200);
    }
    if (toContato) {
      markMorphDeparture('contato');
      const src = document.querySelector<HTMLElement>('[data-photo-stage="contato"]');
      setName(src, 'photo-contato');
      document.querySelectorAll<HTMLElement>('.page-title, [data-split]').forEach((el) => {
        el.style.viewTransitionName = 'none';
      });
      window.setTimeout(() => {
        if (src) src.style.viewTransitionName = '';
      }, 1200);
    }
  };

  document.addEventListener('pointerdown', onPointer);
  cleanups.push(() => document.removeEventListener('pointerdown', onPointer));
}

export function initV9(cleanups: Clean) {
  initSlatReveals(cleanups);
  initHeroPhotoNarrative(cleanups);
  initSobrePinNarrative(cleanups);
  initContatoInvite(cleanups);
  initPhotoBridges(cleanups);
}
