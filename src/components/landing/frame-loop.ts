/** A canvas layer of the hero. */
export type Layer = {
  /** Call after the hero or the window changed size. */
  resize: () => void;
  stop: () => void;
};

/**
 * Runs `draw` every frame while the canvas is on screen and the tab is
 * visible, at most every `minGap` milliseconds. Does nothing when
 * `animate` is false.
 */
export function frameLoop(
  canvas: HTMLCanvasElement,
  signal: AbortSignal,
  animate: boolean,
  draw: (now: number) => void,
  minGap = 0,
): { stop: () => void } {
  if (!animate) return { stop: () => {} };
  let visible = true;
  let raf = 0;
  let last = 0;
  let stopped = false;
  const loop = (now: number) => {
    if (now - last >= minGap) {
      draw(now);
      last = now;
    }
    raf =
      visible && !document.hidden && !stopped ? requestAnimationFrame(loop) : 0;
  };
  const resume = () => {
    if (!raf && visible && !document.hidden && !stopped)
      raf = requestAnimationFrame(loop);
  };
  const observer = new IntersectionObserver(([entry]) => {
    visible = entry?.isIntersecting ?? false;
    resume();
  });
  observer.observe(canvas);
  document.addEventListener("visibilitychange", resume, { signal });
  resume();
  return {
    stop: () => {
      stopped = true;
      cancelAnimationFrame(raf);
      observer.disconnect();
    },
  };
}
