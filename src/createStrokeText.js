import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

const SVG_NS = "http://www.w3.org/2000/svg";
const XML_NS = "http://www.w3.org/XML/1998/namespace";

const svgNode = (name, attributes = {}) => {
  const node = document.createElementNS(SVG_NS, name);
  Object.entries(attributes).forEach(([key, value]) =>
    node.setAttribute(key, String(value)),
  );
  return node;
};

const appendCharacters = (textNode, text, dataAttribute) => {
  Array.from(text).forEach((character) => {
    const characterNode = svgNode("tspan");
    characterNode.dataset[dataAttribute] = "";
    characterNode.textContent = character === " " ? "\u00a0" : character;
    textNode.appendChild(characterNode);
  });
};

/**
 * Port em JavaScript do Stroke Text, do React Bits.
 * Mantem a sequencia original: desenha os glifos e revela o preenchimento
 * com uma mascara horizontal. A unica extensao e o suporte a multiplas linhas.
 */
export function createStrokeText(root, options = {}) {
  if (!root) return null;

  const {
    desktopLines = [root.textContent.trim()],
    mobileLines = desktopLines,
    mobileBreakpoint = 700,
    strokeColor = "#a78bfa",
    fillColor = "#f8fafc",
    strokeWidth = 1.4,
    drawDuration = 1.6,
    fillDelay = 0.2,
    stagger = 0.05,
    ease = "power2.out",
    fontSize = 128,
    fontWeight = 600,
    letterSpacing = -5,
    lineHeight = 0.96,
    /* false = ninguem dispara sozinho: a timeline fica armada e pausada ate
       alguem chamar .play(). E o que permite segurar o desenho ate o fim da
       travessia do portal — por posicao ele dispararia no meio do pin, com o
       titulo escondido atras do painel, e ninguem veria o traco acontecer. */
    autoStart = true,
  } = options;

  const accessibleText = root.textContent.replace(/\s+/g, " ").trim();
  const media = matchMedia(`(max-width: ${mobileBreakpoint}px)`);
  const clipId = `stroke-text-wipe-${Math.random().toString(36).slice(2)}`;
  let timeline;
  let scrollTrigger;
  let animatedTargets = [];
  let hasPlayed = false;
  let released = autoStart;
  let disposed = false;

  root.classList.add("stroke-text");
  root.setAttribute("aria-label", accessibleText);

  const clearAnimation = () => {
    scrollTrigger?.kill();
    timeline?.kill();
    gsap.killTweensOf(animatedTargets);
    scrollTrigger = null;
    timeline = null;
    animatedTargets = [];
  };

  const render = () => {
    if (disposed) return;
    clearAnimation();

    const lines = media.matches ? mobileLines : desktopLines;
    const svg = svgNode("svg", {
      class: "stroke-text__svg",
      "aria-hidden": "true",
      preserveAspectRatio: "xMidYMid meet",
    });
    const definitions = svgNode("defs");
    const clipPath = svgNode("clipPath", {
      id: clipId,
      clipPathUnits: "userSpaceOnUse",
    });
    const wipe = svgNode("rect", { width: 0 });
    const strokeGroup = svgNode("g", { class: "stroke-text__stroke" });
    const fillGroup = svgNode("g", {
      class: "stroke-text__fill",
      "clip-path": `url(#${clipId})`,
    });
    const typeAttributes = {
      x: 0,
      "text-anchor": "middle",
      "font-size": fontSize,
      "font-weight": fontWeight,
      "letter-spacing": letterSpacing,
    };

    lines.forEach((line, index) => {
      const y = index * fontSize * lineHeight;
      const strokeLine = svgNode("text", {
        ...typeAttributes,
        y,
        fill: "none",
        stroke: strokeColor,
        "stroke-width": strokeWidth,
        "stroke-linejoin": "round",
        "stroke-linecap": "round",
      });
      const fillLine = svgNode("text", {
        ...typeAttributes,
        y,
        fill: fillColor,
        stroke: "none",
      });
      strokeLine.setAttributeNS(XML_NS, "xml:space", "preserve");
      fillLine.setAttributeNS(XML_NS, "xml:space", "preserve");
      appendCharacters(strokeLine, line, "strokeChar");
      appendCharacters(fillLine, line, "fillChar");
      strokeGroup.appendChild(strokeLine);
      fillGroup.appendChild(fillLine);
    });

    clipPath.appendChild(wipe);
    definitions.appendChild(clipPath);
    svg.append(definitions, strokeGroup, fillGroup);
    root.replaceChildren(svg);

    const box = strokeGroup.getBBox();
    const pad = Math.max(strokeWidth, fontSize * 0.08);
    const viewBox = {
      x: box.x - pad,
      y: box.y - pad,
      width: box.width + pad * 2,
      height: box.height + pad * 2,
    };

    svg.setAttribute(
      "viewBox",
      `${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`,
    );
    svg.setAttribute("width", viewBox.width);
    svg.setAttribute("height", viewBox.height);
    Object.entries({
      x: viewBox.x,
      y: viewBox.y,
      height: viewBox.height,
    }).forEach(([key, value]) => wipe.setAttribute(key, String(value)));

    const strokes = [...root.querySelectorAll("[data-stroke-char]")];
    const fills = [...root.querySelectorAll("[data-fill-char]")];
    const dash = Math.max(fontSize * 7, 200);
    animatedTargets = [...strokes, ...fills, wipe];

    gsap.set(strokes, {
      strokeDasharray: dash,
      strokeDashoffset: dash,
    });
    gsap.set(fills, { opacity: 1 });
    gsap.set(wipe, { attr: { width: 0 } });

    if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
      gsap.set(strokes, { strokeDashoffset: 0 });
      gsap.set(wipe, { attr: { width: viewBox.width } });
      return;
    }

    timeline = gsap.timeline({ paused: true });
    timeline
      .to(strokes, {
        strokeDashoffset: 0,
        duration: drawDuration,
        ease,
        stagger,
      })
      .to(
        wipe,
        {
          attr: { width: viewBox.width },
          duration: Math.max(0.4, drawDuration * 0.5),
          ease: "power2.inOut",
        },
        drawDuration + fillDelay,
      );

    /* Armado, mas segurado: quando .play() for chamado, a timeline ja esta
       montada e parte do zero na hora. */
    if (!released) return;

    if (hasPlayed || root.getBoundingClientRect().top <= innerHeight * 0.82) {
      hasPlayed = true;
      timeline.play(0);
    } else {
      scrollTrigger = ScrollTrigger.create({
        trigger: root,
        start: "top 82%",
        once: true,
        onEnter: () => {
          hasPlayed = true;
          timeline?.play(0);
        },
      });
    }
  };

  const renderWhenFontsAreReady = () => {
    if (document.fonts?.ready) {
      document.fonts.ready.then(render).catch(render);
    } else {
      render();
    }
  };

  const onBreakpointChange = () => render();
  media.addEventListener?.("change", onBreakpointChange);
  renderWhenFontsAreReady();

  return {
    /* Libera e toca o desenho. Idempotente: chamadas repetidas (a transicao
       pode dar onLeave mais de uma vez) nao reiniciam a animacao. Se as
       fontes ainda nao carregaram, o render pendente ve hasPlayed e toca
       assim que estiver pronto. */
    play() {
      released = true;
      if (disposed || hasPlayed) return;
      hasPlayed = true;
      timeline?.play(0);
    },
    dispose() {
      disposed = true;
      clearAnimation();
      media.removeEventListener?.("change", onBreakpointChange);
    },
  };
}
