import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

const DESKTOP_LAYOUT = [
  { x: -0.34, y: -0.08, z: 110, rx: 2, ry: 13, rz: -5, scale: 0.76 },
  { x: -0.08, y: 0.17, z: 210, rx: -2, ry: -7, rz: 2, scale: 0.92 },
  { x: 0.27, y: -0.11, z: 60, rx: 2, ry: -14, rz: 5, scale: 0.73 },
  { x: -0.3, y: 0.29, z: -70, rx: -3, ry: 10, rz: -3, scale: 0.64 },
  { x: 0.31, y: 0.24, z: 90, rx: 1, ry: -11, rz: -4, scale: 0.69 },
  { x: 0.07, y: -0.3, z: -150, rx: 3, ry: 5, rz: -2, scale: 0.58 },
];

const TABLET_LAYOUT = [
  { x: -0.31, y: -0.1, z: 80, rx: 1, ry: 10, rz: -4, scale: 0.72 },
  { x: -0.08, y: 0.18, z: 170, rx: -2, ry: -6, rz: 2, scale: 0.86 },
  { x: 0.27, y: -0.12, z: 40, rx: 2, ry: -11, rz: 5, scale: 0.69 },
  { x: -0.27, y: 0.28, z: -60, rx: -2, ry: 8, rz: -3, scale: 0.61 },
  { x: 0.28, y: 0.25, z: 60, rx: 1, ry: -9, rz: -4, scale: 0.64 },
  { x: 0.07, y: -0.29, z: -120, rx: 2, ry: 4, rz: -2, scale: 0.55 },
];

const MOBILE_LAYOUT = [
  { x: -0.08, y: -0.15, z: 120, rx: 1, ry: 7, rz: -4, scale: 0.82 },
  { x: 0.22, y: 0.03, z: 30, rx: -1, ry: -8, rz: 3, scale: 0.68 },
  { x: -0.24, y: 0.17, z: -20, rx: 2, ry: 8, rz: -3, scale: 0.63 },
  { x: 0.2, y: 0.27, z: -80, rx: -2, ry: -7, rz: 4, scale: 0.57 },
  { x: -0.18, y: 0.34, z: -120, rx: 1, ry: 6, rz: -2, scale: 0.53 },
  { x: 0.08, y: -0.29, z: -150, rx: 2, ry: -4, rz: 2, scale: 0.5 },
];

const clamp01 = gsap.utils.clamp(0, 1);

export function createPortfolioGallery(section) {
  if (!section) return { dispose() {} };

  const scene = section.querySelector(".portfolio-scene");
  const tilt = section.querySelector(".portfolio-tilt");
  const world = section.querySelector(".portfolio-world");
  const cards = gsap.utils.toArray(section.querySelectorAll(".pf-card"));
  const cardInners = cards.map((card) => card.querySelector(".pf-inner"));
  if (!scene || !tilt || !world || !cards.length) return { dispose() {} };

  section.classList.add("is-editorial");

  const listeners = [];
  const on = (target, type, handler, options) => {
    target.addEventListener(type, handler, options);
    listeners.push(() => target.removeEventListener(type, handler, options));
  };

  const mm = gsap.matchMedia();

  mm.add(
    {
      desktop: "(min-width: 1025px) and (prefers-reduced-motion: no-preference)",
      tablet: "(min-width: 641px) and (max-width: 1024px) and (prefers-reduced-motion: no-preference)",
      mobile: "(max-width: 640px) and (prefers-reduced-motion: no-preference)",
      reduced: "(prefers-reduced-motion: reduce)",
    },
    (context) => {
      const { desktop, tablet, mobile, reduced } = context.conditions;
      const contextListeners = [];
      const onContext = (target, type, handler, options) => {
        target.addEventListener(type, handler, options);
        contextListeners.push(() => target.removeEventListener(type, handler, options));
      };

      if (reduced) {
        section.classList.add("is-static");
        gsap.set([tilt, world, ...cards, ...cardInners], { clearProps: "all" });
        return () => section.classList.remove("is-static");
      }

      section.classList.remove("is-static");

      const layout = mobile ? MOBILE_LAYOUT : tablet ? TABLET_LAYOUT : DESKTOP_LAYOUT;
      const depth = desktop ? -820 : tablet ? -660 : -520;
      const rowScale = mobile ? 0.78 : tablet ? 0.7 : 0.72;
      const rowYFactor = mobile ? 0.17 : 0.14;
      const gap = mobile ? 18 : tablet ? 24 : 32;
      const cardStep = () => cards[0].offsetWidth * rowScale + gap;
      const rowY = () => window.innerHeight * rowYFactor;

      gsap.set(cards, {
        xPercent: -50,
        yPercent: -50,
        transformOrigin: "50% 50%",
      });
      gsap.set(cardInners, {
        transformOrigin: "50% 50%",
        opacity: 1,
        scale: 1,
        filter: "brightness(1) saturate(1)",
      });

      const timeline = gsap.timeline({
        defaults: { ease: "none" },
        scrollTrigger: {
          trigger: section,
          start: "top top",
          end: () => `+=${mobile ? 1900 : tablet ? 2350 : 2900}`,
          pin: true,
          scrub: 2,
          anticipatePin: 1,
          invalidateOnRefresh: true,
        },
      });

      timeline.addLabel("constellation", 0);

      cards.forEach((card, index) => {
        const target = layout[index % layout.length];

        timeline.fromTo(
          card,
          {
            x: (index - (cards.length - 1) / 2) * (mobile ? 10 : 18),
            y: 80 + index * 7,
            z: depth - index * 70,
            rotationX: 10 - index * 2,
            rotationY: (index - 2.5) * 9,
            rotationZ: (index - 2.5) * 2,
            scale: 0.18,
            opacity: 0,
          },
          {
            x: () => window.innerWidth * target.x,
            y: () => window.innerHeight * target.y,
            z: target.z,
            rotationX: target.rx,
            rotationY: target.ry,
            rotationZ: target.rz,
            scale: target.scale,
            opacity: 1,
            duration: 0.66,
            ease: "power3.out",
          },
          index * 0.04,
        );
      });

      timeline.fromTo(
        world,
        { z: -90, rotationX: 3 },
        { z: 0, rotationX: 0, duration: 0.82, ease: "power2.out" },
        0,
      );

      timeline.to({}, { duration: 0.16 });
      timeline.addLabel("align");

      cards.forEach((card, index) => {
        timeline.to(
          card,
          {
            x: () => index * cardStep(),
            y: rowY,
            z: 0,
            rotationX: 0,
            rotationY: 0,
            rotationZ: 0,
            scale: rowScale,
            opacity: 1,
            duration: 0.58,
            ease: "power3.inOut",
          },
          "align",
        );
      });

      timeline.to(world, { rotationX: 0, rotationY: 0, z: 0, duration: 0.58 }, "align");
      timeline.addLabel("horizontal");

      cards.forEach((card, index) => {
        timeline.to(
          card,
          {
            x: () => (index - (cards.length - 1)) * cardStep(),
            duration: 1.5,
            ease: "none",
          },
          "horizontal",
        );
      });

      timeline.to({}, { duration: 0.14 });

      const updateEditorialFocus = () => {
        const currentTime = timeline.time();
        const alignAt = timeline.labels.align;
        const horizontalAt = timeline.labels.horizontal;
        const horizontalEnd = horizontalAt + 1.5;
        const alignmentProgress = clamp01(
          (currentTime - alignAt) / Math.max(0.001, horizontalAt - alignAt),
        );
        const horizontalProgress = clamp01(
          (currentTime - horizontalAt) / Math.max(0.001, horizontalEnd - horizontalAt),
        );
        const activeIndex = horizontalProgress * (cards.length - 1);

        cards.forEach((card, index) => {
          const inner = cardInners[index];
          if (!inner) return;

          const distance = Math.abs(index - activeIndex);
          const focus = 1 - clamp01(distance / 1.15);
          const opacity = 1 - alignmentProgress * (0.62 * (1 - focus));
          const innerScale = 1 + alignmentProgress * (0.085 * focus - 0.045 * (1 - focus));
          const brightness = 0.72 + focus * 0.28;
          const saturation = 0.68 + focus * 0.32;
          const glow = Math.round(10 + focus * 28);
          const glowAlpha = (0.02 + focus * 0.13).toFixed(3);

          gsap.set(inner, {
            opacity,
            scale: innerScale,
            filter: `brightness(${brightness}) saturate(${saturation})`,
            borderColor: `rgba(90, 215, 255, ${0.1 + focus * 0.42})`,
            boxShadow: `0 34px 90px rgba(0, 0, 0, 0.68), 0 0 ${glow}px rgba(90, 215, 255, ${glowAlpha})`,
          });
          card.style.zIndex = String(10 + Math.round(focus * 90));
        });
      };

      timeline.eventCallback("onUpdate", updateEditorialFocus);
      updateEditorialFocus();

      const canHover = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
      if (canHover) {
        const tiltX = gsap.quickTo(tilt, "rotationX", { duration: 0.8, ease: "power3.out" });
        const tiltY = gsap.quickTo(tilt, "rotationY", { duration: 0.8, ease: "power3.out" });

        onContext(scene, "pointermove", (event) => {
          if (timeline.time() >= timeline.labels.align) {
            tiltX(0);
            tiltY(0);
            return;
          }

          const rect = scene.getBoundingClientRect();
          const nx = (event.clientX - rect.left) / rect.width - 0.5;
          const ny = (event.clientY - rect.top) / rect.height - 0.5;
          tiltX(ny * -5);
          tiltY(nx * 7);
        });

        onContext(scene, "pointerleave", () => {
          tiltX(0);
          tiltY(0);
        });
      }

      return () => {
        contextListeners.forEach((off) => off());
        timeline.eventCallback("onUpdate", null);
        timeline.scrollTrigger?.kill();
        timeline.kill();
        gsap.killTweensOf([tilt, world, ...cards, ...cardInners]);
        cards.forEach((card) => {
          card.style.zIndex = "";
        });
        gsap.set([tilt, world, ...cards, ...cardInners], { clearProps: "all" });
      };
    },
  );

  section.querySelectorAll(".pf-media").forEach((image) => {
    if (!image.complete) on(image, "load", () => ScrollTrigger.refresh(), { once: true });
  });
  on(window, "load", () => ScrollTrigger.refresh(), { once: true });

  return {
    dispose() {
      listeners.forEach((off) => off());
      listeners.length = 0;
      mm.revert();
      section.classList.remove("is-editorial", "is-static");
    },
  };
}
