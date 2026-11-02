import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

type Clean = Array<() => void>;

const reduce = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const fine = () => window.matchMedia('(pointer: fine)').matches;
const mobile = () => window.matchMedia('(max-width: 900px)').matches;

/** Portrait mask reveal + inner parallax (photos). */
export function initPhotoParallax(cleanups: Clean) {
  if (reduce()) return;
  document.querySelectorAll<HTMLElement>('[data-photo-inner]').forEach((inner) => {
    const figure = inner.closest<HTMLElement>('.clip-reveal, [data-distort-photo], figure') || inner.parentElement;
    if (!figure) return;
    const st = ScrollTrigger.create({
      trigger: figure,
      start: 'top bottom',
      end: 'bottom top',
      scrub: true,
      onUpdate: (self) => {
        const y = (self.progress - 0.5) * (mobile() ? 12 : 28);
        const s = 1.06 + self.progress * 0.04;
        gsap.set(inner, { y, scale: s, transformOrigin: '50% 20%' });
      },
    });
    cleanups.push(() => st.kill());
  });
}

/** Magnetic tilt on portraits — desktop fine pointer only. */
export function initPhotoTilt(cleanups: Clean) {
  if (reduce() || !fine() || mobile()) return;
  document.querySelectorAll<HTMLElement>('[data-photo-tilt]').forEach((el) => {
    const move = (e: MouseEvent) => {
      const r = el.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - 0.5;
      const py = (e.clientY - r.top) / r.height - 0.5;
      gsap.to(el, {
        rotateY: px * 7,
        rotateX: -py * 5,
        transformPerspective: 900,
        duration: 0.45,
        ease: 'power2.out',
      });
    };
    const leave = () => {
      gsap.to(el, { rotateY: 0, rotateX: 0, duration: 0.55, ease: 'power3.out' });
    };
    el.addEventListener('mousemove', move);
    el.addEventListener('mouseleave', leave);
    cleanups.push(() => {
      el.removeEventListener('mousemove', move);
      el.removeEventListener('mouseleave', leave);
      gsap.set(el, { clearProps: 'transform' });
    });
  });
}

/** Sobre: sticky photo (CSS) + timeline reveal of formation items. */
export function initSobreSticky(cleanups: Clean) {
  const section = document.querySelector<HTMLElement>('#sobre .sobre');
  if (!section) return;
  section.classList.add('sobre--v8');
  if (reduce()) return;
  const items = section.querySelectorAll<HTMLElement>('.sobre__creds > div, .sobre__panel li');
  if (!items.length) return;
  const tw = gsap.fromTo(
    items,
    { opacity: 0, x: mobile() ? 0 : 18, y: mobile() ? 14 : 0 },
    {
      opacity: 1,
      x: 0,
      y: 0,
      stagger: 0.12,
      duration: 0.7,
      ease: 'power3.out',
      scrollTrigger: { trigger: section, start: 'top 72%', once: true },
    }
  );
  cleanups.push(() => tw.kill());
}

/** Serviços page: sticky cards scale back as next arrives. */
export function initStackScale(cleanups: Clean) {
  if (reduce() || mobile()) return;
  const cards = Array.from(document.querySelectorAll<HTMLElement>('[data-stack-card]'));
  if (cards.length < 2) return;
  cards.forEach((card, i) => {
    const next = cards[i + 1];
    if (!next) return;
    const inner = card.querySelector<HTMLElement>('.stack-card__inner') || card;
    const st = ScrollTrigger.create({
      trigger: next,
      start: 'top 75%',
      end: 'top 30%',
      scrub: true,
      onUpdate: (self) => {
        const p = self.progress;
        gsap.set(inner, {
          scale: 1 - p * 0.06,
          opacity: 1 - p * 0.25,
          filter: `blur(${p * 1.2}px)`,
          transformOrigin: '50% 0%',
        });
      },
    });
    cleanups.push(() => {
      st.kill();
      gsap.set(inner, { clearProps: 'transform,opacity,filter' });
    });
  });
}

/** Smooth height FAQ accordion (details/summary). */
export function initFaqSmooth(cleanups: Clean) {
  document.querySelectorAll<HTMLDetailsElement>('.faq__item').forEach((item) => {
    const summary = item.querySelector('summary');
    const body = item.querySelector<HTMLElement>('.faq__body');
    if (!summary || !body) return;

    const onClick = (e: Event) => {
      e.preventDefault();
      const open = item.open;
      if (reduce()) {
        item.open = !open;
        return;
      }
      if (open) {
        const h = body.scrollHeight;
        gsap.fromTo(body, { height: h, opacity: 1 }, {
          height: 0,
          opacity: 0,
          duration: 0.35,
          ease: 'power2.inOut',
          onComplete: () => {
            item.open = false;
            gsap.set(body, { clearProps: 'height,opacity' });
          },
        });
      } else {
        item.open = true;
        const h = body.scrollHeight;
        gsap.fromTo(body, { height: 0, opacity: 0 }, {
          height: h,
          opacity: 1,
          duration: 0.42,
          ease: 'power2.out',
          onComplete: () => gsap.set(body, { clearProps: 'height,opacity' }),
        });
      }
    };
    summary.addEventListener('click', onClick);
    cleanups.push(() => summary.removeEventListener('click', onClick));
  });
}

/** Gradient-follow highlight on cards. */
export function initGradientFollow(cleanups: Clean) {
  if (reduce() || !fine() || mobile()) return;
  document.querySelectorAll<HTMLElement>('[data-card], [data-gradient-card], .stack-card__inner').forEach((el) => {
    const move = (e: MouseEvent) => {
      const r = el.getBoundingClientRect();
      const x = ((e.clientX - r.left) / r.width) * 100;
      const y = ((e.clientY - r.top) / r.height) * 100;
      el.style.setProperty('--mx', `${x}%`);
      el.style.setProperty('--my', `${y}%`);
      el.classList.add('is-glow');
    };
    const leave = () => el.classList.remove('is-glow');
    el.addEventListener('mousemove', move);
    el.addEventListener('mouseleave', leave);
    cleanups.push(() => {
      el.removeEventListener('mousemove', move);
      el.removeEventListener('mouseleave', leave);
    });
  });
}

/** Animated underline links. */
export function initLinkUnderlines(_cleanups: Clean) {
  document.querySelectorAll('a.link-underline').forEach((a) => a.classList.add('link-underline'));
}

/** Emblem path: only visible while drawing; no leftover vertical line. */
export function initEmblemPathV8(cleanups: Clean) {
  const path = document.querySelector<SVGPathElement>('[data-emblem-stroke]');
  const svg = document.querySelector<SVGElement>('[data-emblem-path]');
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
      scrub: 0.7,
      onUpdate: (self) => {
        svg.classList.toggle('is-drawing', self.progress > 0.02 && self.progress < 0.98);
      },
      onLeave: () => svg.classList.remove('is-drawing'),
      onLeaveBack: () => svg.classList.remove('is-drawing'),
    },
  });
  cleanups.push(() => {
    tw.kill();
    svg.classList.remove('is-drawing');
  });
}

/** Per-route curtain tint via data-route on html. */
export function setRouteCurtainTheme() {
  const path = location.pathname.replace(/\/+$/, '') || '/';
  const map: Record<string, string> = {
    '/': 'home',
    '/sobre': 'sobre',
    '/servicos': 'servicos',
    '/contato': 'contato',
  };
  document.documentElement.dataset.route = map[path] || 'home';
}

/** Smooth anchors via Lenis if present, else native. */
export function initSmoothAnchors(cleanups: Clean) {
  const onClick = (e: Event) => {
    const a = (e.target as HTMLElement).closest('a[href^="#"]') as HTMLAnchorElement | null;
    if (!a) return;
    const id = a.getAttribute('href');
    if (!id || id === '#') return;
    const target = document.querySelector(id);
    if (!target) return;
    e.preventDefault();
    const top = target.getBoundingClientRect().top + window.scrollY - 80;
    window.scrollTo({ top, behavior: reduce() ? 'auto' : 'smooth' });
  };
  document.addEventListener('click', onClick);
  cleanups.push(() => document.removeEventListener('click', onClick));
}

export function initV8(cleanups: Clean) {
  setRouteCurtainTheme();
  initPhotoParallax(cleanups);
  initPhotoTilt(cleanups);
  initSobreSticky(cleanups);
  initStackScale(cleanups);
  initFaqSmooth(cleanups);
  initGradientFollow(cleanups);
  initLinkUnderlines(cleanups);
  initSmoothAnchors(cleanups);
}
