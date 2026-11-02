import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

type Clean = Array<() => void>;

const reduce = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const fine = () => window.matchMedia('(pointer: fine)').matches;
const mobile = () => window.matchMedia('(max-width: 900px)').matches;

function openSlats(stage: HTMLElement, opts: { delay?: number; stagger?: number; duration?: number } = {}) {
  const slats = stage.querySelectorAll<HTMLElement>('.photo-stage__slat');
  if (!slats.length) {
    stage.classList.add('is-open', 'is-color');
    return null;
  }
  gsap.set(slats, { scaleY: 1, transformOrigin: '50% 0%' });
  const tw = gsap.to(slats, {
    scaleY: 0,
    duration: opts.duration ?? (mobile() ? 0.55 : 0.85),
    stagger: {
      each: opts.stagger ?? (mobile() ? 0.035 : 0.05),
      from: 'center',
    },
    ease: 'power3.inOut',
    delay: opts.delay ?? 0,
    onComplete: () => stage.classList.add('is-open'),
  });
  gsap.to(stage.querySelector('.photo-stage__duotone'), {
    opacity: 0,
    duration: mobile() ? 0.7 : 1.1,
    ease: 'power2.out',
    delay: (opts.delay ?? 0) + 0.25,
    onComplete: () => stage.classList.add('is-color'),
  });
  return tw;
}

/** Vertical wood-slat blinds + rose/graphite duotone → natural color. */
export function initSlatReveals(cleanups: Clean) {
  document.querySelectorAll<HTMLElement>('[data-photo-stage]').forEach((stage) => {
    const role = stage.dataset.photoStage;
    if (reduce()) {
      stage.classList.add('is-open', 'is-color');
      return;
    }
    // Hero is driven by circle-mask handoff; still finish with slats lightly
    if (role === 'hero') return;

    const parent = stage.closest('figure, .contato__photo, .sobre__photo') || stage;
    const tw = gsap.timeline({
      scrollTrigger: {
        trigger: parent,
        start: 'top 82%',
        once: true,
      },
    });
    const slats = stage.querySelectorAll<HTMLElement>('.photo-stage__slat');
    gsap.set(slats, { scaleY: 1, transformOrigin: '50% 0%' });
    tw.to(slats, {
      scaleY: 0,
      duration: mobile() ? 0.55 : 0.9,
      stagger: { each: mobile() ? 0.03 : 0.048, from: 'random' },
      ease: 'power3.inOut',
    }, 0);
    tw.to(stage.querySelector('.photo-stage__duotone'), {
      opacity: 0,
      duration: 1,
      ease: 'power2.out',
    }, 0.2);
    tw.add(() => stage.classList.add('is-open', 'is-color'));
    cleanups.push(() => tw.kill());
  });
}

/**
 * Hero: 'a pessoa por trás da marca'
 * Circular mask expands from emblem → portrait, then morphs into the card.
 * Scroll: slow zoom/parallax + badge rotation.
 */
export function initHeroPhotoNarrative(cleanups: Clean) {
  const photo = document.querySelector<HTMLElement>('[data-hero-photo]');
  const stage = photo?.querySelector<HTMLElement>('[data-photo-stage="hero"]');
  const badge = document.querySelector<HTMLElement>('[data-hero-badge]');
  const inner = photo?.querySelector<HTMLElement>('[data-photo-inner]');
  if (!photo) return;

  if (reduce()) {
    photo.classList.add('is-card');
    stage?.classList.add('is-open', 'is-color');
    photo.style.clipPath = 'none';
    return;
  }

  // Start as circle; expand, then ease to rounded rect
  gsap.set(photo, { clipPath: 'circle(8% at 50% 42%)' });
  if (stage) {
    gsap.set(stage.querySelectorAll('.photo-stage__slat'), { scaleY: 1 });
    gsap.set(stage.querySelector('.photo-stage__duotone'), { opacity: 1 });
  }

  const tl = gsap.timeline({ delay: 0.05 });
  tl.to(photo, {
    clipPath: 'circle(72% at 50% 42%)',
    duration: mobile() ? 0.85 : 1.15,
    ease: 'power2.inOut',
  }, 0);
  if (stage) {
    tl.add(() => {
      openSlats(stage, { delay: 0, stagger: 0.04, duration: 0.7 });
    }, 0.35);
  }
  tl.to(photo, {
    clipPath: 'inset(0% 0% 0% 0% round 1.45rem)',
    duration: mobile() ? 0.7 : 0.95,
    ease: 'power3.inOut',
    onComplete: () => photo.classList.add('is-card'),
  }, 0.85);
  cleanups.push(() => tl.kill());

  // Scroll: photo zoom + badge spin (desktop heavier)
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
  const copy = section.querySelector<HTMLElement>('.sobre__copy');
  const items = section.querySelectorAll<HTMLElement>('.sobre__creds > div, .sobre__panel li');
  if (!grid || !photo) return;

  section.classList.add('sobre--pin');

  if (reduce() || mobile()) {
    // Mobile: lighter — just light up credentials in sequence
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

  // Desktop pin scrub
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
  tl.to(photo, {
    width: '100%',
    maxWidth: '28rem',
    borderRadius: '1.25rem',
    ease: 'none',
    duration: 1,
  }, 0);
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
 * Contato: 'o convite' — smiling photo reveals from the CTA button area;
 * hovering the CTA brightens/zooms the portrait.
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
    stage?.classList.add('is-open', 'is-color');
    photo.style.clipPath = 'none';
    return;
  }

  // Reveal grows from CTA-ish origin as a circle, then clears to the card radius
  gsap.set(photo, {
    clipPath: 'circle(0% at 22% 78%)',
    opacity: 0.45,
  });

  const st = ScrollTrigger.create({
    trigger: section,
    start: 'top 75%',
    once: true,
    onEnter: () => {
      const tl = gsap.timeline();
      tl.to(photo, {
        clipPath: 'circle(70% at 40% 55%)',
        opacity: 1,
        duration: mobile() ? 0.75 : 1.0,
        ease: 'power2.inOut',
      }, 0);
      tl.to(photo, {
        clipPath: 'circle(130% at 50% 50%)',
        duration: 0.55,
        ease: 'power2.out',
        onComplete: () => {
          gsap.set(photo, { clearProps: 'clipPath' });
          photo.classList.add('is-revealed');
        },
      }, 0.55);
      if (stage) {
        tl.add(() => openSlats(stage, { delay: 0, duration: 0.65 }), 0.15);
      }
      cleanups.push(() => tl.kill());
    },
  });
  cleanups.push(() => st.kill());

  // CTA hover ↔ photo response (desktop fine pointer)
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
 * Shared-element continuity: nav/bridge links set matching view-transition names
 * so hero/teaser photos travel into destination page photos.
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
      // Prefer home sobre teaser; fall back to hero so nav morph still works
      const src =
        document.querySelector<HTMLElement>('[data-photo-stage="sobre"]') ||
        document.querySelector<HTMLElement>('[data-hero-photo]');
      setName(src, 'photo-sobre');
      window.setTimeout(() => {
        if (src) src.style.viewTransitionName = '';
      }, 1200);
    }
    if (toContato) {
      const src = document.querySelector<HTMLElement>('[data-photo-stage="contato"]');
      setName(src, 'photo-contato');
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
