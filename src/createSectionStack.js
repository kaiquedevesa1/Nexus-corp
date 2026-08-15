import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import "./sectionStack.css";

gsap.registerPlugin(ScrollTrigger);

/* Mesma linguagem do limite hero -> servicos, para os dois parecerem o mesmo
   gesto e nao dois efeitos diferentes.
   No celular o recuo e mais contido: encolher uma secao mais alta que a tela
   chama muito mais atencao do que encolher uma do tamanho dela. */
const AJUSTES = {
  amplo: {
    radius: 42,
    scale: 0.94,
    y: -22,
    contentY: -34,
    contentOpacity: 0.42,
  },
  estreito: {
    radius: 26,
    scale: 0.965,
    y: -12,
    contentY: -20,
    contentOpacity: 0.5,
  },
};

/**
 * Empilha uma cadeia de secoes: cada uma fica sticky no topo e a seguinte
 * sobe por cima, com a de tras recuando para dar profundidade.
 *
 * Recebe uma CADEIA e nao um par porque uma secao do meio e as duas coisas ao
 * mesmo tempo — a showcase cobre o processo e depois e coberta pelo contato.
 * Como par isolado ela precisaria estar dentro de dois wrappers, o que e
 * impossivel; numa cadeia unica ela e so mais um item sticky.
 *
 * Nao usa pin: o empilhamento e `position: sticky`. Por isso nao reserva
 * altura, nao muda o comprimento da pagina e nao disputa ordem de medicao com
 * os pins do portfolio e dos servicos.
 *
 * @param {Array<{section: Element, content?: string}>} items
 *   Em ordem de empilhamento. `content` e o seletor do bloco que recua junto
 *   (o texto, tipicamente) — opcional.
 * @param {object} [options]
 * @param {string} [options.id]  prefixo dos ids de ScrollTrigger
 */
export function createSectionStack(items, options = {}) {
  const chain = (items || []).filter((item) => item?.section);
  if (chain.length < 2) return { dispose() {} };

  const { id = "stack" } = options;
  const mm = gsap.matchMedia();

  /* Vale em qualquer largura: o sticky gruda pela base, entao secao mais alta
     que a tela rola inteira antes de parar (ver sectionStack.css). O que muda
     por breakpoint e so a intensidade do recuo. */
  mm.add(
    {
      amplo: "(min-width: 701px) and (prefers-reduced-motion: no-preference)",
      estreito: "(max-width: 700px) and (prefers-reduced-motion: no-preference)",
    },
    (context) => {
      const ajuste = context.conditions.estreito
        ? AJUSTES.estreito
        : AJUSTES.amplo;
      const sections = chain.map((item) => item.section);

      /* O wrapper e o limite fisico do sticky. Sem ele as secoes usariam o
         <main> inteiro e continuariam grudadas no topo por cima do rodape. */
      const wrapper = document.createElement("div");
      wrapper.className = "section-stack";
      sections[0].before(wrapper);
      wrapper.append(...sections);

      document.documentElement.classList.add("has-section-stack");

      sections.forEach((section, index) => {
        section.classList.add("stack-item");
        /* O ultimo e o topo da pilha: nao fica sticky nem recua. */
        if (index < sections.length - 1) section.classList.add("stack-base");
        if (index > 0) section.classList.add("stack-cover");
        section.style.zIndex = String(index);
      });

      /* O CSS gruda a base com `top` negativo do tamanho do que ela passa da
         tela, e para isso precisa saber a altura dela. offsetHeight ignora o
         transform da animacao, entao a medida continua valida durante o
         recuo. */
      const medirBases = () => {
        const bases = sections.slice(0, -1);
        const heights = bases.map((section) => section.offsetHeight);
        bases.forEach((section, index) => {
          section.style.setProperty("--stack-h", `${heights[index]}px`);
        });
      };

      medirBases();
      ScrollTrigger.addEventListener("refreshInit", medirBases);

      const activeLayers = new WeakMap();
      const toggleLayer = (element, active) => {
        const count = Math.max(0, (activeLayers.get(element) ?? 0) + (active ? 1 : -1));
        activeLayers.set(element, count);
        element.classList.toggle("is-stack-animating", count > 0);
      };

      const timelines = chain.slice(1).map((item, index) => {
        const base = chain[index];
        const cover = item.section;
        const baseContent = base.content
          ? base.section.querySelector(base.content)
          : null;

        const timeline = gsap.timeline({
          defaults: { ease: "none" },
          scrollTrigger: {
            id: `${id}-${index}`,
            /* Comeca quando o topo da cobertura encosta na base da tela e
               termina quando ela toma a tela inteira: o intervalo e
               exatamente o da sobreposicao. */
            trigger: cover,
            start: "top bottom",
            end: "top top",
            scrub: 2,
            invalidateOnRefresh: true,
            onToggle: ({ isActive }) => {
              toggleLayer(base.section, isActive);
              toggleLayer(cover, isActive);
            },
          },
        });

        timeline.to(
          base.section,
          {
            scale: ajuste.scale,
            y: ajuste.y,
            borderRadius: `0 0 ${ajuste.radius}px ${ajuste.radius}px`,
            duration: 1,
          },
          0,
        );

        if (baseContent) {
          timeline.to(
            baseContent,
            {
              y: ajuste.contentY,
              opacity: ajuste.contentOpacity,
              duration: 0.78,
            },
            0,
          );
        }

        /* immediateRender: false — sem isso o fromTo aplicaria o primeiro
           frame no carregamento e a secao nasceria arredondada mesmo longe
           do limite. */
        timeline.fromTo(
          cover,
          {
            borderRadius: `${ajuste.radius}px ${ajuste.radius}px 0 0`,
            boxShadow:
              "0 -34px 90px rgba(0, 0, 0, 0.72), 0 -1px 0 rgba(90, 215, 255, 0.2)",
          },
          {
            borderRadius: "0px",
            boxShadow:
              "0 -10px 34px rgba(0, 0, 0, 0.38), 0 -1px 0 rgba(90, 215, 255, 0.08)",
            duration: 1,
            immediateRender: false,
          },
          0,
        );

        return timeline;
      });

      return () => {
        ScrollTrigger.removeEventListener("refreshInit", medirBases);
        timelines.forEach((timeline) => {
          timeline.scrollTrigger?.kill();
          timeline.kill();
        });

        document.documentElement.classList.remove("has-section-stack");

        const contents = chain
          .map((item) =>
            item.content ? item.section.querySelector(item.content) : null,
          )
          .filter(Boolean);

        gsap.set([...sections, ...contents], { clearProps: "all" });

        sections.forEach((section) => {
          section.classList.remove("stack-item", "stack-base", "stack-cover");
          section.classList.remove("is-stack-animating");
          section.style.zIndex = "";
          section.style.removeProperty("--stack-h");
        });

        wrapper.before(...sections);
        wrapper.remove();
      };
    },
  );

  return {
    dispose() {
      mm.revert();
    },
  };
}
