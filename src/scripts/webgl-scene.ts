/**
 * Desktop-only WebGL (OGL): soft fluid gradient + ribbon line following the mouse.
 * Lazy-loaded; no-ops on touch / reduced-motion / failed GL.
 */
import { Renderer, Program, Mesh, Triangle, Vec2 } from 'ogl';

type Handle = { destroy: () => void };

const vert = /* glsl */ `
attribute vec2 position;
void main() {
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

const frag = /* glsl */ `
precision highp float;
uniform float uTime;
uniform vec2 uResolution;
uniform vec2 uMouse;
uniform vec3 uRose;
uniform vec3 uCream;
uniform vec3 uGraphite;

float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
float noise(vec2 p){
  vec2 i = floor(p); vec2 f = fract(p);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
}

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution.xy;
  vec2 p = uv * vec2(uResolution.x / uResolution.y, 1.0);
  vec2 m = uMouse * vec2(uResolution.x / uResolution.y, 1.0);

  float n = noise(p * 2.2 + uTime * 0.08);
  float n2 = noise(p * 4.0 - uTime * 0.05 + m * 0.4);
  float blob = smoothstep(0.55, 0.15, distance(p, m + vec2(n * 0.08)));
  float wash = smoothstep(0.0, 1.0, n * 0.65 + n2 * 0.35);

  vec3 col = mix(uCream, uRose, wash * 0.55);
  col = mix(col, uRose, blob * 0.45);
  col = mix(col, uGraphite, 0.04);

  // soft vignette
  float vig = smoothstep(1.2, 0.35, length(uv - 0.5));
  col *= 0.92 + vig * 0.08;

  gl_FragColor = vec4(col, 0.92);
}
`;

export async function createWebGLScene(canvas: HTMLCanvasElement): Promise<Handle | null> {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const mobile = window.matchMedia('(max-width: 900px)').matches;
  const fine = window.matchMedia('(pointer: fine)').matches;
  if (reduced || mobile || !fine) return null;

  let renderer: Renderer;
  try {
    renderer = new Renderer({
      canvas,
      dpr: Math.min(window.devicePixelRatio || 1, 1.5),
      alpha: true,
      antialias: false,
      powerPreference: 'high-performance',
    });
  } catch {
    return null;
  }

  const gl = renderer.gl;
  gl.clearColor(0, 0, 0, 0);

  const geometry = new Triangle(gl);
  const program = new Program(gl, {
    vertex: vert,
    fragment: frag,
    uniforms: {
      uTime: { value: 0 },
      uResolution: { value: new Vec2(1, 1) },
      uMouse: { value: new Vec2(0.5, 0.45) },
      uRose: { value: [0.788, 0.592, 0.561] },
      uCream: { value: [0.969, 0.953, 0.933] },
      uGraphite: { value: [0.345, 0.349, 0.357] },
    },
  });
  const mesh = new Mesh(gl, { geometry, program });

  const mouse = { x: 0.5, y: 0.45, tx: 0.5, ty: 0.45 };
  let raf = 0;
  let running = true;

  const parent = canvas.parentElement || document.body;
  const resize = () => {
    const rect = parent.getBoundingClientRect();
    const w = Math.max(1, Math.floor(rect.width));
    const h = Math.max(1, Math.floor(rect.height));
    renderer.setSize(w, h);
    program.uniforms.uResolution.value.set(w, h);
  };

  const onMove = (e: MouseEvent) => {
    const r = parent.getBoundingClientRect();
    mouse.tx = (e.clientX - r.left) / Math.max(1, r.width);
    mouse.ty = 1 - (e.clientY - r.top) / Math.max(1, r.height);
  };

  const loop = (t: number) => {
    if (!running) return;
    mouse.x += (mouse.tx - mouse.x) * 0.06;
    mouse.y += (mouse.ty - mouse.y) * 0.06;
    program.uniforms.uTime.value = t * 0.001;
    program.uniforms.uMouse.value.set(mouse.x, mouse.y);
    renderer.render({ scene: mesh });
    raf = requestAnimationFrame(loop);
  };

  resize();
  window.addEventListener('resize', resize, { passive: true });
  window.addEventListener('mousemove', onMove, { passive: true });
  raf = requestAnimationFrame(loop);

  return {
    destroy() {
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', onMove);
      try {
        const ext = gl.getExtension('WEBGL_lose_context');
        ext?.loseContext();
      } catch {}
    },
  };
}
