import clsx from "clsx";
import { useEffect, useRef } from "react";

/**
 * Purely decorative: a slowly turning banded sphere rendered with 8×8 ordered
 * (Bayer) dithering in two tones. Low-res canvas scaled up with crisp pixels,
 * ~24 fps, paused when hidden, a single still frame for reduced motion.
 */

const PIXEL = 3; // CSS px per dither cell
const FPS = 24;

// 8×8 Bayer matrix normalized to (0, 1).
const BAYER = (() => {
  const m = [0, 32, 8, 40, 2, 34, 10, 42, 48, 16, 56, 24, 50, 18, 58, 26, 12, 44, 4, 36, 14, 46, 6, 38, 60, 28, 52, 20, 62, 30, 54, 22, 3, 35, 11, 43, 1, 33, 9, 41, 51, 19, 59, 27, 49, 17, 57, 25, 15, 47, 7, 39, 13, 45, 5, 37, 63, 31, 55, 23, 61, 29, 53, 21];
  return Float32Array.from(m, (v) => (v + 0.5) / 64);
})();

const INK: [number, number, number] = [12, 18, 15];

/** Resolves any CSS color (hex, rgb, oklch…) to RGB by painting it. */
function resolveColor(css: string): [number, number, number] {
  const c = document.createElement("canvas");
  c.width = c.height = 1;
  const ctx = c.getContext("2d");
  if (!ctx) return [29, 107, 69];
  ctx.fillStyle = css;
  ctx.fillRect(0, 0, 1, 1);
  const [r = 0, g = 0, b = 0] = ctx.getImageData(0, 0, 1, 1).data;
  return [r, g, b];
}

function dotColor(): [number, number, number] {
  const brand = getComputedStyle(document.documentElement).getPropertyValue("--brand").trim() || "#1d6b45";
  const [r, g, b] = resolveColor(brand);
  // Lift toward white so the dots read on the dark ink.
  const mix = (c: number) => Math.round(c + (255 - c) * 0.42);
  return [mix(r), mix(g), mix(b)];
}

function render(img: ImageData, t: number, dot: [number, number, number]) {
  const { width: w, height: h, data } = img;
  const s = Math.min(w, h);
  const cx = w * 0.56;
  const cy = h * 0.5;
  const R = s * 0.42;
  const rot = t * 0.12;
  const cosR = Math.cos(rot);
  const sinR = Math.sin(rot);
  // Light drifts slowly around the upper left.
  const la = -2.3 + Math.sin(t * 0.17) * 0.5;
  const lx = Math.cos(la) * 0.75;
  const ly = Math.sin(la) * 0.75;
  const lz = 0.55;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = (x - cx) / R;
      const dy = (y - cy) / R;
      const d2 = dx * dx + dy * dy;
      let v: number;
      if (d2 < 1) {
        const nz = Math.sqrt(1 - d2);
        // Rotate the surface around a slightly tilted axis for the bands.
        const rx = dx * cosR + nz * sinR;
        const rz = -dx * sinR + nz * cosR;
        const lat = Math.asin(dy * 0.94 + rx * 0.34);
        const lon = Math.atan2(rx, rz);
        const bands = 0.5 + 0.5 * Math.sin(lat * 11 + Math.sin(lon * 3 + t * 0.25) * 1.4);
        const lambert = Math.max(0, dx * lx + dy * ly + nz * lz);
        const rim = Math.pow(1 - nz, 3) * 0.35;
        v = lambert * (0.42 + 0.58 * bands) + rim;
      } else {
        const d = Math.sqrt(d2);
        const halo = Math.exp(-(d - 1) * 5) * 0.32;
        const nx = x / s;
        const ny = y / s;
        const waves = 0.07 * (Math.sin(nx * 9 + ny * 3 + t * 0.35) + Math.sin(ny * 11 - nx * 2 - t * 0.27));
        v = halo + Math.max(0, waves);
      }
      const on = v > (BAYER[(y & 7) * 8 + (x & 7)] ?? 0.5);
      const i = (y * w + x) * 4;
      const c = on ? dot : INK;
      data[i] = c[0];
      data[i + 1] = c[1];
      data[i + 2] = c[2];
      data[i + 3] = 255;
    }
  }
}

export function DitherField({ className }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let dot = dotColor();
    let img: ImageData | null = null;
    let raf = 0;
    let last = 0;
    let visible = true;
    const start = performance.now();

    const resize = () => {
      const w = Math.max(1, Math.ceil(canvas.clientWidth / PIXEL));
      const h = Math.max(1, Math.ceil(canvas.clientHeight / PIXEL));
      if (canvas.width === w && canvas.height === h && img) return;
      canvas.width = w;
      canvas.height = h;
      img = ctx.createImageData(w, h);
      draw(performance.now());
    };

    const draw = (now: number) => {
      if (!img) return;
      render(img, reduced ? 4 : (now - start) / 1000, dot);
      ctx.putImageData(img, 0, 0);
    };

    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      if (!visible || now - last < 1000 / FPS) return;
      last = now;
      draw(now);
    };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    const io = new IntersectionObserver(([e]) => (visible = !!e?.isIntersecting));
    io.observe(canvas);
    // Palette or theme switch: re-tint.
    const mo = new MutationObserver(() => {
      dot = dotColor();
      draw(performance.now());
    });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "data-palette"] });
    if (!reduced) raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      mo.disconnect();
    };
  }, []);

  return <canvas ref={ref} aria-hidden className={clsx("block size-full [image-rendering:pixelated]", className)} />;
}
