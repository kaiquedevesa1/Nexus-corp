import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { MotionPathPlugin } from "gsap/MotionPathPlugin";
import SplitType from "split-type";
import { textFade } from "./textFade.js";
import cuboUrl from "./assets/projects/cubo-magico.png";
import auraUrl from "./assets/projects/aura.jpg";
import massasUrl from "./assets/projects/mundo-das-massas.jpg";
import nexoraUrl from "./assets/projects/nexora.jpg";
import niveoUrl from "./assets/projects/niveo.jpg";
import ragnarokUrl from "./assets/projects/ragnarok.jpg";

gsap.registerPlugin(ScrollTrigger, MotionPathPlugin);

const pad = (value) => String(value).padStart(2, "0");
const PROJECT_IMAGES = {
  cubo: cuboUrl,
  aura: auraUrl,
  massas: massasUrl,
  nexora: nexoraUrl,
  niveo: niveoUrl,
  ragnarok: ragnarokUrl,
};

/**
 * Galeria horizontal de portfolio.
 *
 * Desktop: a secao e fixada (pin) e o trilho anda no eixo X conforme o scroll
 * vertical — distancia 1:1, entao o gesto continua sendo "rolar a pagina".
 * Mobile: o trilho vira um carrossel de rolagem nativa com snap, que responde
 * melhor ao toque do que um pin.
 *
 * @param {Element} section  raiz .pg
 * @param {{ lenis?: { scrollTo: Function } }} [options]
 *   Instancia Lenis ja criada na pagina — usada para reposicionar o scroll
 *   quando um card recebe foco por teclado. Sem ela o foco continua
 *   funcionando, so nao acompanha o card.
 */
export function createPortfolioShowcase(section, options = {}) {
  if (!section) return { dispose() {} };

  const { lenis } = options;
  const viewport = section.querySelector(".pg-viewport");
  const track = section.querySelector(".pg-track");
  const cards = gsap.utils.toArray(".pg-card", section);
  const title = section.querySelector(".pg-title");
  const railFill = section.querySelector(".pg-rail i");
  const hint = section.querySelector(".pg-hint");
  const current = section.querySelector("[data-pg-current]");
  const total = section.querySelector("[data-pg-total]");
  const flowDot = section.querySelector(".pg-flow__dot");
  const flowPath = section.querySelector(".pg-flow path");

  if (!viewport || !track || !cards.length) return { dispose() {} };

  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const listeners = [];
  const on = (target, type, handler, opts) => {
    target.addEventListener(type, handler, opts);
    listeners.push(() => target.removeEventListener(type, handler, opts));
  };
  const rectReads = new WeakMap();
  const readRectOnce = (element, event) => {
    const cached = rectReads.get(element);
    if (cached?.event === event) return cached.rect;
    const rect = element.getBoundingClientRect();
    rectReads.set(element, { event, rect });
    return rect;
  };
  const onAnimationFrame = (handler) => {
    let frame = 0;
    let latestEvent;
    const listener = (event) => {
      latestEvent = event;
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        handler(latestEvent);
      });
    };
    listeners.push(() => cancelAnimationFrame(frame));
    return listener;
  };

  /* O lazy loading nativo considera principalmente a distancia vertical. Como
     todos os cards vivem no mesmo trilho horizontal, o navegador baixava as
     seis imagens no primeiro carregamento. A origem real so e aplicada quando
     a galeria se aproxima; largura/altura e o placeholder mantem o layout. */
  const projectImages = [...section.querySelectorAll(".pg-img[data-pg-src]")];
  const hydrateProjectImages = () => {
    projectImages.forEach((image) => {
      const source = PROJECT_IMAGES[image.dataset.pgSrc];
      if (!source || image.dataset.pgHydrated) return;
      image.dataset.pgHydrated = "true";
      image.fetchPriority = "low";
      image.src = source;
    });
  };
  const imageObserver = new IntersectionObserver(
    ([entry]) => {
      if (!entry.isIntersecting) return;
      imageObserver.disconnect();
      hydrateProjectImages();
    },
    { rootMargin: "800px 0px" },
  );
  imageObserver.observe(section);
  listeners.push(() => imageObserver.disconnect());

  if (total) total.textContent = `/ ${pad(cards.length)}`;

  /* ---------------------------------------------------------------------
     Titulo — SplitType. O reveal e por caractere, mas a mascara e por
     PALAVRA (.pg-title .word { overflow: hidden }): palavra nao quebra no
     meio quando a linha reflui, entao o clip continua valido no resize sem
     precisar refazer o split.
     ------------------------------------------------------------------- */
  const split = title ? new SplitType(title, { types: "words,chars" }) : null;

  /* Reveals reversiveis, como no resto da pagina (ver src/textFade.js).
     A faixa termina em "top 46%", antes de o pin da galeria engatar em
     "top top": o cabecalho conclui sua entrada durante a aproximacao, e nao
     disputando scroll com a rolagem horizontal dos cards. */
  if (split?.chars?.length) {
    /* O titulo daqui TEM mascara por palavra (.pg-title .word tem
       overflow: hidden), entao o caractere pode vir de uma linha inteira
       abaixo sem invadir nada — o clip o esconde ate ele emergir. */
    textFade(split.chars, {
      trigger: section,
      start: "top 82%",
      end: "top 44%",
      yPercent: 100,
      duration: 0.95,
      stagger: 0.013,
    });
  }

  textFade(section.querySelectorAll(".pg-label, .pg-copy, .pg-nav"), {
    trigger: section,
    start: "top 78%",
    end: "top 42%",
    duration: 0.85,
    stagger: 0.1,
  });

  /* ---------------------------------------------------------------------
     Progresso: trilho + contador + card em foco.
     Tudo derivado do progress (0..1) — nenhuma leitura de layout por frame.
     ------------------------------------------------------------------- */
  const setRail = railFill ? gsap.quickSetter(railFill, "scaleX") : null;
  const anomalyControllers = [];
  let activeIndex = -1;

  const setProgress = (progress) => {
    const p = gsap.utils.clamp(0, 1, progress);
    setRail?.(p);

    const index = Math.round(p * (cards.length - 1));
    if (index === activeIndex) return;

    cards[activeIndex]?.classList.remove("is-active");
    cards[index]?.classList.add("is-active");
    activeIndex = index;
    if (current) current.textContent = pad(index + 1);

    /* A troca do card central ganha um pequeno evento visual. O primeiro
       card nao toca durante o carregamento, quando a galeria ainda pode
       estar fora da viewport. */
    const sectionBounds = section.getBoundingClientRect();
    if (
      anomalyControllers[index] &&
      sectionBounds.top < innerHeight &&
      sectionBounds.bottom > 0
    ) {
      anomalyControllers[index].play();
    }
  };

  setProgress(0);

  const performanceActivity = ScrollTrigger.create({
    trigger: section,
    start: "top bottom",
    end: "bottom top",
    onToggle: ({ isActive }) =>
      section.classList.toggle("is-performing", isActive),
  });
  listeners.push(() => {
    performanceActivity.kill();
    section.classList.remove("is-performing");
  });

  /* --- ponto de luz percorrendo a curva (MotionPathPlugin) -------------- */
  if (flowDot && flowPath && !reducedMotion) {
    const travel = gsap.to(flowDot, {
      duration: 11,
      repeat: -1,
      ease: "none",
      motionPath: {
        path: flowPath,
        align: flowPath,
        alignOrigin: [0.5, 0.5],
      },
    });

    /* Pausa ANTES de criar o trigger: onToggle so dispara na virada, entao
       pausar depois deixaria o ponto congelado quando a secao ja estivesse
       visivel no carregamento. */
    travel.pause();

    const visibility = ScrollTrigger.create({
      trigger: section,
      start: "top bottom",
      end: "bottom top",
      onToggle: (self) => (self.isActive ? travel.play() : travel.pause()),
    });

    if (visibility.isActive) travel.play();

    listeners.push(() => {
      visibility.kill();
      travel.kill();
    });
  }

  /* --- spotlight que segue o cursor dentro do card --------------------- */
  if (matchMedia("(hover: hover) and (pointer: fine)").matches) {
    cards.forEach((card) => {
      on(card, "pointermove", onAnimationFrame((event) => {
        const rect = readRectOnce(card, event);
        card.style.setProperty("--mx", `${event.clientX - rect.left}px`);
        card.style.setProperty("--my", `${event.clientY - rect.top}px`);
      }), { passive: true });
    });
  }

  /* ---------------------------------------------------------------------
     Anomalia digital: scanner + separacao RGB + tilt magnetico.

     As camadas sao decorativas e criadas aqui para que novos cards recebam
     o efeito automaticamente, sem duplicar markup no HTML.
     ------------------------------------------------------------------- */
  if (!reducedMotion) {
    const finePointer = matchMedia("(hover: hover) and (pointer: fine)").matches;

    cards.forEach((card) => {
      const frame = card.querySelector(".pg-frame");
      const image = card.querySelector(".pg-img");
      const title = card.querySelector(".pg-name");
      if (!frame || !image) return;

      const anomaly = document.createElement("div");
      anomaly.className = "pg-anomaly";
      anomaly.setAttribute("aria-hidden", "true");

      const redLayer = image.cloneNode(false);
      redLayer.className = "pg-glitch pg-glitch--red";
      redLayer.alt = "";

      const cyanLayer = image.cloneNode(false);
      cyanLayer.className = "pg-glitch pg-glitch--cyan";
      cyanLayer.alt = "";

      const syncGlitchSource = () => {
        const source = image.currentSrc || image.src;
        redLayer.src = source;
        cyanLayer.src = source;
      };
      on(image, "load", syncGlitchSource);
      syncGlitchSource();

      const scanner = document.createElement("span");
      scanner.className = "pg-scanner";

      const signal = document.createElement("span");
      signal.className = "pg-signal";
      signal.innerHTML = "<i></i> SIGNAL ACQUIRED";

      anomaly.append(redLayer, cyanLayer, scanner, signal);
      frame.prepend(anomaly);

      gsap.set(frame, {
        transformPerspective: 900,
        transformOrigin: "50% 50%",
      });

      const randomClip = () => {
        const top = gsap.utils.random(4, 72, 1);
        const height = gsap.utils.random(6, 20, 1);
        return `inset(${top}% 0 ${Math.max(0, 100 - top - height)}% 0)`;
      };

      const timeline = gsap.timeline({
        paused: true,
        defaults: { ease: "power3.out" },
      });

      timeline
        .set([redLayer, cyanLayer], { opacity: 0, x: 0 })
        .set(scanner, { opacity: 0, yPercent: -120 })
        .set(signal, { opacity: 0, x: -8 })
        .to(frame, { y: -8, scale: 1.025, duration: 0.42 }, 0)
        .to(
          image,
          {
            scale: 1.09,
            filter: "contrast(1.24) saturate(1.32) brightness(1.05)",
            duration: 0.48,
          },
          0,
        )
        .to(scanner, { opacity: 1, duration: 0.08 }, 0.08)
        .to(
          scanner,
          { yPercent: 650, duration: 1.05, ease: "power2.inOut" },
          0.08,
        )
        .to(signal, { opacity: 1, x: 0, duration: 0.22 }, 0.18)
        .to(signal, { opacity: 0, duration: 0.28 }, 0.88)
        .to(
          redLayer,
          {
            opacity: 0.65,
            x: () => gsap.utils.random(-12, -6),
            clipPath: randomClip,
            duration: 0.045,
          },
          0.16,
        )
        .to(
          cyanLayer,
          {
            opacity: 0.7,
            x: () => gsap.utils.random(7, 14),
            clipPath: randomClip,
            duration: 0.045,
          },
          0.16,
        )
        .to([redLayer, cyanLayer], {
          x: () => gsap.utils.random(-5, 5),
          clipPath: randomClip,
          duration: 0.055,
          repeat: 3,
          yoyo: true,
        })
        .to([redLayer, cyanLayer], { opacity: 0, x: 0, duration: 0.12 })
        .to(
          title,
          {
            letterSpacing: "0.035em",
            textShadow: "0 0 24px rgba(90, 215, 255, 0.88)",
            duration: 0.22,
          },
          0.3,
        )
        .to(
          title,
          {
            letterSpacing: "-0.035em",
            textShadow: "0 0 0 rgba(90, 215, 255, 0)",
            duration: 0.65,
          },
          0.58,
        )
        .to(
          image,
          {
            filter: "contrast(1) saturate(1) brightness(1)",
            duration: 0.7,
          },
          0.72,
        );

      const play = () => timeline.invalidate().restart();
      anomalyControllers.push({ play });

      if (finePointer) {
        const rotateXTo = gsap.quickTo(frame, "rotationX", {
          duration: 0.45,
          ease: "power3.out",
        });
        const rotateYTo = gsap.quickTo(frame, "rotationY", {
          duration: 0.45,
          ease: "power3.out",
        });

        on(card, "pointerenter", play);
        on(card, "pointermove", onAnimationFrame((event) => {
          const rect = readRectOnce(card, event);
          const x = (event.clientX - rect.left) / rect.width - 0.5;
          const y = (event.clientY - rect.top) / rect.height - 0.5;
          rotateXTo(-y * 7);
          rotateYTo(x * 8);
        }), { passive: true });
        on(card, "pointerleave", () => {
          rotateXTo(0);
          rotateYTo(0);
          gsap.to(frame, {
            y: 0,
            scale: 1,
            duration: 0.65,
            ease: "elastic.out(1, 0.6)",
            overwrite: "auto",
          });
        });
      }

      listeners.push(() => {
        timeline.kill();
        gsap.killTweensOf([frame, image, title, redLayer, cyanLayer, scanner, signal]);
        anomaly.remove();
      });
    });

    /* O primeiro card tambem apresenta o efeito quando a galeria entra pela
       primeira vez; depois disso cada troca de card e cada hover o repetem. */
    const firstAnomaly = ScrollTrigger.create({
      trigger: section,
      start: "top 72%",
      once: true,
      onEnter: () => anomalyControllers[activeIndex]?.play(),
    });
    listeners.push(() => firstAnomaly.kill());
  }

  /* ---------------------------------------------------------------------
     Layout do trilho por breakpoint.
     ------------------------------------------------------------------- */
  const mm = gsap.matchMedia();

  mm.add(
    {
      pinned: "(min-width: 901px) and (prefers-reduced-motion: no-preference)",
      swipe: "(max-width: 900px) and (prefers-reduced-motion: no-preference)",
      reduced: "(prefers-reduced-motion: reduce)",
    },
    (context) => {
      const { pinned, swipe } = context.conditions;

      if (!pinned && !swipe) {
        section.classList.add("is-static");
        cards.forEach((card) => card.classList.remove("is-active"));
        return () => section.classList.remove("is-static");
      }

      section.classList.remove("is-static");

      const localListeners = [];
      const onLocal = (target, type, handler, opts) => {
        target.addEventListener(type, handler, opts);
        localListeners.push(() =>
          target.removeEventListener(type, handler, opts),
        );
      };

      /* --- MOBILE: rolagem nativa horizontal --------------------------- */
      if (swipe) {
        // Sem isso o Lenis captura o gesto horizontal do trackpad e o
        // carrossel nao anda.
        viewport.setAttribute("data-lenis-prevent", "");

        const defaultHint = hint?.textContent;
        if (hint) hint.textContent = "Arraste para navegar";

        const syncFromScroll = () => {
          const max = track.offsetWidth - viewport.clientWidth;
          setProgress(max > 0 ? viewport.scrollLeft / max : 0);
        };

        onLocal(viewport, "scroll", syncFromScroll, { passive: true });
        syncFromScroll();

        const entrance = gsap.from(cards, {
          scrollTrigger: { trigger: section, start: "top 68%" },
          y: 42,
          opacity: 0,
          duration: 0.9,
          ease: "power3.out",
          stagger: 0.08,
        });

        return () => {
          viewport.removeAttribute("data-lenis-prevent");
          if (hint && defaultHint) hint.textContent = defaultHint;
          localListeners.forEach((off) => off());
          entrance.scrollTrigger?.kill();
          entrance.kill();
          gsap.set(cards, { clearProps: "all" });
        };
      }

      /* --- DESKTOP: pin + deslocamento horizontal ----------------------
         offsetWidth (e nao scrollWidth) porque o trilho e um flex item com
         `flex: 0 0 auto`: ele ja tem a largura real do conteudo, padding
         lateral incluso. */
      const distance = () =>
        Math.max(1, track.offsetWidth - viewport.clientWidth);

      const horizontal = gsap.to(track, {
        x: () => -distance(),
        ease: "none",
        scrollTrigger: {
          id: "portfolio-horizontal",
          trigger: section,
          start: "top top",
          end: () => `+=${distance()}`,
          pin: true,
          refreshPriority: 20,
          /* O Lenis ja suaviza a roda. Um scrub de 2s dentro do pin fazia o
             trilho parecer parado antes de correr atras do scroll. */
          scrub: 0.5,
          anticipatePin: 1,
          invalidateOnRefresh: true,
          onUpdate: (self) => setProgress(self.progress),
          onRefresh: (self) => setProgress(self.progress),
        },
      });

      /* Parallax da imagem dentro do card enquanto ele cruza a tela.
         containerAnimation liga o ScrollTrigger ao movimento horizontal em
         vez do scroll vertical. */
      const parallax = cards.map((card) => {
        const media = card.querySelector(".pg-media");
        const body = card.querySelector(".pg-body");
        const timeline = gsap.timeline({
          scrollTrigger: {
            trigger: card,
            containerAnimation: horizontal,
            start: "left right",
            end: "right left",
            /* Segue a animacao horizontal sem uma segunda camada de atraso. */
            scrub: true,
          },
        });

        if (media) {
          timeline.fromTo(
            media,
            { xPercent: -6 },
            { xPercent: 6, ease: "none" },
            0,
          );
        }
        if (body) {
          timeline.fromTo(
            body,
            { xPercent: 4 },
            { xPercent: -4, ease: "none" },
            0,
          );
        }

        return timeline;
      });

      const entrance = gsap.from(cards, {
        scrollTrigger: { trigger: section, start: "top 62%" },
        yPercent: 9,
        opacity: 0,
        duration: 1,
        ease: "power3.out",
        stagger: 0.07,
        clearProps: "opacity,transform",
      });

      /* Foco por teclado: o card alvo pode estar fora da tela. O navegador
         tentaria rolar o proprio .pg-viewport (que tem overflow hidden) e
         desalinharia o trilho — entao zeramos isso e movemos a pagina ate a
         posicao de scroll que centraliza o card. */
      let restoreUntil = 0;

      const onFocusIn = (event) => {
        viewport.scrollLeft = 0;

        const card = event.target.closest(".pg-card");
        const trigger = horizontal.scrollTrigger;
        if (!card || !trigger || !lenis) return;

        const index = cards.indexOf(card);
        const ratio = cards.length > 1 ? index / (cards.length - 1) : 0;
        lenis.scrollTo(trigger.start + (trigger.end - trigger.start) * ratio, {
          immediate: true,
        });

        // janela em que um blur "orfao" ainda conta como efeito do pin
        restoreUntil = performance.now() + 400;
      };

      /* Ao ligar/desligar o pin o ScrollTrigger reinsere a secao no DOM, e
         isso apaga o foco do elemento que estava dentro dela — o Tab do
         teclado voltaria para o topo da pagina. Um blur sem destino
         (relatedTarget null) logo apos o scroll acima e sempre esse caso,
         nunca uma acao do usuario, entao devolvemos o foco. */
      const onFocusOut = (event) => {
        const target = event.target;
        if (event.relatedTarget || performance.now() > restoreUntil) return;

        requestAnimationFrame(() => {
          if (
            target.isConnected &&
            document.activeElement === document.body &&
            performance.now() <= restoreUntil
          ) {
            target.focus({ preventScroll: true });
          }
        });
      };

      onLocal(section, "focusin", onFocusIn);
      onLocal(section, "focusout", onFocusOut);

      return () => {
        localListeners.forEach((off) => off());
        parallax.forEach((timeline) => {
          timeline.scrollTrigger?.kill();
          timeline.kill();
        });
        entrance.scrollTrigger?.kill();
        entrance.kill();
        horizontal.scrollTrigger?.kill();
        horizontal.kill();
        gsap.set([track, ...cards], { clearProps: "all" });
      };
    },
  );

  /* Imagem que chega depois muda a altura do card e, com ela, a distancia
     total do pin. */
  let refreshFrame = 0;
  const scheduleRefresh = () => {
    if (refreshFrame) return;
    refreshFrame = requestAnimationFrame(() => {
      refreshFrame = 0;
      ScrollTrigger.refresh();
    });
  };
  listeners.push(() => cancelAnimationFrame(refreshFrame));
  projectImages.forEach((image) => {
    on(image, "load", scheduleRefresh);
  });
  on(window, "load", scheduleRefresh, { once: true });

  return {
    dispose() {
      listeners.forEach((off) => off());
      listeners.length = 0;
      mm.revert();
      split?.revert();
      cards.forEach((card) => card.classList.remove("is-active"));
      section.classList.remove("is-static");
    },
  };
}
