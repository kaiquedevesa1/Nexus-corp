import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import "./sectionGate.css";

gsap.registerPlugin(ScrollTrigger);

/**
 * Revela uma secao que estava atras de outra.
 *
 * A secao de cobertura e fixada (pin) e ganha uma mascara: uma faixa
 * transparente que se abre do centro para as bordas. Atras dela, imovel, esta
 * a secao de destino — que nao "entra" na tela, ela ja estava ali.
 *
 * Como o alvo fica parado:
 *   Com a cobertura fixada e `pinSpacing: false`, a pagina rola sem que ela
 *   se mova, e o alvo sobe exatamente a distancia rolada. Entao ele recebe um
 *   translate de -distancia ate 0 no mesmo intervalo: o deslocamento natural
 *   e o translate se cancelam e a posicao visual dele fica constante em
 *   top: 0 do inicio ao fim. No ultimo frame o translate e zero e a posicao
 *   natural ja e top: 0, entao a passagem para o scroll normal nao tem salto.
 *
 * Requisito: a cobertura precisa ocupar 100svh (garantido pelo .is-gated) e
 * ser irma imediata do alvo no HTML.
 *
 * @param {Element} cover   secao que cobre e abre (recebe o pin e a mascara)
 * @param {Element} target  secao revelada atras
 * @param {object}  [options]
 * @param {string}  [options.seamFrom]      seletor da linha onde a fresta abre
 * @param {object}  [options.reveal]        seletores do conteudo do alvo
 * @param {string}  [options.reveal.content]  bloco principal
 * @param {string}  [options.reveal.chars]    caracteres do titulo
 * @param {string}  [options.reveal.expand]   elemento que expande do centro
 * @param {string}  [options.reveal.fade]     elementos secundarios
 */
export function createSectionGate(cover, target, options = {}) {
  if (!cover || !target) return { dispose() {} };

  const { reveal = {}, seamFrom = "" } = options;
  const mm = gsap.matchMedia();

  mm.add(
    "(prefers-reduced-motion: no-preference)",
    () => {
    /* Seletor vazio vira array vazio e nenhum tween e criado — assim um
       seletor ausente no HTML nao gera "GSAP target not found". */
    const pick = (selector) =>
      selector ? gsap.utils.toArray(selector, target) : [];

    const content = pick(reveal.content);
    const chars = pick(reveal.chars);
    const expand = pick(reveal.expand);
    const fade = pick(reveal.fade);
    const mobileGate = matchMedia("(max-width: 700px)").matches;

    /* O conteudo da cobertura vai para dentro de um wrapper porque e ele que
       recebe a mascara e o fundo opaco. A camada de luz precisa ficar de
       fora: mascara vale para os descendentes, e a luz da fresta seria
       apagada junto. */
    const coverInner = document.createElement("div");
    coverInner.className = "gate-cover";
    while (cover.firstChild) coverInner.appendChild(cover.firstChild);
    cover.appendChild(coverInner);

    const light = document.createElement("div");
    light.className = "gate";
    light.setAttribute("aria-hidden", "true");
    light.innerHTML = `
      <span class="gate__bloom"></span>
      <span class="gate__path"></span>
      <span class="gate__seam"></span>
      <span class="gate__core"></span>
    `;
    cover.appendChild(light);

    cover.classList.add("is-gated");
    cover.classList.toggle("is-gated-mobile", mobileGate);
    target.classList.add("gate-target");

    const seam = light.querySelector(".gate__seam");
    const path = light.querySelector(".gate__path");
    const core = light.querySelector(".gate__core");
    const bloom = light.querySelector(".gate__bloom");

    /* Os fromTo abaixo aplicam o primeiro frame imediatamente. Sem esconder
       o pai, o nucleo da fresta aparece como um ponto luminoso muito antes
       de a transicao chegar ao viewport. */
    gsap.set(light, { autoAlpha: 0 });

    const distance = () => window.innerHeight;

    /* Onde a fresta abre, em % da altura da cobertura.
       Preferencia pela linha indicada em `seamFrom` (a .process-line): a
       linha que atravessa o processo virar a propria fresta e o que liga as
       duas secoes. So vale se ela estiver visivel e cair perto do centro da
       tela durante o pin — no mobile ela some no CSS, e numa cobertura mais
       alta que a viewport o meio geometrico da secao nem aparece. */
    const seamCenter = () => {
      /* No celular a fresta final fica na base: ela revela a proxima section
         de baixo para cima depois que a energia percorre a linha vertical. */
      if (mobileGate) return 100;

      const coverHeight = cover.offsetHeight || 1;
      const viewportCenter = coverHeight - window.innerHeight / 2;
      const line = seamFrom ? cover.querySelector(seamFrom) : null;

      if (line) {
        const lineRect = line.getBoundingClientRect();
        if (lineRect.height || lineRect.width) {
          const offset =
            lineRect.top + lineRect.height / 2 - cover.getBoundingClientRect().top;
          if (Math.abs(offset - viewportCenter) < window.innerHeight * 0.35) {
            return (offset / coverHeight) * 100;
          }
        }
      }

      return (viewportCenter / coverHeight) * 100;
    };

    const processAxis = () => {
      const node = cover.querySelector(".step-node");
      if (!node) return 10;
      const nodeRect = node.getBoundingClientRect();
      const coverRect = cover.getBoundingClientRect();
      return ((nodeRect.left + nodeRect.width / 2 - coverRect.left) /
        Math.max(1, cover.offsetWidth)) * 100;
    };

    const applySeamCenter = () => {
      cover.style.setProperty("--gate-center", `${seamCenter().toFixed(3)}%`);
      if (mobileGate) {
        cover.style.setProperty("--gate-axis", `${processAxis().toFixed(3)}%`);
      }
    };

    applySeamCenter();

    const timeline = gsap.timeline({
      defaults: { ease: "none" },
      scrollTrigger: {
        id: "process-showcase-gate",
        trigger: cover,
        /* "bottom bottom" e nao "top top": e o instante em que a base da
           cobertura encosta na base da tela, ou seja, exatamente quando o
           topo do alvo esta na borda inferior. E dai que sai a conta do
           deslocamento. */
        start: "bottom bottom",
        end: () => `+=${distance()}`,
        pin: true,
        /* Deve ser medido depois dos pins de servicos e portfolio. */
        refreshPriority: 10,
        /* Obrigatorio. Com o espacamento padrao o pin insere altura extra
           logo abaixo da cobertura, e o alvo desce exatamente o mesmo tanto
           que a pagina rola — ele nunca chega atras da mascara. Sem
           espacamento, o alvo sobe naturalmente uma viewport durante o pin,
           que e o percurso que o translate abaixo neutraliza. */
        pinSpacing: false,
        scrub: 2,
        anticipatePin: 1,
        invalidateOnRefresh: true,
        onRefresh: applySeamCenter,
        /* A luz existe apenas durante o intervalo ativo do gate. Isso tambem
           cobre scroll reverso e acesso direto por ancora/recarregamento. */
        onToggle: ({ isActive }) =>
          gsap.set(light, { autoAlpha: isActive ? 1 : 0 }),
        /* Ao soltar um pin sem espacamento o ScrollTrigger deixa um
           translate permanente na cobertura, que passa a ocupar o mesmo
           espaco do alvo. Ela fica invisivel (mascara toda aberta), mas
           continuaria capturando o ponteiro — e o shader da showcase
           responde a pointermove. Fora de alcance, sai do caminho. */
        onLeave: () => {
          /* Com scrub numerico o playhead pode chegar alguns frames depois do
             fim geometrico do pin. Finalizamos o estado antes de soltar a
             cobertura para o alvo nunca ficar deslocado no mobile. */
          timeline.progress(1);
          gsap.set(target, { y: 0 });
          cover.classList.add("is-gate-past");
        },
        onEnterBack: () => cover.classList.remove("is-gate-past"),
      },
    });

    /* --- alvo imovel atras da cobertura -------------------------------- */
    timeline.fromTo(
      target,
      { y: () => -distance() },
      { y: 0, duration: 1 },
      0,
    );

    /* --- 1. ignicao: a fresta acende -----------------------------------
       Nada comeca em zero. A cobertura entra em quadro ja com a fresta
       acesa em repouso; um frame totalmente apagado leria como falha de
       carregamento, nao como porta selada. */
    if (mobileGate) {
      timeline
        .fromTo(
          path,
          { scaleY: 0, opacity: 0.35 },
          { scaleY: 1, opacity: 1, duration: 0.22, ease: "power2.in" },
          0,
        )
        .fromTo(
          core,
          { y: 0, scale: 0.5, opacity: 0.45 },
          {
            y: () => window.innerHeight,
            scale: 1,
            opacity: 1,
            duration: 0.22,
            ease: "power2.in",
          },
          0,
        )
        .fromTo(
          seam,
          { scaleX: 0.08, opacity: 0 },
          { scaleX: 1, opacity: 1, duration: 0.16, ease: "power3.out" },
          0.17,
        )
        .fromTo(
          bloom,
          { scaleY: 0.18, opacity: 0 },
          { scaleY: 1, opacity: 1, duration: 0.2, ease: "power2.out" },
          0.16,
        )
        .to(path, { opacity: 0, duration: 0.18 }, 0.22);
    } else {
      timeline
        .fromTo(
          seam,
          { scaleX: 0.22, opacity: 0.45 },
          { scaleX: 1, opacity: 1, duration: 0.16, ease: "power3.out" },
          0,
        )
        .fromTo(
          bloom,
          { scaleY: 0.22, opacity: 0.28 },
          { scaleY: 1, opacity: 1, duration: 0.2, ease: "power2.out" },
          0.02,
        )
        .fromTo(
          core,
          { scale: 0.45, opacity: 0.4 },
          { scale: 1, opacity: 1, duration: 0.16, ease: "back.out(2.2)" },
          0.05,
        );
    }

    /* --- 2. a mascara abre --------------------------------------------- */
    const OPEN = 0.2;

    timeline
      .fromTo(
        coverInner,
        {
          "--gate-a": () => `${seamCenter().toFixed(3)}%`,
          "--gate-b": () => `${seamCenter().toFixed(3)}%`,
        },
        {
          "--gate-a": "0%",
          "--gate-b": "100%",
          duration: 0.62,
          ease: "power2.inOut",
        },
        OPEN,
      )
      .to(core, { scale: 9, opacity: 0, duration: 0.4, ease: "power2.in" }, OPEN)
      .to(bloom, { opacity: 0, duration: 0.34 }, OPEN + 0.1)
      .to(seam, { opacity: 0, duration: 0.26 }, OPEN + 0.2);

    /* --- 3. o conteudo do alvo acende ----------------------------------
       Sincronizado com a abertura: o titulo aparece enquanto a fresta cresce,
       nao depois. */
    if (content.length) {
      timeline.fromTo(
        content,
        { scale: 1.12, opacity: 0 },
        { scale: 1, opacity: 1, duration: 0.46, ease: "power2.out" },
        OPEN + 0.06,
      );
    }

    if (expand.length) {
      timeline.fromTo(
        expand,
        { scale: 0.62, opacity: 0 },
        { scale: 1, opacity: 1, duration: 0.44, ease: "power2.out" },
        OPEN + 0.04,
      );
    }

    if (chars.length) {
      timeline.fromTo(
        chars,
        { yPercent: 120, opacity: 0, rotateX: -70, transformPerspective: 800 },
        {
          yPercent: 0,
          opacity: 1,
          rotateX: 0,
          duration: 0.34,
          stagger: 0.004,
          ease: "power3.out",
        },
        OPEN + 0.14,
      );
    }

    if (fade.length) {
      timeline.fromTo(
        fade,
        { opacity: 0, scale: 0.88 },
        {
          opacity: 1,
          scale: 1,
          duration: 0.3,
          stagger: 0.05,
          ease: "power2.out",
        },
        OPEN + 0.26,
      );
    }

    return () => {
      timeline.scrollTrigger?.kill();
      timeline.kill();

      light.remove();
      while (coverInner.firstChild) cover.appendChild(coverInner.firstChild);
      coverInner.remove();

      cover.classList.remove("is-gated", "is-gated-mobile", "is-gate-past");
      target.classList.remove("gate-target");

      const touched = [target, ...content, ...chars, ...expand, ...fade];
      gsap.set(touched, { clearProps: "all" });
    };
    },
  );

  return {
    dispose() {
      mm.revert();
    },
  };
}
