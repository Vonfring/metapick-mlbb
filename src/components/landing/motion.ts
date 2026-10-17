import { startDots } from "./dots";
import type { Layer } from "./frame-loop";
import { startMesh } from "./mesh";

type Gsap = typeof import("gsap").gsap;
type ScrollTriggerApi = typeof import("gsap/ScrollTrigger").ScrollTrigger;

/** Page color while the welcome page is shown (the html and body around it). */
const PAGE_COLOR = "#0a1017";

/**
 * Devices that should not run the animated canvases: data saver on, or 4 GB
 * of memory or less (Chromium reports this; other browsers count as able).
 */
function isLite(): boolean {
  const nav = navigator as Navigator & {
    connection?: { saveData?: boolean };
    deviceMemory?: number;
  };
  return (
    Boolean(nav.connection?.saveData) ||
    (nav.deviceMemory !== undefined && nav.deviceMemory <= 4)
  );
}

/**
 * Starts the welcome page's motion inside `root` and returns a function
 * that undoes all of it: listeners, canvas loops, ScrollTrigger pins and
 * every class or style it set. Next.js keeps the page in the document,
 * hidden, after navigating away, and runs this again on the way back.
 *
 * Full motion by default. Visitors who ask for less motion get a gentle
 * version (fades, count-ups and color changes, no pinned sections, smooth
 * scroll or drifting tiles). Weak devices keep the scroll effects but get
 * still canvases and no film grain.
 */
export function startLanding(root: HTMLElement): () => void {
  const controller = new AbortController();
  const { signal } = controller;
  const undo: (() => void)[] = [];
  const q = <T extends HTMLElement = HTMLElement>(selector: string) =>
    root.querySelector<T>(selector);
  const qa = <T extends HTMLElement = HTMLElement>(selector: string) => [
    ...root.querySelectorAll<T>(selector),
  ];
  const cleanup = () => {
    controller.abort();
    for (const step of undo.reverse()) step();
  };

  const sky = q(".sky");
  const hero = q(".hero");
  const topbar = q(".topbar");
  if (!sky || !hero || !topbar) return cleanup;

  const full = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const finePointer = window.matchMedia(
    "(hover: hover) and (pointer: fine)",
  ).matches;
  const lite = isLite();
  if (lite) {
    root.classList.add("lite");
    undo.push(() => root.classList.remove("lite"));
  }

  // The dark page reaches the edges: overscroll areas and the scrollbar.
  const html = document.documentElement;
  const before = {
    scheme: html.style.colorScheme,
    background: document.body.style.backgroundColor,
  };
  html.style.colorScheme = "dark";
  document.body.style.backgroundColor = PAGE_COLOR;
  undo.push(() => {
    html.style.colorScheme = before.scheme;
    document.body.style.backgroundColor = before.background;
  });

  // Header turns to glass once the page moves.
  const onScroll = () =>
    topbar.classList.toggle("scrolled", window.scrollY > 40);
  window.addEventListener("scroll", onScroll, { passive: true, signal });
  onScroll();
  undo.push(() => topbar.classList.remove("scrolled"));

  // The sky behind hero and tools reaches --sky-ext below the hero, whatever its height.
  const fitSky = () =>
    sky.style.setProperty("--hero-h", `${hero.offsetHeight}px`);
  fitSky();
  undo.push(() => sky.style.removeProperty("--hero-h"));

  const animate = full && !lite;
  const layers: Layer[] = [];
  const meshCanvas = q<HTMLCanvasElement>(".mesh-canvas");
  const dotsCanvas = q<HTMLCanvasElement>(".dots-canvas");
  const mesh =
    meshCanvas && startMesh(meshCanvas, hero, { animate, finePointer, signal });
  if (mesh) layers.push(mesh);
  const dots = dotsCanvas && startDots(dotsCanvas, hero, { animate, signal });
  if (dots) layers.push(dots);
  undo.push(() => layers.forEach((layer) => layer.stop()));
  const resizer = new ResizeObserver(() => {
    fitSky();
    for (const layer of layers) layer.resize();
  });
  resizer.observe(hero);
  const skyBg = q(".sky-bg");
  if (skyBg) resizer.observe(skyBg);
  undo.push(() => resizer.disconnect());

  // GSAP loads on demand. Without it the page stays complete and still.
  let stopped = false;
  undo.push(() => {
    stopped = true;
  });
  void Promise.all([
    import("gsap"),
    import("gsap/ScrollTrigger"),
    full && finePointer && !lite ? import("lenis") : null,
  ]).then(
    ([{ gsap }, { ScrollTrigger }, lenisModule]) => {
      if (stopped) return;
      gsap.registerPlugin(ScrollTrigger);
      if (lenisModule) {
        // Smooth wheel scrolling on desktop, driven by GSAP's clock so pinned sections stay in step.
        const lenis = new lenisModule.default({
          duration: 1.15,
          smoothWheel: true,
          anchors: { offset: -64 },
        });
        lenis.on("scroll", ScrollTrigger.update);
        const tick = (time: number) => lenis.raf(time * 1000);
        gsap.ticker.add(tick);
        gsap.ticker.lagSmoothing(0);
        undo.push(() => {
          gsap.ticker.remove(tick);
          gsap.ticker.lagSmoothing(500, 33);
          lenis.destroy();
        });
      }
      const context = gsap.context(
        () =>
          scrollMotion({
            gsap,
            ScrollTrigger,
            root,
            q,
            qa,
            undo,
            signal,
            full,
            finePointer,
          }),
        root,
      );
      undo.push(() => context.revert());
      void document.fonts?.ready.then(() => {
        if (!stopped) ScrollTrigger.refresh();
      });
    },
    // Offline or blocked: the page stays complete and still.
    () => {},
  );

  return cleanup;
}

function scrollMotion({
  gsap,
  ScrollTrigger,
  root,
  q,
  qa,
  undo,
  signal,
  full,
  finePointer,
}: {
  gsap: Gsap;
  ScrollTrigger: ScrollTriggerApi;
  root: HTMLElement;
  q: <T extends HTMLElement = HTMLElement>(selector: string) => T | null;
  qa: <T extends HTMLElement = HTMLElement>(selector: string) => T[];
  undo: (() => void)[];
  signal: AbortSignal;
  full: boolean;
  finePointer: boolean;
}) {
  const vh = () => window.innerHeight;
  const hero = q(".hero")!;

  /**
   * Hides `targets` now and brings them back (opacity 1, offsets 0) when the
   * trigger is reached. The hidden state is a plain set: while it measures
   * the pinned sections, ScrollTrigger reverts the start state of from()
   * tweens, which left words showing early or, with less motion, hidden.
   */
  const appear = (
    targets: gsap.TweenTarget,
    { duration, ease, stagger = 0.1, ...hidden }: gsap.TweenVars,
    scrollTrigger: ScrollTrigger.Vars,
  ) => {
    gsap.set(targets, hidden);
    const shown = Object.fromEntries(
      Object.keys(hidden).map((key) => [key, key === "opacity" ? 1 : 0]),
    );
    gsap.to(targets, { ...shown, duration, ease, stagger, scrollTrigger });
  };

  // The page color follows the section in view.
  for (const section of qa("[data-bg]")) {
    ScrollTrigger.create({
      trigger: section,
      start: "top 55%",
      end: "bottom 55%",
      onToggle: (self) => {
        if (!self.isActive) return;
        gsap.to(root, {
          backgroundColor: section.dataset.bg ?? PAGE_COLOR,
          duration: 0.8,
          ease: "power2.out",
          overwrite: "auto",
        });
      },
    });
  }
  undo.push(() => root.style.removeProperty("background-color"));

  // Hero: the text drifts up and fades, the gradient zooms in a little, and
  // the art breaks back into dots and lifts away as the hero scrolls off.
  if (full) {
    const offHero = {
      trigger: hero,
      start: "top top",
      end: "bottom top",
      scrub: true,
    };
    gsap.to(".hero-content", {
      yPercent: -14,
      opacity: 0.2,
      ease: "none",
      scrollTrigger: offHero,
    });
    gsap.to(".sky-bg .mesh, .sky-bg .mesh-canvas", {
      scale: 1.12,
      ease: "none",
      scrollTrigger: offHero,
    });
    gsap.fromTo(
      ".hero-art",
      { "--dot": "6px" },
      {
        "--dot": "0px",
        ease: "none",
        immediateRender: false,
        scrollTrigger: { ...offHero, end: "bottom 30%" },
      },
    );
    gsap.to(".hero-art img", { y: -60, ease: "none", scrollTrigger: offHero });

    // Once formed, the art hovers: three slow sine motions of different
    // lengths, so the drift never repeats in a visible loop.
    const move = q(".art-move");
    if (move) {
      gsap.set(move, { transformOrigin: "40% 45%" });
      const hover = { ease: "sine.inOut", yoyo: true, repeat: -1, delay: 2.2 };
      gsap.fromTo(move, { y: 10 }, { y: -18, duration: 3.2, ...hover });
      gsap.fromTo(move, { x: -8 }, { x: 8, duration: 4.7, ...hover });
      gsap.fromTo(
        move,
        { rotation: -1.4 },
        { rotation: 1.2, duration: 5.9, ...hover },
      );
    }
    // With a mouse, it also leans away from the pointer.
    const tilt = q(".art-tilt");
    if (tilt && finePointer) {
      gsap.set(tilt, { transformPerspective: 1200 });
      const lean = { duration: 1.1, ease: "power3.out" };
      const x = gsap.quickTo(tilt, "x", lean);
      const y = gsap.quickTo(tilt, "y", lean);
      const turn = gsap.quickTo(tilt, "rotationY", lean);
      hero.addEventListener(
        "pointermove",
        (e) => {
          const px = e.clientX / window.innerWidth - 0.5;
          const py = e.clientY / window.innerHeight - 0.5;
          x(px * -34);
          y(py * -20);
          turn(px * 8);
        },
        { signal },
      );
    }
  }

  // Headings rise (or fade in) word by word.
  for (const heading of qa(".split-words")) {
    appear(
      heading.querySelectorAll(".w > span"),
      full
        ? { yPercent: 110, duration: 1, ease: "expo.out", stagger: 0.05 }
        : { opacity: 0, duration: 0.6, ease: "power1.out", stagger: 0.05 },
      { trigger: heading, start: "top 85%", once: true },
    );
  }

  // Cards below the fold come in as they reach the screen.
  const reveal = (selector: string, from: gsap.TweenVars) => {
    const below = qa(selector).filter(
      (el) => el.getBoundingClientRect().top > vh() * 0.88,
    );
    if (below.length === 0) return;
    gsap.set(below, from);
    ScrollTrigger.batch(below, {
      start: "top 88%",
      once: true,
      onEnter: (batch) =>
        gsap.to(batch, {
          y: 0,
          scale: 1,
          opacity: 1,
          duration: full ? 1.2 : 0.7,
          ease: full ? "expo.out" : "power1.out",
          stagger: 0.12,
        }),
    });
  };
  reveal(".tool", full ? { y: 70, scale: 0.96, opacity: 0 } : { opacity: 0 });

  // Tools panel: full width while the hero's colors flow into it, then it
  // shrinks to a rounded block on the way out.
  if (full) {
    gsap
      .timeline({
        scrollTrigger: {
          trigger: ".tools",
          start: "top bottom",
          end: "bottom top",
          scrub: true,
        },
      })
      .set(".tools-bg", { clipPath: "inset(0% 0% 0% 0% round 0px)" }, 0)
      .to(
        ".tools-bg",
        {
          clipPath: "inset(0% 38% 32% 0% round 48px)",
          ease: "none",
          duration: 0.28,
        },
        0.72,
      );
  }

  // Cloud: the section holds still while heroes drift past at different
  // depths and the line lights up. With less motion, the line simply lights
  // up as it scrolls through.
  const cloud = q(".cloud");
  if (cloud) {
    const words = cloud.querySelectorAll(".fill .fw");
    if (!full) {
      gsap.fromTo(
        words,
        { opacity: 0.16 },
        {
          opacity: 1,
          stagger: 0.05,
          ease: "none",
          scrollTrigger: {
            trigger: cloud.querySelector(".fill"),
            start: "top 80%",
            end: "bottom 45%",
            scrub: true,
          },
        },
      );
    } else {
      cloud.classList.add("moving");
      undo.push(() => cloud.classList.remove("moving"));
      const drift = gsap.timeline({
        scrollTrigger: {
          trigger: cloud,
          start: "top top",
          end: "+=160%",
          pin: true,
          scrub: 0.6,
          invalidateOnRefresh: true,
        },
      });
      qa(".tile").forEach((tile, i) => {
        const depth = Number(tile.dataset.depth);
        // Spread the starting heights so the tiles never cross the middle together.
        const startAt = 0.1 + ((i * 0.618) % 1) * 1.5;
        // Depth shows in size and speed only; fading far tiles would leave their text too faint.
        gsap.set(tile, {
          scale: depth,
          zIndex: Math.round(depth * 10),
          xPercent: -50,
        });
        drift.fromTo(
          tile,
          { y: () => startAt * vh() },
          {
            y: () => (startAt - 1.5 - depth * 0.9) * vh(),
            ease: "none",
            duration: 1,
          },
          0,
        );
      });
      drift.fromTo(
        words,
        { opacity: 0.16 },
        { opacity: 1, stagger: 0.02, duration: 0.2, ease: "none" },
        0.15,
      );
    }
  }

  // Tier stack: the cards pile up, and each scroll step throws the top card
  // away to show the next. With less motion the cards stay a list.
  const stack = q(".stack");
  if (stack && !full) reveal(".tier-card", { opacity: 0 });
  if (stack && full) {
    stack.classList.add("stacked");
    undo.push(() => stack.classList.remove("stacked"));
    const cards = qa(".tier-card");
    const behind = (k: number) => ({
      y: -k * 16,
      scale: 1 - k * 0.05,
      opacity: k > 3 ? 0 : 1 - k * 0.12,
    });
    cards.forEach((card, i) =>
      gsap.set(card, {
        zIndex: cards.length - i,
        transformOrigin: "50% 0%",
        ...behind(i),
      }),
    );
    const throwAway = gsap.timeline({
      scrollTrigger: {
        trigger: ".tiers",
        start: "top top",
        end: `+=${(cards.length - 1) * 70}%`,
        pin: true,
        scrub: 0.6,
      },
    });
    cards.slice(0, -1).forEach((card, i) => {
      throwAway.to(
        card,
        {
          xPercent: i % 2 ? 115 : -115,
          yPercent: -12,
          rotation: i % 2 ? 9 : -9,
          opacity: 0,
          duration: 1,
          ease: "power2.in",
        },
        i,
      );
      cards
        .slice(i + 1)
        .forEach((next, j) =>
          throwAway.to(
            next,
            { ...behind(j), duration: 1, ease: "power2.out" },
            i,
          ),
        );
    });
  }

  // Closing: the data section stays put and dims while the closing panel rises over it.
  const data = q(".data");
  if (full && data) {
    if (data.offsetHeight < vh() * 0.95) {
      data.classList.add("pinned");
      undo.push(() => data.classList.remove("pinned"));
    }
    gsap.to(".data-inner", {
      scale: 0.92,
      opacity: 0.35,
      ease: "none",
      scrollTrigger: {
        trigger: ".rise",
        start: "top bottom",
        end: "top 20%",
        scrub: true,
      },
    });
  }
  const stats = { trigger: ".stats", start: "top 92%", once: true };
  appear(
    qa(".stat"),
    { y: full ? 90 : 0, opacity: 0, duration: 1.1, ease: "expo.out" },
    stats,
  );
  qa(".stat b").forEach((el, i) => {
    const target = Number(el.dataset.value);
    const count = { value: 0 };
    el.textContent = "0";
    undo.push(() => {
      el.textContent = String(target);
    });
    gsap.to(count, {
      value: target,
      duration: 1.3,
      delay: 0.2 + i * 0.1,
      ease: "power3.out",
      onUpdate: () => {
        el.textContent = String(Math.round(count.value));
      },
      scrollTrigger: stats,
    });
  });

  // Buttons lean toward the pointer.
  if (full && finePointer) {
    for (const button of qa(".magnetic")) {
      const pull = { duration: 0.5, ease: "power3.out" };
      const x = gsap.quickTo(button, "x", pull);
      const y = gsap.quickTo(button, "y", pull);
      button.addEventListener(
        "pointermove",
        (e) => {
          const r = button.getBoundingClientRect();
          x((e.clientX - r.left - r.width / 2) * 0.25);
          y((e.clientY - r.top - r.height / 2) * 0.35);
        },
        { signal },
      );
      button.addEventListener(
        "pointerleave",
        () => {
          x(0);
          y(0);
        },
        { signal },
      );
    }
  }

  // Triggers were created by kind, not in page order; measure them top to bottom.
  ScrollTrigger.sort();
}
