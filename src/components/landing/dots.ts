import { frameLoop, type Layer } from "./frame-loop";

type Cell = {
  x: number;
  y: number;
  density: number;
  phase: number;
  speed: number;
  blue: boolean;
};

/**
 * The halftone field at the bottom of the hero: squares in team colors,
 * blue toward the bottom left and ember toward the top right, thinning out
 * as they rise. They twinkle, and swell around the pointer.
 */
export function startDots(
  canvas: HTMLCanvasElement,
  hero: HTMLElement,
  { animate, signal }: { animate: boolean; signal: AbortSignal },
): Layer | null {
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  let w = 0;
  let h = 0;
  let dpr = 1;
  let cells: Cell[] = [];
  const pointer = { x: -9999, y: -9999 };

  const build = () => {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = canvas.clientWidth;
    h = canvas.clientHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    const gap = w < 600 ? 17 : 14;
    cells = [];
    for (let y = gap / 2; y < h; y += gap) {
      for (let x = gap / 2; x < w; x += gap) {
        const rise = y / h;
        // Thins out again just above the hero's bottom edge, so no row of dots marks where it ends.
        const tail = 1 - Math.pow(Math.max(0, (rise - 0.72) / 0.28), 1.4);
        const density =
          Math.pow(rise, 1.6) *
          tail *
          (0.55 +
            0.45 *
              Math.sin(x * 0.013 + y * 0.021) *
              Math.sin(x * 0.007 - y * 0.017));
        if (density < 0.05) continue;
        cells.push({
          x,
          y,
          density,
          phase: Math.random() * 6.28,
          speed: 0.6 + Math.random() * 1.4,
          blue: x / w + (1 - rise) * 0.5 < 0.85,
        });
      }
    }
  };

  const draw = (now: number) => {
    const t = now / 1000;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    for (const c of cells) {
      const twinkle = animate
        ? 0.55 + 0.45 * Math.sin(t * c.speed + c.phase)
        : 0.8;
      const dx = c.x - pointer.x;
      const dy = c.y - pointer.y;
      const near = Math.max(0, 1 - Math.sqrt(dx * dx + dy * dy) / 150);
      const size = Math.max(
        0.6,
        (1.2 + c.density * 3.2) * twinkle + near * 4.5,
      );
      ctx.globalAlpha = Math.min(1, c.density * 0.85 * twinkle + near * 0.6);
      ctx.fillStyle = c.blue ? "#9db8ff" : "#ffb08a";
      ctx.fillRect(c.x - size / 2, c.y - size / 2, size, size);
    }
  };

  if (animate) {
    hero.addEventListener(
      "pointermove",
      (e) => {
        const r = canvas.getBoundingClientRect();
        pointer.x = e.clientX - r.left;
        pointer.y = e.clientY - r.top;
      },
      { signal },
    );
    hero.addEventListener(
      "pointerleave",
      () => {
        pointer.x = pointer.y = -9999;
      },
      { signal },
    );
  }

  const resize = () => {
    build();
    draw(performance.now());
  };
  resize();
  // About 30 frames a second is plenty for a twinkle.
  const loop = frameLoop(canvas, signal, animate, draw, 33);
  return { resize, stop: loop.stop };
}
