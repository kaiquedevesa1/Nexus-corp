import gsap from "gsap";

/* Altura do viewBox do simbolo. O recorte do preenchimento sobe de VIEW_H
   (nada colorido) ate 0 (simbolo inteiro colorido). */
const VIEW_H = 470;

/* Tempo minimo em tela. Sem isso, em cache quente o preenchimento pularia de
   0 a 100 no mesmo frame e a animacao simplesmente nao seria vista. */
const MIN_VISIBLE = 1150;
const HOLD_AT_FULL = 240;

const clamp01 = (v) => Math.min(1, Math.max(0, v));

/**
 * Preloader do simbolo Nexus.
 *
 * A marcacao vive no index.html (inline, junto do CSS critico) para que a tela
 * apareja ja no primeiro paint — este modulo so anima o que ja esta la.
 *
 * O progresso e uma mistura de sinais reais (DOM pronto, imagens nao-lazy,
 * window.load, cena WebGL montada) com uma interpolacao amortecida, para que a
 * barra nunca fique congelada esperando um evento.
 */
export function createPreloader() {
  const root = document.getElementById("preloader");
  const clipRect = document.getElementById("preloader-clip-rect");
  const edgeRect = document.getElementById("preloader-edge-rect");
  const bar = document.getElementById("preloader-bar");
  const count = document.getElementById("preloader-count");

  /* Se a marcacao nao existir (build antigo, pagina parcial), o site precisa
     seguir funcionando: devolve uma API inerte. */
  if (!root || !clipRect) {
    document.body.classList.remove("loading");
    return { setProgress() {}, finish: () => Promise.resolve() };
  }

  const symbol = root.querySelector(".preloader__symbol");
  const meta = root.querySelector(".preloader__meta");
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

  const startedAt = performance.now();
  let target = 0.06;
  let value = 0;
  let painted = -1;
  let last = startedAt;
  let running = true;
  let closing = false;

  function paint(p) {
    const y = (1 - p) * VIEW_H;
    clipRect.setAttribute("y", y.toFixed(2));

    if (edgeRect) {
      /* O brilho acompanha a linha do preenchimento e some nas pontas, senao
         fica uma barra dura colada no rodape em 0% e no topo em 100%. */
      edgeRect.setAttribute("y", y.toFixed(2));
      edgeRect.setAttribute(
        "opacity",
        clamp01(Math.min(p * 7, (1 - p) * 7, 1)).toFixed(3),
      );
    }

    if (bar) bar.style.transform = `scaleX(${p.toFixed(4)})`;

    const percent = Math.round(p * 100);
    if (count && percent !== painted) {
      count.textContent = percent;
      painted = percent;
    }
  }

  paint(0);

  function frame(now) {
    if (!running) return;
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;

    /* Amortecimento exponencial: o valor persegue o alvo desacelerando, o que
       da a leitura de "carregando" mesmo quando o alvo salta de uma vez. */
    value += (target - value) * (1 - Math.exp(-dt * 2.4));
    paint(clamp01(value));

    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  /** Empurra o alvo para frente. Nunca anda para tras. */
  function setProgress(v) {
    target = Math.max(target, clamp01(v));
  }

  /* --- Sinais reais de carregamento -------------------------------------- */

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => setProgress(0.42), {
      once: true,
    });
  } else {
    setProgress(0.42);
  }

  /* Imagens lazy ficam de fora de proposito: elas so baixam quando o usuario
     rola ate elas, entao contariam como progresso que nunca chega. */
  const eager = [...document.images].filter(
    (img) => img.loading !== "lazy" && !img.closest(".preloader"),
  );
  if (eager.length) {
    let done = 0;
    const step = () => {
      done += 1;
      setProgress(0.42 + (done / eager.length) * 0.4);
    };
    eager.forEach((img) => {
      if (img.complete) step();
      else {
        img.addEventListener("load", step, { once: true });
        img.addEventListener("error", step, { once: true });
      }
    });
  }

  if (document.readyState === "complete") {
    setProgress(0.9);
  } else {
    window.addEventListener("load", () => setProgress(0.9), { once: true });
  }

  /* --- Saida -------------------------------------------------------------- */

  /**
   * Fecha o preloader: completa o preenchimento ate 100%, segura por um
   * instante e dissolve a tela.
   *
   * @returns {Promise<void>} resolvida quando a tela ja saiu do caminho.
   */
  function finish() {
    if (closing) return closing;

    const wait = Math.max(0, MIN_VISIBLE - (performance.now() - startedAt));

    closing = new Promise((resolve) => {
      /* Enquanto espera o tempo minimo, o rAF continua conduzindo: o simbolo
         segue se preenchendo em vez de congelar num numero quebrado. */
      setProgress(0.97);

      setTimeout(() => {
        /* So agora o rAF entrega o bastao ao GSAP, no mesmo instante em que o
           valor e capturado — sem salto para tras. */
        running = false;
        const state = { p: value };

        const tl = gsap.timeline({
          onComplete: () => {
            root.remove();
            document.body.classList.remove("loading");
            resolve();
          },
        });

        tl.to(state, {
          p: 1,
          duration: reduced ? 0.2 : 0.5,
          ease: "power2.out",
          onUpdate: () => paint(state.p),
        });

        tl.to(
          root,
          {
            opacity: 0,
            duration: reduced ? 0.25 : 0.7,
            ease: "power2.inOut",
          },
          `+=${HOLD_AT_FULL / 1000}`,
        );

        if (!reduced) {
          if (symbol) {
            tl.to(
              symbol,
              { scale: 1.12, duration: 0.9, ease: "power3.in" },
              "<-0.1",
            );
          }
          if (meta) {
            tl.to(meta, { opacity: 0, y: 10, duration: 0.35 }, "<");
          }
        }
      }, wait);
    });

    return closing;
  }

  return { setProgress, finish };
}
