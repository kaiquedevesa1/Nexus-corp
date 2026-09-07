import "./style.css";
import "./portfolioShowcase.css";
import { inject } from "@vercel/analytics";
import * as THREE from "three";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";
import { createInteractiveFiberCloud } from "./createInteractiveFiberCloud.js";
import { createShaderBackground } from "./createShaderBackground.js";
import { createCursorGrid } from "./createCursorGrid.js";
import { createNavbar } from "./createNavbar.js";
import { createPreloader } from "./createPreloader.js";
import { createPerformanceProfile } from "./performanceProfile.js";
import { textFade, prefersReducedMotion } from "./textFade.js";

inject();

gsap.registerPlugin(ScrollTrigger);

/* Um mesmo visual, com custos diferentes. O perfil usa memoria, nucleos,
   economia de dados, DPR e tipo de tela; nenhum efeito desaparece, apenas
   muda a resolucao interna, densidade e frequencia de atualizacao. */
const performanceProfile = createPerformanceProfile();
document.documentElement.dataset.performance = performanceProfile.tier;

/* Barra de URL do celular: mostrar/esconder dispara um resize a cada mudanca
   de direcao do scroll. Sem esta config, o ScrollTrigger faria refresh NO MEIO
   dos pins (transicao Nexus, reveal de cards) e re-capturaria estados
   intermediarios das animacoes como se fossem o estado de repouso. So mudanca
   de largura/orientacao justifica um refresh de verdade. */
ScrollTrigger.config({ ignoreMobileResize: true });

/* Criado antes de tudo: a partir daqui qualquer etapa pesada de montagem pode
   reportar progresso. A tela em si ja esta pintada pelo index.html. */
const preloader = createPreloader();

/* Rede de seguranca, registrada antes de qualquer montagem: se algo estourar no
   caminho (WebGL indisponivel, asset que nunca responde), o site nao pode ficar
   preso atras do preloader. */
setTimeout(() => preloader.finish().then(() => intro.play()), 8000);

const lenis = new Lenis({
  /* Curto o bastante para responder imediatamente a mudanca de direcao, mas
     ainda amortece a roda do mouse e o trackpad. As transicoes de scroll nao
     devem adicionar uma segunda interpolacao longa por cima desta. */
  duration: 0.68,
  smoothWheel: true,
  wheelMultiplier: 0.96,
  touchMultiplier: 1,
  syncTouch: false,
  /* Sem isto, o Lenis bloqueia links de ancora enquanto ainda existe inercia.
     Era o que fazia o clique na logo para voltar a hero parecer travado. */
  anchors: {
    duration: 0.95,
    easing: (value) => 1 - Math.pow(1 - value, 4),
  },
  stopInertiaOnNavigate: true,
  prevent: (node) =>
    node?.id === "webgl" || node?.hasAttribute?.("data-lenis-prevent"),
});

let normalizedScroll = 0;
let heroNearViewport = true;
let heroCoveredByCapabilities = false;
const heroGraphicsRoot = document.querySelector(".hero");
const heroGraphicsAreActive = () =>
  heroNearViewport && !heroCoveredByCapabilities;
const syncHeroGraphicsActivity = () => {
  const active = heroGraphicsAreActive();
  heroGraphicsRoot?.classList.toggle("is-graphics-paused", !active);
  return active;
};
const onLenisScroll = ({ progress = 0 }) => {
  normalizedScroll = progress;
  ScrollTrigger.update();
};
const tickLenis = (time) => lenis.raf(time * 1000);
lenis.on("scroll", onLenisScroll);
gsap.ticker.add(tickLenis);
/* Recomendacao da integracao Lenis + GSAP: nao deixe o ticker acrescentar
   atraso proprio depois de um frame longo. O Lenis ja faz o amortecimento. */
gsap.ticker.lagSmoothing(0);

/**
 * Quebra o texto em <span class="char">, agrupados por <span class="word">,
 * preservando a marcacao interna.
 *
 * Percorre os nos em vez de reescrever o innerHTML inteiro, senao elementos
 * de estilo dentro do titulo (ex.: <em>) sao destruidos.
 */
function splitText(element) {
  element.innerHTML = element.innerHTML.trim();

  const walk = (node) => {
    [...node.childNodes].forEach((child) => {
      if (child.nodeType === Node.TEXT_NODE) {
        const text = child.textContent.replace(/\s+/g, " ");
        if (!text) {
          child.remove();
          return;
        }
        const fragment = document.createDocumentFragment();

        /* Os caracteres PRECISAM ser agrupados por palavra.
           Cada .char e um inline-block, e o navegador abre ponto de quebra
           entre inline-blocks adjacentes — sem o agrupamento ele parte a
           palavra no meio ("do c / onceito").
           Os espacos voltam como nos de texto puro, fora de qualquer
           inline-block: e ali, e so ali, que a linha pode quebrar. */
        text.split(/(\s+)/).forEach((token) => {
          if (!token) return;

          if (/^\s+$/.test(token)) {
            fragment.appendChild(document.createTextNode(" "));
            return;
          }

          const word = document.createElement("span");
          word.className = "word";

          token.split("").forEach((char) => {
            const span = document.createElement("span");
            span.className = "char";
            span.textContent = char;
            word.appendChild(span);
          });

          fragment.appendChild(word);
        });

        child.replaceWith(fragment);
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        walk(child);
      }
    });
  };

  walk(element);
  return element.querySelectorAll(".char");
}

document.querySelectorAll(".split").forEach((el) => splitText(el));

let contactStrokeText;
let contactAssemblyComplete = false;

const navbarController = createNavbar(document.querySelector(".nav"));

/* A hero e `position: sticky` dentro do empilhamento com Servicos. Quando a
   pagina esta no rodape, getBoundingClientRect() devolve a posicao visual do
   sticky em vez do inicio real do documento; o calculo generico de ancora do
   Lenis parava cerca de uma tela abaixo do topo. Para este unico destino, a
   coordenada correta e sempre zero. */
const heroAnchorLinks = document.querySelectorAll('a[href="#hero"]');
const onHeroAnchorClick = (event) => {
  if (
    event.defaultPrevented ||
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  ) {
    return;
  }

  event.preventDefault();
  /* Impede apenas o handler generico de anchors do Lenis, registrado em
     window. Os handlers do proprio link (como fechar o menu) ja rodaram. */
  event.stopPropagation();
  history.pushState(null, "", "#hero");
  lenis.scrollTo(0, {
    duration: matchMedia("(prefers-reduced-motion: reduce)").matches
      ? 0
      : 1.1,
    easing: (value) => 1 - Math.pow(1 - value, 4),
    immediate: matchMedia("(prefers-reduced-motion: reduce)").matches,
  });
};
heroAnchorLinks.forEach((link) =>
  link.addEventListener("click", onHeroAnchorClick),
);

gsap.set(".hero-title .char", { yPercent: 120, opacity: 0, rotateX: -70 });
gsap.set(".hero .reveal-text", { y: 28, opacity: 0 });
gsap.set(".nav", { y: -20, opacity: 0 });
gsap.set(".drag-hint", { opacity: 0, x: 20 });

/* Pausada: quem da o play e a saida do preloader, senao a intro da hero corre
   escondida atras da tela de carregamento. */
const intro = gsap.timeline({
  paused: true,
  defaults: { ease: "power4.out" },
});
intro
  .to(".nav", { y: 0, opacity: 1, duration: 1 })
  .to(
    ".hero-title .char",
    {
      yPercent: 0,
      opacity: 1,
      rotateX: 0,
      duration: 1.15,
      stagger: 0.018,
    },
    "-=.55",
  )
  .to(
    ".hero .reveal-text",
    {
      y: 0,
      opacity: 1,
      duration: 0.85,
      stagger: 0.12,
    },
    "-=.75",
  )
  .to(".drag-hint", { opacity: 1, x: 0, duration: 0.7 }, "-=.4");

/* Hero -> Capacidades: a hero permanece sticky no plano de fundo enquanto um
   painel unico, formado pela faixa de metricas + Capacidades, sobe por cima
   dela. Quando o painel alcança o topo, a pagina volta ao fluxo normal. */
gsap.matchMedia().add(
  "(min-width: 701px) and (prefers-reduced-motion: no-preference)",
  () => {
    const hero = document.querySelector(".hero");
    const heroContent = hero?.querySelector(".hero-content");
    const heroCanvas = hero?.querySelector("#webgl");
    const heroCues = hero?.querySelectorAll(".scroll-cue, .drag-hint");
    const metrics = document.querySelector(".metrics-bar");
    const capabilities = document.querySelector(".service-intro");
    const ambient = capabilities?.querySelector(".services-ambient");
    if (!hero || !metrics || !capabilities) return;

    /* O stack limita fisicamente o sticky da hero. O painel agrupa tudo que
       deve entrar por cima dela e preserva a ordem original no fluxo. */
    const stack = document.createElement("div");
    const panel = document.createElement("div");
    stack.className = "hero-capabilities-stack";
    panel.className = "capabilities-transition-panel";
    hero.before(stack);
    stack.append(hero, panel);
    panel.append(metrics, capabilities);

    document.documentElement.classList.add("has-capabilities-transition");

    const timeline = gsap.timeline({
      defaults: { ease: "none" },
      scrollTrigger: {
        id: "hero-capabilities-transition",
        trigger: panel,
        start: "top bottom",
        end: "top top",
        scrub: 0.34,
        invalidateOnRefresh: true,
        onToggle: ({ isActive }) =>
          stack.classList.toggle("is-transitioning", isActive),
        onUpdate: ({ progress }) => {
          /* O sticky continua geometricamente visivel sob o painel. A flag
             desliga o WebGL quando Capacidades ja cobriu a maior parte dele. */
          const covered = progress > 0.62;
          if (covered === heroCoveredByCapabilities) return;
          heroCoveredByCapabilities = covered;
          syncHeroGraphicsActivity();
        },
      },
    });

    timeline
      .to(
        hero,
        {
          scale: 0.95,
          y: -28,
          duration: 1,
        },
        0,
      )
      .to(
        heroContent,
        { y: -38, opacity: 0.18, duration: 0.72 },
        0,
      )
      .fromTo(
        panel,
        {
          borderRadius: "48px 48px 0 0",
        },
        {
          borderRadius: "0px",
          duration: 1,
          immediateRender: false,
        },
        0,
      );

    if (heroCanvas) {
      timeline.to(heroCanvas, { opacity: 0.34, duration: 0.78 }, 0.08);
    }

    if (heroCues?.length) {
      timeline.to(heroCues, { y: -14, opacity: 0, duration: 0.34 }, 0);
    }

    if (ambient) {
      timeline.fromTo(
        ambient,
        { opacity: 0.48 },
        { opacity: 1, duration: 0.82, immediateRender: false },
        0.12,
      );
    }

    return () => {
      timeline.scrollTrigger?.kill();
      timeline.kill();
      heroCoveredByCapabilities = false;
      syncHeroGraphicsActivity();
      stack.classList.remove("is-transitioning");
      document.documentElement.classList.remove("has-capabilities-transition");
      gsap.set(
        [
          hero,
          heroContent,
          heroCanvas,
          ...heroCues,
          panel,
          ambient,
        ].filter(Boolean),
        { clearProps: "all" },
      );
      stack.before(hero, metrics, capabilities);
      panel.remove();
      stack.remove();
    };
  },
);

/* Os reveals de texto da pagina inteira passam por textFade — ver src/textFade.js
   para o porque de `scrub` (e nao `toggleActions`) ser o que torna a subida
   identica a descida. */
document
  .querySelectorAll(".section-title")
  .forEach((title) => {
    /* O stagger por caractere faz o titulo subir e acender da esquerda para a
       direita conforme o scroll avanca, em vez de clarear em bloco.
       yPercent (e nao y) porque o corpo do titulo varia por clamp. 45% e
       deliberadamente menos de meia linha: `.word` nao tem overflow hidden,
       entao um deslocamento grande faria os caracteres invadirem a linha de
       baixo em vez de surgirem por tras dela. */
    textFade(title.querySelectorAll(".char"), {
      trigger: title,
      start: "top 92%",
      end: "top 48%",
      yPercent: 45,
      stagger: 0.012,
      duration: 0.9,
    });
  });

document.querySelectorAll(".section-label").forEach((label) => {
  if (label.closest(".hero")) return;
  textFade(label, { start: "top 96%", end: "top 74%" });
});

document.querySelectorAll(".section .reveal-text").forEach((el) => {
  /* hero: entra pela timeline de abertura, que e temporal de proposito — a
     abertura do site nao deve depender de o usuario rolar. */
  if (el.closest(".hero")) return;
  textFade(el, { start: "top 95%", end: "top 62%" });
});

/* ===========================================================================
   CARDS DE PLANOS — entrada em fileira

   Mesma gramatica das capacidades: a fileira fica escondida ate cruzar o meio
   da tela e entao ENTRA, com tempo proprio. Duas secoes vizinhas usando o
   mesmo verbo fazem a pagina parecer escrita por uma mao so; se planos usasse
   scrub e capacidades usasse timeline, a diferenca leria como inconsistencia,
   nao como variedade.

   A MARE e a excecao, e continua em scrub logo abaixo: ela nao e uma entrada,
   e um nivel. Amarrar o nivel do liquido a posicao do scroll e justamente o
   que faz a fileira ler como um grafico de escopo.

   A CAIXA do card nao recebe transform depois da entrada: um transform inline
   sobrando nela venceria `.plan-card:hover` e mataria o lift. Por isso a
   entrada usa `clearProps` no final — ela termina e devolve o controle ao CSS.
   ========================================================================= */
const planCards = gsap.utils.toArray(".plan-card");
const planRow = document.querySelector(".plan-cards");

/* textFade se protege sozinho, mas os fromTo crus abaixo (regua, mare)
   precisam desta guarda: sem ela ficariam presos no estado inicial para quem
   pede menos movimento. */
const planMotion = !prefersReducedMotion();

if (planRow && planCards.length) {
  if (!planMotion) {
    planRow.classList.add("is-revealed");
  } else {
    planRow.classList.add("is-armed");

    const entrada = gsap.timeline({
      paused: true,
      onStart: () => planRow.classList.add("is-revealed"),
    });

    planCards.forEach((card, index) => {
      const rule = card.querySelector(".plan-rule");
      const name = card.querySelector(".plan-name span");
      const body = card.querySelectorAll(
        ".plan-index, .plan-icon, .plan-headline, .plan-ideal, .plan-includes, .plan-list li, .plan-note, .plan-cta",
      );

      const at = index * 0.13;

      entrada
        .fromTo(
          card,
          { y: 52 },
          {
            y: 0,
            duration: 1.05,
            ease: "power3.out",
            force3D: true,
            /* Devolve o transform ao CSS: sem isto o hover perderia o lift. */
            clearProps: "transform",
          },
          at,
        )
        .fromTo(
          rule,
          { scaleX: 0 },
          { scaleX: 1, duration: 0.9, ease: "power2.out" },
          at,
        )
        /* O nome emerge da mascara (.plan-name tem overflow hidden). */
        .fromTo(
          name,
          { yPercent: 108 },
          { yPercent: 0, duration: 0.95, ease: "power3.out" },
          at + 0.1,
        )
        .fromTo(
          body,
          { y: 16, opacity: 0 },
          {
            y: 0,
            opacity: 1,
            duration: 0.7,
            /* 0.04 e curto: sao ate treze elementos por card e um stagger
               maior faria o CTA chegar muito depois do resto. */
            stagger: 0.04,
            ease: "power2.out",
            force3D: true,
          },
          at + 0.16,
        );
    });

    ScrollTrigger.create({
      trigger: planRow,
      start: "top 62%",
      once: true,
      onEnter: () => entrada.play(),
    });
  }
}

/* A MARE SOBE — o gesto que costura a fileira inteira.
   Um unico tween para os quatro cards, com stagger: o liquido entra da
   esquerda para a direita como uma onda so, em vez de quatro animacoes
   identicas disparando lado a lado.

   O alvo e `.plan-tide__body`, e nao `.plan-tide`: o transform da externa
   pertence ao CSS (nivel de repouso e hover), entao as duas animacoes nao
   disputam a mesma propriedade.

   yPercent, e nao height: animar height repintaria a cada evento de scroll, e
   com scrub sao muitos. Deslocar 100% da propria altura joga o bloco para
   fora da borda de baixo (o card e overflow hidden) e o compositor resolve. */
if (planMotion && planCards.length) {
  const tides = gsap.utils.toArray(".plan-tide__body");
  gsap.fromTo(
    tides,
    { yPercent: 100 },
    {
      yPercent: 0,
      ease: "none",
      stagger: 0.12,
      immediateRender: false,
      scrollTrigger: {
        trigger: ".plan-cards",
        start: "top 88%",
        end: "top 42%",
        scrub: 0.62,
        invalidateOnRefresh: true,
      },
    },
  );
}

/* A MARE ALTA EM TOUCH — o hover traduzido para a rolagem.
   Em touch nao existe hover, entao o premio de passar o mouse (a mare subindo
   mais 9%) passa a ser conduzido pelo scroll: o card que esta no centro da
   tela sobe e volta ao repouso quando sai, um de cada vez.

   A faixa e medida pelo CENTRO do card, e nao pelo topo, e essa e a decisao
   que faz o efeito ser sequencial: os centros de dois cards vizinhos ficam
   mais distantes entre si (altura do card + gap) do que a largura da faixa
   ativa (64% da viewport), entao nunca ha dois cards altos ao mesmo tempo.

   gsap.matchMedia porque a consulta pode deixar de valer em runtime (um
   tablet que ganha mouse, o devtools alternando o modo): ao sair, o contexto
   mata os triggers e o cleanup devolve os cards ao repouso. */
if (planCards.length) {
  gsap
    .matchMedia()
    .add("(hover: none) and (prefers-reduced-motion: no-preference)", () => {
      planCards.forEach((card) =>
        ScrollTrigger.create({
          trigger: card,
          start: "center 82%",
          end: "center 18%",
          onToggle: ({ isActive }) =>
            card.classList.toggle("is-tide-high", isActive),
        }),
      );

      return () =>
        planCards.forEach((card) => card.classList.remove("is-tide-high"));
    });
}

/* Glow do cursor sobre o card. So em ponteiro fino: em touch nao ha hover e o
   dedo cobriria justamente a area iluminada. As coordenadas viram custom
   properties e quem desenha e o CSS (.plan-glow), entao o JS nao toca em
   layout nem em pintura — so escreve duas variaveis. */
if (
  planCards.length &&
  matchMedia("(hover: hover) and (pointer: fine)").matches
) {
  planCards.forEach((card) => {
    let bounds;
    let frame = 0;
    let pointerX = 0;
    let pointerY = 0;

    card.addEventListener(
      "pointerenter",
      () => {
        bounds = card.getBoundingClientRect();
      },
      { passive: true },
    );

    card.addEventListener(
      "pointermove",
      (event) => {
        pointerX = event.clientX;
        pointerY = event.clientY;
        /* Uma escrita por frame no maximo: pointermove dispara muito mais
           rapido que o refresh da tela. */
        if (frame) return;
        frame = requestAnimationFrame(() => {
          frame = 0;
          const box = bounds ?? card.getBoundingClientRect();
          card.style.setProperty("--mx", `${pointerX - box.left}px`);
          card.style.setProperty("--my", `${pointerY - box.top}px`);
        });
      },
      { passive: true },
    );

    card.addEventListener("pointerleave", () => {
      cancelAnimationFrame(frame);
      frame = 0;
      bounds = null;
    });
  });
}

/* A aurora do fundo cresce conforme a section sobe: da profundidade ao bloco
   inteiro sem competir com a entrada dos cards, porque e scrub (segue o
   scroll) e nao um gesto com tempo proprio. */
const plansSection = document.querySelector(".plans");

/* As oito ondas (duas por card) sao loops CSS infinitos. Fora da viewport elas
   nao param sozinhas, e esta pagina ja sustenta tres contextos WebGL — entao a
   secao liga e desliga o conjunto pela classe, no mesmo padrao do ambiente da
   secao de servicos. Quem pede menos movimento nunca as ve rodando: o CSS ja
   zera a animation em prefers-reduced-motion. */
if (plansSection && planCards.length) {
  ScrollTrigger.create({
    trigger: plansSection,
    start: "top bottom",
    end: "bottom top",
    onToggle: ({ isActive }) =>
      plansSection.classList.toggle("is-graphics-active", isActive),
  });
}

if (plansSection && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
  gsap.fromTo(
    plansSection.querySelector(".plans-aurora"),
    { scale: 0.7, opacity: 0.2 },
    {
      scale: 1,
      opacity: 1,
      ease: "none",
      scrollTrigger: {
        trigger: plansSection,
        start: "top bottom",
        end: "top 34%",
        scrub: 0.62,
      },
    },
  );
}

/* ===========================================================================
   CAPACIDADES — selos que evaporam e liberam o conteudo pelo scroll

   O proprio desenho de cada servico vira a capa do card. No desktop as tres
   capas se desfazem em sequencia dentro de uma unica timeline; no layout de
   uma coluna cada card recebe seu proprio trecho de scroll. A camada nasce no
   JS: se o bundle falhar, o HTML permanece visivel e utilizavel.
   ========================================================================= */
const capsRow = document.querySelector(".caps");
const caps = gsap.utils.toArray(".cap");
const serviceSection = document.querySelector(".service-intro");
const ambientScene = document.querySelector(".services-ambient__scene");

if (capsRow && caps.length) {
  if (prefersReducedMotion()) {
    capsRow.classList.add("is-revealed");
  } else {
    capsRow.classList.add("has-scroll-reveal");

    const capReveals = caps.map((cap, cardIndex) => {
      const layer = document.createElement("div");
      const stage = document.createElement("div");
      const halo = document.createElement("span");
      const symbol = document.createElement("span");
      const particles = document.createElement("span");
      const code = document.createElement("span");
      const hint = document.createElement("span");
      const sourceIcon = cap.querySelector(".cap__icon svg");

      layer.className = "cap-reveal";
      stage.className = "cap-reveal__stage";
      halo.className = "cap-reveal__halo";
      symbol.className = "cap-reveal__symbol";
      particles.className = "cap-reveal__particles";
      code.className = "cap-reveal__code";
      hint.className = "cap-reveal__hint";
      layer.setAttribute("aria-hidden", "true");
      code.textContent = `NEXUS / 0${cardIndex + 1}`;
      hint.textContent = "ROLE PARA REVELAR";

      if (sourceIcon) {
        const symbolSvg = sourceIcon.cloneNode(true);
        symbolSvg.setAttribute("focusable", "false");
        symbol.append(symbolSvg);
      }

      /* O angulo aureo distribui os fragmentos sem formar uma grade. */
      for (let particleIndex = 0; particleIndex < 34; particleIndex += 1) {
        const particle = document.createElement("i");
        const angle = particleIndex * 2.399963;
        const ring = 38 + (particleIndex % 7) * 8;
        const horizontal = Math.cos(angle) * ring;
        const vertical =
          -48 -
          Math.abs(Math.sin(angle) * ring) -
          (particleIndex % 4) * 8;

        particle.className = "cap-reveal__particle";
        particle.style.setProperty(
          "--particle-size",
          `${2 + (particleIndex % 3)}px`,
        );
        particle.dataset.evapX = horizontal.toFixed(2);
        particle.dataset.evapY = vertical.toFixed(2);
        particle.dataset.evapRotation = `${
          (particleIndex % 2 ? -1 : 1) * (35 + particleIndex * 9)
        }`;
        particles.append(particle);
      }

      stage.append(halo, symbol, particles, code, hint);
      layer.append(stage);
      cap.append(layer);

      return {
        cap,
        layer,
        halo,
        symbol,
        particles: particles.querySelectorAll(".cap-reveal__particle"),
        code,
        hint,
      };
    });

    const setContentAvailable = (entry, isAvailable) => {
      const cta = entry.cap.querySelector(".cap__cta");
      entry.cap.classList.toggle("is-content-visible", isAvailable);

      if (!cta) return;
      if (isAvailable) {
        if (cta.dataset.originalTabindex) {
          cta.setAttribute("tabindex", cta.dataset.originalTabindex);
        } else {
          cta.removeAttribute("tabindex");
        }
      } else {
        if (cta.hasAttribute("tabindex") && !cta.dataset.originalTabindex) {
          cta.dataset.originalTabindex = cta.getAttribute("tabindex");
        }
        cta.setAttribute("tabindex", "-1");
      }
    };

    /* Esta classe nao e persistida em storage: dura apenas durante a pagina
       atual. Portanto o efeito nao volta ao subir o scroll nem ao trocar o
       breakpoint; um reload cria a experiencia novamente. */
    const markCapRevealComplete = (entry) => {
      entry.cap.classList.add("is-reveal-complete");
      setContentAvailable(entry, true);
    };

    const createCapRevealTimeline = (entry) => {
      const { cap, layer, halo, symbol, particles, code, hint } = entry;
      const rule = cap.querySelector(".cap__rule");
      const index = cap.querySelector(".cap__index");
      const icon = cap.querySelector(".cap__icon");
      const title = cap.querySelector(".cap__title span");
      const body = cap.querySelectorAll(
        ".cap__text, .cap__ideal-label, .cap__ideal p, .cap__cta",
      );
      const symbolParts = symbol.querySelectorAll(
        "path, circle, rect, line, polyline, polygon, ellipse",
      );

      symbolParts.forEach((part, partIndex) => {
        let length = 48 + partIndex * 6;
        try {
          length = Math.max(part.getTotalLength(), 12);
        } catch {
          /* Formas sem comprimento mensuravel usam o valor de reserva. */
        }
        part.dataset.strokeLength = length.toFixed(2);
        gsap.set(part, {
          strokeDasharray: length,
          strokeDashoffset: 0,
          transformOrigin: "50% 50%",
        });
      });

      gsap.set(layer, { autoAlpha: 1 });
      gsap.set(halo, { scale: 0.72, opacity: 0.35 });
      gsap.set(symbol, {
        scale: 0.94,
        rotation: -2,
        transformOrigin: "50% 50%",
      });
      gsap.set(particles, { autoAlpha: 0, scale: 0, x: 0, y: 0 });
      gsap.set(rule, { scaleX: 0 });
      gsap.set(index, { autoAlpha: 0, y: 12 });
      gsap.set(icon, { autoAlpha: 0, y: 18, scale: 0.78 });
      gsap.set(title, { autoAlpha: 1, yPercent: 112 });
      gsap.set(body, { autoAlpha: 0, y: 22 });
      setContentAvailable(entry, false);

      return gsap
        .timeline({ defaults: { ease: "none" } })
        .to(halo, { scale: 1, opacity: 0.72, duration: 0.18 }, 0)
        .to(symbol, { scale: 1.08, rotation: 2, duration: 0.18 }, 0)
        .to(
          symbolParts,
          {
            strokeDashoffset: (_, part) => -Number(part.dataset.strokeLength),
            x: (partIndex) => (partIndex % 2 ? 7 : -7),
            y: (partIndex) => -12 - (partIndex % 4) * 5,
            rotation: (partIndex) => (partIndex % 2 ? 8 : -8),
            opacity: 0,
            duration: 0.34,
            stagger: { amount: 0.1, from: "end" },
          },
          0.17,
        )
        .fromTo(
          particles,
          { autoAlpha: 0, scale: 0, x: 0, y: 0 },
          {
            autoAlpha: 0.9,
            scale: 1,
            x: (_, particle) => Number(particle.dataset.evapX) * 0.48,
            y: (_, particle) => Number(particle.dataset.evapY) * 0.42,
            rotation: (_, particle) =>
              Number(particle.dataset.evapRotation) * 0.35,
            duration: 0.16,
            stagger: { amount: 0.09, from: "random" },
          },
          0.18,
        )
        .to(
          particles,
          {
            x: (_, particle) => Number(particle.dataset.evapX),
            y: (_, particle) => Number(particle.dataset.evapY),
            rotation: (_, particle) =>
              Number(particle.dataset.evapRotation),
            autoAlpha: 0,
            scale: 0.2,
            duration: 0.28,
            stagger: { amount: 0.08, from: "random" },
          },
          0.32,
        )
        .to([code, hint], { autoAlpha: 0, y: -12, duration: 0.2 }, 0.26)
        .to(halo, { scale: 1.36, opacity: 0, duration: 0.28 }, 0.3)
        .to(layer, { autoAlpha: 0, duration: 0.2 }, 0.46)
        .to(rule, { scaleX: 1, duration: 0.27 }, 0.43)
        .to(index, { autoAlpha: 1, y: 0, duration: 0.23 }, 0.48)
        .to(icon, { autoAlpha: 1, y: 0, scale: 1, duration: 0.28 }, 0.5)
        .to(title, { yPercent: 0, duration: 0.31 }, 0.51)
        .to(
          body,
          {
            autoAlpha: 1,
            y: 0,
            duration: 0.3,
            stagger: 0.045,
          },
          0.56,
        );
    };

    const media = gsap.matchMedia();

    media.add("(min-width: 860px)", () => {
      const pendingReveals = capReveals.filter(
        (entry) => !entry.cap.classList.contains("is-reveal-complete"),
      );
      const cardTimelines = [];
      const master = gsap.timeline({
        paused: true,
        onUpdate: () => {
          cardTimelines.forEach(({ entry, timeline }) => {
            if (timeline.progress() >= 0.999) markCapRevealComplete(entry);
            else setContentAvailable(entry, timeline.progress() >= 0.64);
          });
        },
      });

      pendingReveals.forEach((entry, cardIndex) => {
        const timeline = createCapRevealTimeline(entry);
        cardTimelines.push({ entry, timeline });
        master.add(timeline, cardIndex * 0.2);
      });

      if (pendingReveals.length) {
        ScrollTrigger.create({
          trigger: capsRow,
          /* O scroll apenas dispara. A timeline tem tempo proprio, termina
             sozinha e nunca e rebobinada ao subir a pagina. */
          start: "bottom 92%",
          once: true,
          invalidateOnRefresh: true,
          onEnter: () => master.play(),
        });
      }

      return () => {
        capReveals.forEach((entry) =>
          setContentAvailable(
            entry,
            entry.cap.classList.contains("is-reveal-complete"),
          ),
        );
      };
    });

    media.add("(max-width: 859px)", () => {
      const pendingReveals = capReveals.filter(
        (entry) => !entry.cap.classList.contains("is-reveal-complete"),
      );
      const timelines = pendingReveals.map((entry) => {
        const timeline = createCapRevealTimeline(entry).pause(0);

        timeline.eventCallback("onUpdate", () => {
          if (timeline.progress() >= 0.999) markCapRevealComplete(entry);
          else setContentAvailable(entry, timeline.progress() >= 0.64);
        });

        ScrollTrigger.create({
          trigger: entry.cap,
          /* Cada card toca uma unica vez quando entra inteiro em quadro. */
          start: "bottom 92%",
          once: true,
          invalidateOnRefresh: true,
          onEnter: () => timeline.play(),
        });

        return { entry, timeline };
      });

      return () => {
        timelines.forEach(({ entry }) =>
          setContentAvailable(
            entry,
            entry.cap.classList.contains("is-reveal-complete"),
          ),
        );
      };
    });
  }

  /* Luz do cursor sobre a coluna. So em ponteiro fino: em touch nao ha hover
     e o dedo cobriria justamente a area iluminada. As coordenadas viram
     custom properties e quem desenha e o CSS (.cap:before), entao o JS nao
     toca em layout nem em pintura — so escreve duas variaveis. */
  if (matchMedia("(hover: hover) and (pointer: fine)").matches) {
    caps.forEach((cap) => {
      let bounds;
      let frame = 0;
      let pointerX = 0;
      let pointerY = 0;

      cap.addEventListener(
        "pointerenter",
        () => {
          bounds = cap.getBoundingClientRect();
        },
        { passive: true },
      );

      cap.addEventListener(
        "pointermove",
        (event) => {
          pointerX = event.clientX;
          pointerY = event.clientY;
          /* Uma escrita por frame no maximo: pointermove dispara muito mais
             rapido que o refresh da tela. */
          if (frame) return;
          frame = requestAnimationFrame(() => {
            frame = 0;
            const box = bounds ?? cap.getBoundingClientRect();
            cap.style.setProperty("--mx", `${pointerX - box.left}px`);
            cap.style.setProperty("--my", `${pointerY - box.top}px`);
          });
        },
        { passive: true },
      );

      cap.addEventListener("pointerleave", () => {
        cancelAnimationFrame(frame);
        frame = 0;
        bounds = null;
      });
    });
  }
}

/* Ambiente de fundo da secao: orbita, ondas, circuitos e estrelas. Continua
   ligado/desligado pela faixa de scroll — fora da viewport nao ha motivo para
   cinco loops infinitos consumirem compositor.

   Medido: este ambiente NAO era a causa do engasgo da secao. Ocultar ele
   inteiro nao mudou o frame time; quem custava eram os `drop-shadow` dos
   icones antigos, que o GSAP invalidava a cada frame. Os icones novos nao
   usam filter algum, e a secao passou a rodar no piso da maquina. */
if (serviceSection && ambientScene) {
  gsap.matchMedia().add("(prefers-reduced-motion: no-preference)", () => {
    const fineOrbit = serviceSection.querySelector(".ambient-orbit--fine");
    const wavePaths = serviceSection.querySelectorAll(".ambient-wave path");
    const circuits = serviceSection.querySelectorAll(".ambient-circuits path");
    const stars = serviceSection.querySelectorAll(".ambient-stars circle");
    const auroraRight = serviceSection.querySelector(
      ".services-ambient__aurora--right",
    );

    const ambientTweens = [
      gsap.to(fineOrbit, { rotation: -360, svgOrigin: "1330 110", duration: 80, repeat: -1, ease: "none", paused: true }),
      gsap.to(wavePaths, { x: 14, y: (index) => (index % 2 ? 3 : -3), duration: 12, stagger: 0.3, yoyo: true, repeat: -1, ease: "sine.inOut", paused: true }),
      gsap.to(circuits, { strokeDashoffset: -72, duration: 10, repeat: -1, ease: "none", paused: true }),
      gsap.to(stars, { opacity: 0.28, scale: 0.7, transformOrigin: "50% 50%", duration: 2.4, stagger: 0.4, yoyo: true, repeat: -1, ease: "sine.inOut", paused: true }),
      gsap.to(auroraRight, { x: -16, y: -10, rotation: 18, scale: 1.23, duration: 16, yoyo: true, repeat: -1, ease: "sine.inOut", paused: true }),
    ];

    const ambientActivity = ScrollTrigger.create({
      trigger: serviceSection,
      start: "top bottom",
      end: "bottom top",
      onToggle: ({ isActive }) => {
        serviceSection.classList.toggle("is-graphics-active", isActive);
        ambientTweens.forEach((tween) =>
          isActive ? tween.play() : tween.pause(),
        );
      },
    });

    return () => {
      ambientActivity.kill();
      ambientTweens.forEach((tween) => tween.kill());
      serviceSection.classList.remove("is-graphics-active");
    };
  });
}

const servicesSignature = document.querySelector(".services-signature");
if (servicesSignature) {
  textFade(servicesSignature, { start: "top 94%", end: "top 70%", duration: 0.8 });
}

/* Secao "Systems" (console + grafico). O markup nao esta no index.html hoje —
   so o CSS dela sobrou em style.css. Sem esta guarda, o GSAP e o ScrollTrigger
   avisam no console a cada carregamento que .systems / .system-console /
   .chart-line nao existem. Se a secao voltar ao HTML, a animacao religa
   sozinha. */
if (document.querySelector(".systems")) {
  gsap.from(".system-console", {
    scrollTrigger: {
      trigger: ".systems",
      start: "top 65%",
      end: "bottom 80%",
      scrub: 2,
    },
    x: 140,
    y: 70,
    rotateY: 18,
    opacity: 0.2,
  });

  gsap.to(".chart-line", {
    scrollTrigger: { trigger: ".system-console", start: "top 75%" },
    strokeDashoffset: 0,
    duration: 2,
    ease: "power2.out",
  });

  const chartPath = document.querySelector(".chart-line");
  if (chartPath) {
    const length = chartPath.getTotalLength();
    chartPath.style.strokeDasharray = length;
    chartPath.style.strokeDashoffset = length;
  }
}

gsap.to(".process-line span", {
  scrollTrigger: {
    trigger: ".process-track",
    start: "top 75%",
    end: "bottom 65%",
    scrub: 0.45,
  },
  scaleX: 1,
  ease: "none",
});

textFade(".process-step", {
  trigger: ".process-track",
  start: "top 88%",
  end: "top 46%",
  stagger: 0.09,
  duration: 0.82,
});

const contactSection = document.querySelector(".contact");

/* O titulo do contato so comeca a se desenhar quando a travessia do portal
   termina. Durante o pin a secao ja esta geometricamente no viewport, mas
   ainda escondida pelo simbolo; o evento evita gastar a animacao atras dele. */
contactSection?.addEventListener("nexus:assembly-complete", () => {
  contactAssemblyComplete = true;
  contactStrokeText?.play();
});

/* Efeitos abaixo da dobra entram num chunk separado. O CSS estrutural da
   galeria continua no bundle inicial, portanto a geometria da pagina nao muda;
   apenas SplitType, MotionPath e os renderizadores distantes deixam de disputar
   a main thread com a primeira composicao da hero. */
let portfolioController;
let contactShaderController;
let contactFormController;
let nexusAssemblyController;
let deferredSectionsPromise;
let deferredSectionsObserver;

const initDeferredSections = () => {
  if (deferredSectionsPromise) return deferredSectionsPromise;
  deferredSectionsObserver?.disconnect();
  deferredSectionsPromise = Promise.all([
    import("./createPortfolioShowcase.js"),
    import("./createContactShader.js"),
    import("./createContactForm.js"),
    import("./createStrokeText.js"),
    import("./createNexusAssemblyTransition.js"),
  ]).then(([
    portfolioModule,
    contactShaderModule,
    contactFormModule,
    strokeModule,
    nexusModule,
  ]) => {
    portfolioController = portfolioModule.createPortfolioShowcase(
      document.querySelector(".pg"),
      { lenis },
    );
    contactShaderController = contactShaderModule.createContactShader(
      contactSection,
      {
        maxPixelRatio: performanceProfile.contactDpr,
        qualityScale: performanceProfile.contactShaderScale,
        targetFps: performanceProfile.targetFps,
        lowPower: performanceProfile.tier === "low",
      },
    );
    contactFormController = contactFormModule.createContactForm(
      document.querySelector("#contact-form"),
    );
    nexusAssemblyController = nexusModule.createNexusAssemblyTransition(
      document.querySelector(".process"),
      contactSection,
      { lowPower: performanceProfile.tier === "low" },
    );
    contactStrokeText = strokeModule.createStrokeText(
      document.querySelector("[data-stroke-text]"),
      {
        desktopLines: ["Vamos transformar sua ideia", "em experiência."],
        mobileLines: ["Vamos transformar", "sua ideia em", "experiência."],
        strokeColor: "#5ad7ff",
        fillColor: "#f4f8fa",
        strokeWidth: 1.4,
        drawDuration: 2.4,
        fillDelay: 0.35,
        stagger: 0.07,
        autoStart: false,
      },
    );
    if (contactAssemblyComplete) contactStrokeText?.play();
    ScrollTrigger.sort();
    requestAnimationFrame(() => ScrollTrigger.refresh());
  });
  return deferredSectionsPromise;
};

const deferredSectionsRoot = document.querySelector(".pg");
if (deferredSectionsRoot) {
  deferredSectionsObserver = new IntersectionObserver(
    ([entry]) => {
      if (entry.isIntersecting) initDeferredSections();
    },
    { rootMargin: "1200px 0px" },
  );
  deferredSectionsObserver.observe(deferredSectionsRoot);
}
if (["#work", "#process", "#contact"].includes(location.hash)) {
  initDeferredSections();
}

/* Uma ancora pode saltar varias telas sem percorrer a margem do observer. O
   preload no primeiro gesto garante que o canvas de destino ja esteja a caminho
   antes de o navegador concluir o scroll. */
document
  .querySelectorAll('a[href="#work"], a[href="#process"], a[href="#contact"]')
  .forEach((link) => {
    link.addEventListener("pointerenter", initDeferredSections, {
      once: true,
      passive: true,
    });
    link.addEventListener("focus", initDeferredSections, { once: true });
    link.addEventListener("click", initDeferredSections, { once: true });
  });

/* Os componentes acima criam pins independentes. Ordenar e atualizar uma vez
   ao final garante que cada inicio inclua o espacamento dos pins anteriores. */
ScrollTrigger.sort();
requestAnimationFrame(() => ScrollTrigger.refresh());

const contactOrbitTween = gsap.to(".contact-orbit", {
  rotation: 360,
  duration: 28,
  repeat: -1,
  ease: "none",
  paused: true,
});
const contactOrbitActivity = ScrollTrigger.create({
  trigger: ".contact",
  start: "top bottom",
  end: "bottom top",
  onToggle: ({ isActive }) =>
    isActive ? contactOrbitTween.play() : contactOrbitTween.pause(),
});

gsap.to(".page-progress span", {
  scaleX: 1,
  ease: "none",
  scrollTrigger: {
    trigger: document.documentElement,
    start: "top top",
    end: "bottom bottom",
    scrub: true,
  },
});

document.querySelectorAll(".magnetic").forEach((button) => {
  let rect;
  let pointerFrame = 0;
  let pointerX = 0;
  let pointerY = 0;
  const moveX = gsap.quickTo(button, "x", {
    duration: 0.3,
    ease: "power3.out",
  });
  const moveY = gsap.quickTo(button, "y", {
    duration: 0.3,
    ease: "power3.out",
  });
  button.addEventListener("pointerenter", () => {
    rect = button.getBoundingClientRect();
  }, { passive: true });
  button.addEventListener("pointermove", (event) => {
    pointerX = event.clientX;
    pointerY = event.clientY;
    if (pointerFrame) return;
    pointerFrame = requestAnimationFrame(() => {
      pointerFrame = 0;
      const bounds = rect ?? button.getBoundingClientRect();
      const x = pointerX - bounds.left - bounds.width / 2;
      const y = pointerY - bounds.top - bounds.height / 2;
      moveX(x * 0.16);
      moveY(y * 0.2);
    });
  }, { passive: true });
  button.addEventListener("pointerleave", () => {
    cancelAnimationFrame(pointerFrame);
    pointerFrame = 0;
    rect = null;
    gsap.to(button, { x: 0, y: 0, duration: 0.5, ease: "elastic.out(1,.4)" });
  });
});

/* THREE.JS */
preloader.setProgress(0.55);
const canvas = document.querySelector("#webgl");
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2("#050608", 0.075);

let isMobile = matchMedia("(max-width: 700px)").matches;
let canvasBounds = { left: 0, top: 0, w: 1, h: 1 };
function measureCanvas() {
  const rect = canvas.getBoundingClientRect();
  canvasBounds = {
    left: rect.left,
    top: rect.top,
    w: Math.max(1, rect.width),
    h: Math.max(1, rect.height),
  };
  return canvasBounds;
}
function canvasSize() {
  return canvasBounds;
}
measureCanvas();

const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
let cameraBaseX = isMobile ? 0 : 0.7;
let cameraBaseY = isMobile ? 0 : 0.1;
camera.position.set(cameraBaseX, cameraBaseY, isMobile ? 7.2 : 7);

const background = createShaderBackground(
  document.querySelector("#bg-shader"),
  {
    maxPixelRatio: performanceProfile.backgroundDpr,
    intensity: performanceProfile.backgroundIntensity,
  },
);

/* Background reativo ao cursor.
   So em ponteiro fino (mouse/trackpad): em touch nao ha hover, e o dedo
   cobriria justamente a area do efeito. Respeita prefers-reduced-motion. */
const backgroundFollowsPointer =
  matchMedia("(hover: hover) and (pointer: fine)").matches &&
  !matchMedia("(prefers-reduced-motion: reduce)").matches;
let cursorGridController;

if (backgroundFollowsPointer) {
  window.addEventListener(
    "pointermove",
    (event) => {
      if (event.pointerType === "touch") return;
      background.setPointer(event.clientX, event.clientY);
    },
    { passive: true },
  );

  // cursor saiu da janela ou a aba perdeu foco: o efeito recolhe sozinho
  document.addEventListener("pointerleave", () => background.clearPointer());
  window.addEventListener("blur", () => background.clearPointer());
}

/* Grade que acende sob o cursor na hero.
   Mesmo gate do background: em touch nao ha cursor para seguir. */
if (backgroundFollowsPointer) {
  const heroSection = document.querySelector(".hero");

  cursorGridController = createCursorGrid(document.querySelector(".cursor-grid"), {
    // 76px casa exatamente com o background-size de .hero-grid, entao as
    // celulas acesas caem em cima do lattice que ja esta na tela
    cellSize: 76,
    color: "#5AD7FF",
    radius: 190,
    falloff: "smooth",
    holdTime: 260,
    fadeDuration: 900,
    lineWidth: 1,
    // opacidade cheia estoura sobre o preto profundo; 0.6 mantem discreto
    maxOpacity: 0.6,
    fillOpacity: 0.05,
    // o lattice estatico ja e desenhado por .hero-grid, com mascara radial
    gridOpacity: 0,
    clickPulse: true,
    pulseSpeed: 520,
    maxPixelRatio: performanceProfile.cursorDpr,
    targetFps: performanceProfile.targetFps,
    // os eventos vem da section: o canvas e pointer-events:none para nao
    // competir com o arraste do objeto 3D
    eventTarget: heroSection,
  });
}

const renderer = new THREE.WebGLRenderer({
  canvas,
  /* O composer renderiza a cena em targets proprios; MSAA no framebuffer
     padrao nao atua nesses targets e apenas aumenta o custo do contexto. */
  antialias: false,
  alpha: true,
  powerPreference:
    performanceProfile.tier === "low" ? "low-power" : "high-performance",
});
renderer.setSize(canvasSize().w, canvasSize().h, false);
renderer.setPixelRatio(
  Math.min(devicePixelRatio, performanceProfile.heroDpr),
);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.9;

const cloudRadius = isMobile ? 1.25 : 1.2;
const cloud = await createInteractiveFiberCloud({
  pointCount: performanceProfile.heroPoints,
  radius: cloudRadius,
  pointSize: isMobile ? 2 : 1.7,
  interactionRadius: 0.8,
  pixelRatio: performanceProfile.heroDpr,
  detail: performanceProfile.heroDetail,
});

/* A nuvem de fibras e a etapa mais cara da montagem: dezenas de milhares de
   pontos. Passar dela e o marco mais honesto de "quase pronto". */
preloader.setProgress(0.82);

/* raio real ocupado pela nuvem: lobos + assimetria + deslocamento do shader */
const cloudBoundingRadius = cloudRadius * 1.5 + 0.45;

/* fracao horizontal do canvas onde o objeto fica centrado (0 = esquerda, 1 = direita) */
const dragPivot = new THREE.Group();
dragPivot.add(cloud.group);

/* anchor cuida do enquadramento responsivo; dragPivot preserva a interacao. */
const objectAnchor = new THREE.Group();
objectAnchor.add(dragPivot);
scene.add(objectAnchor);

function frameObject() {
  const { w, h } = canvasSize();
  const objectAnchorX = isMobile ? 0.5 : 0.74;
  const objectFitHeight = isMobile ? 0.78 : 0.78;
  const objectFitWidth = isMobile ? 0.78 : 0.44;
  const distance = camera.position.z;
  const visibleHeight =
    2 * distance * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
  const visibleWidth = visibleHeight * (w / h);

  const targetRadius =
    Math.min(
      visibleHeight * objectFitHeight,
      visibleWidth * objectFitWidth,
    ) / 2;

  const fit = targetRadius / cloudBoundingRadius;
  /* No canvas compacto do mobile a margem de seguranca do bounding radius
     deixava a fibra pequena demais. O ganho acontece depois do calculo de
     enquadramento, portanto aumenta o objeto de verdade sem alterar sua
     densidade, interacao ou aparencia no desktop. */
  const mobileScaleBoost = isMobile ? 1.18 : 1;
  objectAnchor.scale.setScalar(fit * mobileScaleBoost);
  objectAnchor.position.x =
    cameraBaseX + (objectAnchorX - 0.5) * visibleWidth;
  objectAnchor.position.y = 0;
}

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2(10, 10);
const pointerWorld = new THREE.Vector3();
const prevPointerWorld = new THREE.Vector3();
const proxy = cloud.group.getObjectByName("InteractionProxy");
const proxyCenter = new THREE.Vector3();
const proxyScale = new THREE.Vector3();
const analyticHit = new THREE.Vector3();
const interactionSphere = new THREE.Sphere();

let isDragging = false;
let activePointerId = null;
let lastX = 0,
  lastY = 0;
let velocityX = 0,
  velocityY = 0;
let lastPointerTime = performance.now();
let hoverActive = false;
let pendingPointerMove = false;
let pendingPointerX = 0;
let pendingPointerY = 0;
let pendingPointerId = null;

function normalizedPointer(x, y) {
  const r = canvas.getBoundingClientRect();
  pointer.x = ((x - r.left) / r.width) * 2 - 1;
  pointer.y = -((y - r.top) / r.height) * 2 + 1;
}

function intersection(x, y) {
  normalizedPointer(x, y);
  raycaster.setFromCamera(pointer, camera);
  if (!proxy) return null;
  proxy.updateWorldMatrix(true, false);
  proxy.getWorldPosition(proxyCenter);
  proxy.getWorldScale(proxyScale);
  interactionSphere.center.copy(proxyCenter);
  interactionSphere.radius =
    proxy.geometry.parameters.radius * Math.max(proxyScale.x, proxyScale.y, proxyScale.z);
  return raycaster.ray.intersectSphere(interactionSphere, analyticHit);
}

canvas.addEventListener("pointerdown", (e) => {
  const hit = intersection(e.clientX, e.clientY);
  if (!hit) return;
  isDragging = true;
  activePointerId = e.pointerId;
  lastX = e.clientX;
  lastY = e.clientY;
  velocityX = velocityY = 0;
  canvas.setPointerCapture(e.pointerId);
  canvas.classList.add("is-dragging");
  e.preventDefault();
});

canvas.addEventListener("pointermove", (e) => {
  pendingPointerMove = true;
  pendingPointerX = e.clientX;
  pendingPointerY = e.clientY;
  pendingPointerId = e.pointerId;
  if (isDragging) e.preventDefault();
});

function processPointerMove() {
  if (!pendingPointerMove) return;
  pendingPointerMove = false;
  const hit = intersection(pendingPointerX, pendingPointerY);
  canvas.classList.toggle("can-grab", Boolean(hit));

  if (hit) {
    pointerWorld.copy(hit);
    const now = performance.now();
    const dt = Math.max((now - lastPointerTime) / 1000, 0.016);
    const speed = pointerWorld.distanceTo(prevPointerWorld) / dt;
    prevPointerWorld.copy(pointerWorld);
    lastPointerTime = now;
    hoverActive = true;
    cloud.pointerUpdate(pointerWorld, true, speed * 0.05);
  } else {
    hoverActive = false;
    cloud.pointerUpdate(pointerWorld, false);
  }

  if (!isDragging || pendingPointerId !== activePointerId) return;
  const dx = pendingPointerX - lastX;
  const dy = pendingPointerY - lastY;
  lastX = pendingPointerX;
  lastY = pendingPointerY;
  const sensitivity = isMobile ? 0.009 : 0.0065;
  velocityY = THREE.MathUtils.clamp(dx * sensitivity, -0.14, 0.14);
  velocityX = THREE.MathUtils.clamp(dy * sensitivity, -0.14, 0.14);
  dragPivot.rotation.y += velocityY;
  dragPivot.rotation.x += velocityX;
}

function endDrag(e) {
  if (!isDragging || e.pointerId !== activePointerId) return;
  isDragging = false;
  activePointerId = null;
  canvas.classList.remove("is-dragging");
  if (canvas.hasPointerCapture(e.pointerId))
    canvas.releasePointerCapture(e.pointerId);
}
canvas.addEventListener("pointerup", endDrag);
canvas.addEventListener("pointercancel", endDrag);
canvas.addEventListener("pointerleave", () => {
  pendingPointerMove = false;
  canvas.classList.remove("can-grab");
  if (!isDragging) {
    hoverActive = false;
    cloud.pointerUpdate(pointerWorld, false);
  }
});

document.querySelector("#focus-object").addEventListener("click", () => {
  lenis.scrollTo(0, { duration: 1 });
  gsap.to(dragPivot.rotation, {
    x: dragPivot.rotation.x + 0.45,
    y: dragPivot.rotation.y + Math.PI * 2,
    duration: 2.3,
    ease: "power3.inOut",
  });
});

let cloudGlow = isMobile ? 0.4 : 0.62;
const heroVisibility = new IntersectionObserver(
  ([entry]) => {
    heroNearViewport = entry.isIntersecting;
    if (!syncHeroGraphicsActivity()) {
      hoverActive = false;
      cloud.pointerUpdate(pointerWorld, false);
    }
  },
  { rootMargin: "120px 0px" },
);
heroVisibility.observe(document.querySelector(".hero"));

const mainFrameInterval = 1000 / performanceProfile.targetFps;
let lastMainFrame = 0;
let nextMainFrame = 0;
function render(now = performance.now()) {
  mainAnimationFrame = requestAnimationFrame(render);
  if (document.hidden || (nextMainFrame && now < nextMainFrame - 1)) return;
  if (!nextMainFrame || now - nextMainFrame > mainFrameInterval * 3) {
    nextMainFrame = now;
  }
  nextMainFrame += mainFrameInterval;
  const delta = Math.min(
    lastMainFrame ? (now - lastMainFrame) / 1000 : 0.016,
    0.05,
  );
  lastMainFrame = now;
  const elapsed = now / 1000;

  background.setScroll(normalizedScroll);
  background.tick(elapsed);

  /* O shader global continua vivo, mas a nuvem da hero deixa de
     consumir GPU assim que a hero sai da vizinhanca do viewport. */
  if (!heroGraphicsAreActive()) return;

  processPointerMove();
  cloud.tick(delta, elapsed);

  if (!isDragging) {
    dragPivot.rotation.x += velocityX;
    dragPivot.rotation.y += velocityY;
    velocityX = THREE.MathUtils.damp(velocityX, 0, 5.2, delta);
    velocityY = THREE.MathUtils.damp(velocityY, 0, 5.2, delta);

    const idle =
      1 - Math.min(1, (Math.abs(velocityX) + Math.abs(velocityY)) * 22);
    // Volta suavemente para uma vista tres-quartos. Assim chip, interface e
    // simbolo continuam legiveis sem remover a liberdade de giro do usuario.
    const driftY =
      Math.sin(elapsed * 0.127) * 0.24 +
      Math.sin(elapsed * 0.0463 + 2.1) * 0.1;
    const driftX =
      Math.sin(elapsed * 0.091 + 1.3) * 0.1 +
      Math.sin(elapsed * 0.0337) * 0.055;
    dragPivot.rotation.y = THREE.MathUtils.damp(
      dragPivot.rotation.y,
      driftY,
      0.55 * idle,
      delta,
    );
    dragPivot.rotation.x = THREE.MathUtils.damp(
      dragPivot.rotation.x,
      driftX,
      0.55 * idle,
      delta,
    );
    dragPivot.rotation.z =
      Math.sin(elapsed * 0.071) * 0.1 + Math.sin(elapsed * 0.029 + 0.7) * 0.05;
  }

  const targetX = cameraBaseX + pointer.x * 0.09;
  const targetY = cameraBaseY + pointer.y * 0.06;
  camera.position.x = THREE.MathUtils.damp(
    camera.position.x,
    targetX,
    3.5,
    delta,
  );
  camera.position.y = THREE.MathUtils.damp(
    camera.position.y,
    targetY,
    3.5,
    delta,
  );
  camera.lookAt(cameraBaseX, 0, 0);

  cloudGlow = THREE.MathUtils.damp(
    cloudGlow,
    hoverActive ? (isMobile ? 0.58 : 0.85) : isMobile ? 0.4 : 0.62,
    4,
    delta,
  );
  cloud.setGlow(cloudGlow);

  renderer.render(scene, camera);
}
let mainAnimationFrame = 0;
render();

function handleResize() {
  isMobile = matchMedia("(max-width: 700px)").matches;
  cameraBaseX = isMobile ? 0 : 0.7;
  cameraBaseY = isMobile ? 0 : 0.1;
  camera.position.set(cameraBaseX, cameraBaseY, isMobile ? 7.2 : 7);
  const { w, h } = measureCanvas();
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h, false);
  renderer.setPixelRatio(
    Math.min(devicePixelRatio, performanceProfile.heroDpr),
  );
  cloud.resize(renderer.getPixelRatio());
  background.resize();
  frameObject();
}

handleResize();
let resizeFrame = 0;
const scheduleResize = () => {
  if (resizeFrame) return;
  resizeFrame = requestAnimationFrame(() => {
    resizeFrame = 0;
    handleResize();
  });
};
window.addEventListener("resize", scheduleResize, { passive: true });
window.addEventListener("orientationchange", scheduleResize, { passive: true });
const canvasResizeObserver =
  typeof ResizeObserver !== "undefined"
    ? new ResizeObserver(scheduleResize)
    : null;
canvasResizeObserver?.observe(canvas);

/* Cena montada e enquadrada. Espera o primeiro frame realmente compor antes de
   fechar o preloader — assim a hero ja esta desenhada quando a tela dissolve,
   e so entao a intro dos textos comeca. */
requestAnimationFrame(() => {
  requestAnimationFrame(() => {
    preloader.finish().then(() => intro.play());
  });
});

/* Ciclo de vida completo para navegacoes que nao entram no bfcache e para
   futuras montagens/desmontagens do site dentro de um shell. */
window.addEventListener("pagehide", (event) => {
  if (event.persisted) return;
  cancelAnimationFrame(mainAnimationFrame);
  cancelAnimationFrame(resizeFrame);
  heroVisibility.disconnect();
  canvasResizeObserver?.disconnect();
  deferredSectionsObserver?.disconnect();
  navbarController?.dispose();
  nexusAssemblyController?.dispose();
  portfolioController?.dispose();
  contactShaderController?.destroy();
  contactFormController?.dispose();
  cursorGridController?.dispose();
  contactStrokeText?.dispose();
  contactOrbitActivity.kill();
  contactOrbitTween.kill();
  cloud.dispose();
  renderer.dispose();
  background.dispose();
  heroAnchorLinks.forEach((link) =>
    link.removeEventListener("click", onHeroAnchorClick),
  );
  lenis.off("scroll", onLenisScroll);
  gsap.ticker.remove(tickLenis);
  lenis.destroy();
}, { once: true });
