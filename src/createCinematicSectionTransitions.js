import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

/**
 * Linguagem de transicao entre as grandes areas do site.
 *
 * A ideia e evitar um efeito diferente em cada dobra: usamos sempre os mesmos
 * tres gestos (profundidade, mascara e linha de varredura), variando apenas a
 * intensidade. Assim a pagina parece uma experiencia unica, nao um catalogo
 * de demos GSAP.
 */
export function createCinematicSectionTransitions() {
  const mm = gsap.matchMedia();
  const cleanups = [];

  const addSweep = (section, className = "section-transition-sweep") => {
    if (!section) return null;
    const sweep = document.createElement("span");
    sweep.className = className;
    sweep.setAttribute("aria-hidden", "true");
    section.appendChild(sweep);
    cleanups.push(() => sweep.remove());
    return sweep;
  };

  mm.add(
    {
      desktop:
        "(min-width: 901px) and (prefers-reduced-motion: no-preference)",
      compact:
        "(max-width: 900px) and (prefers-reduced-motion: no-preference)",
      reduced: "(prefers-reduced-motion: reduce)",
    },
    (context) => {
      if (context.conditions.reduced) return;

      const desktop = context.conditions.desktop;
      const service = document.querySelector(".service-intro");
      const plans = document.querySelector(".plans");
      const work = document.querySelector(".pg");
      const process = document.querySelector(".process");
      const transitions = [];

      /* SERVICOS -> PLANOS
         A nova section sobe como uma placa de vidro e abre a mascara. A antiga
         recua discretamente no eixo Z. Sem pin: a transicao acompanha o fluxo e
         nao adiciona mais altura artificial a pagina. */
      if (service && plans) {
        const sweep = addSweep(plans);
        gsap.set(plans, {
          transformOrigin: "50% 0%",
          willChange: "transform, clip-path",
        });

        const tl = gsap.timeline({
          defaults: { ease: "none" },
          scrollTrigger: {
            id: "services-to-plans",
            trigger: plans,
            start: "top 94%",
            end: "top 24%",
            scrub: desktop ? 1.35 : 0.8,
            invalidateOnRefresh: true,
          },
        });

        tl.fromTo(
          plans,
          {
            y: desktop ? 88 : 42,
            scale: desktop ? 0.965 : 0.985,
            clipPath: desktop
              ? "inset(11% 4% 0% 4% round 44px 44px 0 0)"
              : "inset(5% 0% 0% 0% round 24px 24px 0 0)",
          },
          {
            y: 0,
            scale: 1,
            clipPath: "inset(0% 0% 0% 0% round 0px)",
            duration: 1,
            immediateRender: false,
          },
          0,
        ).to(
          service,
          {
            scale: desktop ? 0.975 : 0.99,
            y: desktop ? -28 : -10,
            opacity: 0.52,
            filter: desktop ? "blur(3px)" : "blur(0px)",
            duration: 0.72,
          },
          0,
        );

        if (sweep) {
          tl.fromTo(
            sweep,
            { scaleX: 0, opacity: 0 },
            { scaleX: 1, opacity: 1, duration: 0.34, immediateRender: false },
            0.16,
          ).to(sweep, { opacity: 0, duration: 0.22 }, 0.72);
        }

        transitions.push(tl);
      }

      /* PLANOS -> PORTFOLIO
         "Portal" de profundidade: o portfolio nasce menor, com cantos vivos,
         e ocupa a tela enquanto a tabela comercial recua. E o equivalente 2D
         do zoom-through sem forcar WebGL adicional. */
      if (plans && work) {
        const sweep = addSweep(work, "section-transition-sweep section-transition-sweep--center");
        gsap.set(work, {
          transformOrigin: "50% 0%",
          willChange: "transform, clip-path",
        });

        const tl = gsap.timeline({
          defaults: { ease: "none" },
          scrollTrigger: {
            id: "plans-to-work",
            trigger: work,
            start: "top 96%",
            end: "top 22%",
            scrub: desktop ? 1.5 : 0.85,
            invalidateOnRefresh: true,
          },
        });

        tl.fromTo(
          work,
          {
            y: desktop ? 70 : 34,
            scale: desktop ? 0.93 : 0.98,
            clipPath: desktop
              ? "inset(8% 7% 7% 7% round 48px)"
              : "inset(3% 0% 2% 0% round 22px)",
          },
          {
            y: 0,
            scale: 1,
            clipPath: "inset(0% 0% 0% 0% round 0px)",
            duration: 1,
            immediateRender: false,
          },
          0,
        ).to(
          plans,
          {
            scale: desktop ? 0.97 : 0.992,
            y: desktop ? -24 : -8,
            opacity: 0.42,
            duration: 0.72,
          },
          0,
        );

        if (sweep) {
          tl.fromTo(
            sweep,
            { scaleX: 0, opacity: 0 },
            { scaleX: 1, opacity: 0.9, duration: 0.3, immediateRender: false },
            0.18,
          ).to(sweep, { opacity: 0, duration: 0.24 }, 0.68);
        }

        transitions.push(tl);
      }

      /* PORTFOLIO -> PROCESSO
         A grade do portfolio ja possui seu proprio storytelling/pin. Aqui a
         passagem e curta: mascara vertical + leve subida, para o processo
         entrar limpo sem competir com o controlador da galeria. */
      if (work && process) {
        const sweep = addSweep(process);
        gsap.set(process, { willChange: "transform, clip-path" });

        const tl = gsap.timeline({
          defaults: { ease: "none" },
          scrollTrigger: {
            id: "work-to-process",
            trigger: process,
            start: "top 92%",
            end: "top 34%",
            scrub: desktop ? 1.15 : 0.75,
            invalidateOnRefresh: true,
          },
        });

        tl.fromTo(
          process,
          {
            y: desktop ? 52 : 26,
            clipPath: desktop
              ? "inset(14% 0% 0% 0% round 36px 36px 0 0)"
              : "inset(6% 0% 0% 0% round 20px 20px 0 0)",
          },
          {
            y: 0,
            clipPath: "inset(0% 0% 0% 0% round 0px)",
            duration: 1,
            immediateRender: false,
          },
          0,
        );

        if (sweep) {
          tl.fromTo(
            sweep,
            { scaleX: 0, opacity: 0 },
            { scaleX: 1, opacity: 0.8, duration: 0.36, immediateRender: false },
            0.08,
          ).to(sweep, { opacity: 0, duration: 0.24 }, 0.7);
        }

        transitions.push(tl);
      }

      return () => {
        transitions.forEach((tl) => {
          tl.scrollTrigger?.kill();
          tl.kill();
        });
        [service, plans, work, process].filter(Boolean).forEach((node) => {
          gsap.set(node, { clearProps: "transform,opacity,filter,clipPath,willChange" });
        });
      };
    },
  );

  return {
    dispose() {
      mm.revert();
      cleanups.splice(0).forEach((cleanup) => cleanup());
    },
  };
}
