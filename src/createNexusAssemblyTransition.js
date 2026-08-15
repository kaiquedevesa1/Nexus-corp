import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

const SYMBOL_PATHS = {
  upper: "M159 63 199 37 341 127 341 345 277 385 152 304 152 249 294 334 295 152Z",
  lower: "M102 100 49 131 49 345 197 436 230 413 95 330 95 159 238 249 238 190Z",
};

const createLayer = (className, tagName = "div") => {
  const element =
    tagName === "svg"
      ? document.createElementNS("http://www.w3.org/2000/svg", "svg")
      : document.createElement(tagName);
  element.classList.add(...className.split(/\s+/).filter(Boolean));
  element.setAttribute("aria-hidden", "true");
  return element;
};

/**
 * PORTAL PELA MARCA.
 *
 * As duas pecas do simbolo entram e se encaixam sem retirar nenhum elemento
 * do Processo. Ai o interior da marca vira uma JANELA: um painel escuro cobre
 * a tela com o simbolo recortado como buraco (fill-rule evenodd) e a
 * o Contato ja aparece aceso dentro do recorte. A camara entao
 * mergulha pelo portal — painel e contorno escalam juntos ate a marca cruzar
 * a diagonal da tela e o painel dissolver na travessia.
 *
 * Nenhuma mascara ou clip-path e animada: o recorte e geometria estatica do
 * SVG e o mergulho e transform + opacity, entao o scrub inteiro resolve no
 * compositor.
 */
export function createNexusAssemblyTransition(cover, target, options = {}) {
  if (!cover || !target) return { dispose() {} };

  const follower = target.nextElementSibling?.matches(".contact")
    ? target.nextElementSibling
    : null;
  const mm = gsap.matchMedia();

  mm.add("(prefers-reduced-motion: no-preference)", () => {
    const compact = matchMedia("(max-width: 700px)").matches;
    const processLineFill = cover.querySelector(".process-line span");
    const maskId = `nexus-symbol-entry-${Math.random().toString(36).slice(2)}`;

    const stage = createLayer("nexus-assembly-stage");
    /* Vinheta que escurece as bordas durante a travessia: concentra o olhar
       no portal e da profundidade de camara. */
    const veil = createLayer("nexus-assembly-veil");
    /* O portal: um painel gigante da cor do void com o simbolo recortado como
       buraco. O rect se estende milhares de unidades alem do viewBox (com
       overflow visivel) para continuar cobrindo a tela em qualquer escala. */
    const portal = createLayer("nexus-portal-window", "svg");
    const flare = createLayer("nexus-assembly-flare");
    const symbol = createLayer("nexus-assembly-symbol", "svg");

    symbol.setAttribute("viewBox", "0 0 390 470");
    symbol.setAttribute("preserveAspectRatio", "xMidYMid meet");
    symbol.innerHTML = `
      <defs>
        <linearGradient id="${maskId}-upper" x1="159" y1="37" x2="341" y2="385" gradientUnits="userSpaceOnUse">
          <stop offset="0" stop-color="#0D1318" />
          <stop offset="0.5" stop-color="#0A6C91" />
          <stop offset="1" stop-color="#5AD7FF" />
        </linearGradient>
        <linearGradient id="${maskId}-lower" x1="49" y1="100" x2="230" y2="436" gradientUnits="userSpaceOnUse">
          <stop offset="0" stop-color="#5AD7FF" />
          <stop offset="0.5" stop-color="#0A6C91" />
          <stop offset="1" stop-color="#0D1318" />
        </linearGradient>
      </defs>
      <path class="nexus-symbol-piece nexus-symbol-piece--upper" fill="url(#${maskId}-upper)" d="${SYMBOL_PATHS.upper}" />
      <path class="nexus-symbol-piece nexus-symbol-piece--lower" fill="url(#${maskId}-lower)" d="${SYMBOL_PATHS.lower}" />
    `;

    portal.setAttribute("viewBox", "0 0 390 470");
    portal.setAttribute("preserveAspectRatio", "xMidYMid meet");
    portal.innerHTML = `
      <path class="nexus-portal-panel" fill-rule="evenodd"
        d="M-9805 -9765 H10195 V10235 H-9805 Z ${SYMBOL_PATHS.upper} ${SYMBOL_PATHS.lower}" />
    `;

    stage.append(veil, portal, flare, symbol);
    document.body.append(stage);
    cover.classList.add("is-nexus-assembly-cover");
    target.classList.add("nexus-assembly-target");
    follower?.classList.add("nexus-assembly-follower");

    const symbolPaths = [...symbol.querySelectorAll(".nexus-symbol-piece")];
    const upperPath = symbol.querySelector(".nexus-symbol-piece--upper");
    const lowerPath = symbol.querySelector(".nexus-symbol-piece--lower");
    const targetContent = target.querySelector(".contact-shell");
    /* Conteudo do Processo que recua em profundidade enquanto o painel do
       portal cobre a tela. :scope > : sao exatamente os blocos que o CSS ja
       eleva com z-index 2. */
    const coverInner = cover.querySelectorAll(
      ":scope > .section-label, :scope > .intro-grid, :scope > .process-track",
    );
    const viewportDistance = () => window.innerHeight;
    const assemblyCenter = () => ({
      x: window.innerWidth / 2,
      y: window.innerHeight / 2 - Math.min(48, window.innerHeight * 0.055),
    });

    /* Espelha o clamp() do CSS em vez de medir o SVG: getBoundingClientRect
       incluiria a escala corrente do mergulho e um refresh no meio do pin
       devolveria um valor errado. */
    const symbolWidth = () =>
      compact ? 148 : Math.min(250, Math.max(172, window.innerWidth * 0.19));

    /* Escala final do mergulho: a marca precisa cruzar a diagonal da tela com
       folga. O painel dissolve na reta final, entao nao ha escala "grande o
       bastante" a perseguir — o crossing e vendido pela dissolucao. */
    const zoomScale = () =>
      (Math.hypot(window.innerWidth, window.innerHeight) /
        Math.max(1, symbolWidth())) *
      1.4;

    const applyLayout = () => {
      const center = assemblyCenter();
      stage.style.setProperty("--nexus-center-x", `${center.x.toFixed(2)}px`);
      stage.style.setProperty("--nexus-center-y", `${center.y.toFixed(2)}px`);
    };

    applyLayout();

    symbolPaths.forEach((path) => {
      const length = path.getTotalLength();
      gsap.set(path, {
        strokeDasharray: length,
        strokeDashoffset: length,
        fillOpacity: 0,
      });
    });
    gsap.set([symbol, portal, flare], { xPercent: -50, yPercent: -50 });
    /* Uma escala discreta ainda vende a profundidade sem aplicar `filter`
       sobre a section inteira. Blur de tela cheia era o maior custo da volta
       do Contato em direcao a hero. */
    gsap.set(target, {
      autoAlpha: 0,
      scale: 1.035,
    });

    const timeline = gsap.timeline({
      defaults: { ease: "none" },
      scrollTrigger: {
        id: "process-nexus-symbol-entry",
        trigger: cover,
        start: "bottom bottom",
        end: () => `+=${viewportDistance()}`,
        pin: true,
        pinSpacing: false,
        /* O Lenis ja amortece o gesto. Um segundo atraso longo fazia o portal
           continuar se movendo depois de o usuario inverter a direcao. */
        scrub: compact ? 0.38 : 0.52,
        anticipatePin: 1,
        invalidateOnRefresh: true,
        refreshPriority: 10,
        onRefresh: applyLayout,
        onToggle: ({ isActive }) => {
          cover.classList.toggle("is-nexus-assembly-active", isActive);
          target.classList.toggle("is-nexus-assembly-active", isActive);
          follower?.classList.toggle("is-nexus-assembly-active", isActive);
          target.dispatchEvent(
            new CustomEvent("nexus:section-transition", {
              detail: { active: isActive },
            }),
          );
        },
        onLeave: () => {
          timeline.progress(1);
          gsap.set(target, {
            y: 0,
            scale: 1,
            autoAlpha: 1,
          });
          if (follower) gsap.set(follower, { y: 0 });
          if (targetContent) gsap.set(targetContent, { y: 0 });
          cover.classList.add("is-nexus-assembly-past");
          /* A travessia terminou de verdade (unpin para frente). E o unico
             momento honesto para ligar animacoes que devem ser VISTAS na
             chegada — como o desenho do titulo do contato. */
          target.dispatchEvent(new CustomEvent("nexus:assembly-complete"));
        },
        onEnterBack: () => cover.classList.remove("is-nexus-assembly-past"),
      },
    });

    /* A "cola" geometrica — o contra-deslocamento que mantem o contato
       parado na tela durante o pin — vive num trigger proprio com
       scrub:true, colado 1:1 no scroll. Dentro do scrub suavizado do
       cinematografico ela atrasava junto com o resto, e perto do fim (com o
       painel do portal ja dissolvido) esse atraso abria uma fresta na base
       da tela onde o Processo apagado aparecia. Geometria nao se interpola;
       so a encenacao. */
    const glue = gsap.timeline({
      defaults: { ease: "none" },
      scrollTrigger: {
        id: "process-nexus-glue",
        trigger: cover,
        start: "bottom bottom",
        end: () => `+=${viewportDistance()}`,
        scrub: true,
        invalidateOnRefresh: true,
        refreshPriority: 9,
      },
    });

    glue.fromTo(
      target,
      { y: () => -viewportDistance() },
      { y: 0, duration: 1 },
      0,
    );

    if (follower) {
      glue.fromTo(
        follower,
        { y: () => -viewportDistance() },
        { y: 0, duration: 1 },
        0,
      );
    }

    timeline
      /* Ancora a duracao total em 1: os position parameters abaixo sao
         fracoes absolutas do pin, e sem isso o ultimo tween (0.98) viraria a
         nova regua e esticaria tudo. */
      .to({}, { duration: 1 }, 0)

      /* 1. A linha responde, mas nenhum conteudo do Processo desaparece. */
      .fromTo(
        processLineFill,
        { filter: "brightness(1)" },
        {
          filter: "brightness(3.15)",
          boxShadow: "0 0 34px rgba(90, 215, 255, 0.98)",
          duration: 0.14,
          ease: "power2.out",
        },
        0.015,
      )
      .fromTo(
        processLineFill,
        {
          filter: "brightness(3.15)",
          boxShadow: "0 0 34px rgba(90, 215, 255, 0.98)",
        },
        {
          filter: "brightness(1.15)",
          boxShadow: "0 0 14px rgba(90, 215, 255, 0.64)",
          duration: 0.17,
          ease: "power2.inOut",
          immediateRender: false,
        },
        0.15,
      )

      /* 2. As duas pecas entram de lados opostos e formam a marca. Com
         power4.out o grosso da viagem acontece cedo e o encaixe final e um
         pouso suave, nao um freio seco. */
      .fromTo(
        symbol,
        { autoAlpha: 0, scale: 0.62 },
        { autoAlpha: 1, scale: 1, duration: 0.2, ease: "power3.out" },
        0.06,
      )
      .fromTo(
        upperPath,
        {
          x: compact ? 78 : 150,
          y: compact ? -50 : -96,
          rotation: 26,
          scale: 1.12,
        },
        {
          x: 0,
          y: 0,
          rotation: 0,
          scale: 1,
          strokeDashoffset: 0,
          duration: 0.3,
          ease: "power4.out",
        },
        0.08,
      )
      .fromTo(
        lowerPath,
        {
          x: compact ? -78 : -150,
          y: compact ? 50 : 96,
          rotation: -26,
          scale: 1.12,
        },
        {
          x: 0,
          y: 0,
          rotation: 0,
          scale: 1,
          strokeDashoffset: 0,
          duration: 0.3,
          ease: "power4.out",
        },
        0.105,
      )
      .fromTo(
        symbolPaths,
        { fillOpacity: 0 },
        {
          fillOpacity: 1,
          duration: 0.14,
          stagger: 0.02,
          ease: "power2.out",
          immediateRender: false,
        },
        0.3,
      )
      .fromTo(
        flare,
        { autoAlpha: 0, scale: 0.1 },
        { autoAlpha: 1, scale: 1, duration: 0.12, ease: "power3.out" },
        0.36,
      )

      /* 3. O painel do portal cobre a cena (void sobre void: o Processo
         escurece sem corte) enquanto o conteudo dele recua em profundidade.
         A marca preenchida fica por cima dos proprios recortes, entao nada
         muda dentro dela ainda. */
      .fromTo(
        veil,
        { autoAlpha: 0 },
        { autoAlpha: 1, duration: 0.12, ease: "power1.inOut" },
        0.45,
      )
      .fromTo(
        portal,
        { autoAlpha: 0 },
        { autoAlpha: 1, duration: 0.09, ease: "power1.inOut" },
        0.47,
      )
      .fromTo(
        coverInner,
        { y: 0, opacity: 1 },
        {
          y: -34,
          opacity: 0.32,
          duration: 0.28,
          ease: "power1.inOut",
          immediateRender: false,
        },
        0.46,
      )

      /* 4. A JANELA acende: com o painel ja opaco, o contato entra por
         baixo e o preenchimento da marca se apaga. O campo de energia
         aparece DENTRO do recorte, emoldurado pelo contorno branco. */
      .set(target, { autoAlpha: 1 }, 0.56)
      .fromTo(
        symbolPaths,
        { fillOpacity: 1 },
        {
          fillOpacity: 0,
          duration: 0.09,
          stagger: 0.02,
          ease: "power2.inOut",
          immediateRender: false,
        },
        0.57,
      )
      .fromTo(
        flare,
        { scale: 1 },
        { scale: 1.22, duration: 0.1, ease: "power2.out", immediateRender: false },
        0.57,
      )

      /* 5. O MERGULHO: painel e contorno escalam juntos (power2.in — a
         camara acelera portal adentro) enquanto a cena la dentro ganha foco
         em power2.out. Na reta final o contorno some, o flare estoura e o
         painel dissolve: e a travessia. */
      .fromTo(
        portal,
        { scale: 1 },
        {
          scale: () => zoomScale(),
          duration: 0.38,
          ease: "power2.in",
          immediateRender: false,
        },
        0.6,
      )
      .fromTo(
        symbol,
        { scale: 1 },
        {
          scale: () => zoomScale(),
          duration: 0.38,
          ease: "power2.in",
          immediateRender: false,
        },
        0.6,
      )
      .fromTo(
        target,
        { scale: 1.035 },
        {
          scale: 1,
          duration: 0.34,
          ease: "power2.out",
          immediateRender: false,
        },
        0.6,
      )
      .fromTo(
        flare,
        { scale: 1.22, opacity: 1 },
        {
          scale: compact ? 2.4 : 3.4,
          opacity: 0,
          duration: 0.2,
          ease: "power2.out",
          immediateRender: false,
        },
        0.74,
      )
      .fromTo(
        symbol,
        { autoAlpha: 1 },
        { autoAlpha: 0, duration: 0.12, ease: "power1.out", immediateRender: false },
        0.76,
      )
      .fromTo(
        veil,
        { autoAlpha: 1 },
        { autoAlpha: 0, duration: 0.2, ease: "power1.inOut", immediateRender: false },
        0.78,
      )
      .fromTo(
        portal,
        { autoAlpha: 1 },
        { autoAlpha: 0, duration: 0.16, ease: "power2.out", immediateRender: false },
        0.8,
      )
      .call(
        () => {
          if ((timeline.scrollTrigger?.direction ?? 1) < 0) return;
          target.dispatchEvent(new CustomEvent("nexus:brand-portal-burst"));
        },
        null,
        0.74,
      );

    if (targetContent) {
      /* Paralaxe interna: o conteudo sobe mais devagar que a travessia,
         entao a cena tem duas camadas de movimento (portal e miolo) em vez
         de simplesmente aparecer pronta. */
      timeline.fromTo(
        targetContent,
        { y: compact ? 46 : 84 },
        {
          y: 0,
          duration: 0.36,
          ease: "power2.out",
          immediateRender: false,
        },
        0.62,
      );
    }

    return () => {
      target.dispatchEvent(
        new CustomEvent("nexus:section-transition", {
          detail: { active: false },
        }),
      );
      timeline.scrollTrigger?.kill();
      timeline.kill();
      glue.scrollTrigger?.kill();
      glue.kill();

      gsap.set(processLineFill, {
        clearProps: "transform,opacity,filter,box-shadow",
      });
      gsap.set(target, {
        clearProps: "transform,opacity,visibility,filter",
      });
      if (follower) gsap.set(follower, { clearProps: "transform" });
      if (coverInner.length) {
        gsap.set(coverInner, { clearProps: "transform,opacity" });
      }
      if (targetContent) {
        gsap.set(targetContent, { clearProps: "transform" });
      }

      stage.remove();
      cover.classList.remove(
        "is-nexus-assembly-cover",
        "is-nexus-assembly-active",
        "is-nexus-assembly-past",
      );
      target.classList.remove(
        "nexus-assembly-target",
        "is-nexus-assembly-active",
      );
      follower?.classList.remove(
        "nexus-assembly-follower",
        "is-nexus-assembly-active",
      );
    };
  });

  return {
    dispose() {
      mm.revert();
    },
  };
}
