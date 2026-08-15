/**
 * Grade reativa ao cursor — porte em JS puro do CursorGrid (React Bits).
 * O projeto e Vite + JS puro, entao trazer React so por causa deste efeito
 * custaria ~140KB de runtime para um unico canvas 2D.
 *
 * A logica de iluminacao, fade e pulso e a mesma do original. As diferencas
 * existem por causa da hero:
 *
 * 1. o canvas e pointer-events:none e os eventos chegam de um `eventTarget`
 *    externo. Sem isso a grade roubaria o arraste do objeto 3D, que fica
 *    numa camada acima;
 * 2. a malha alinha na origem em vez de centralizar, para casar com o
 *    lattice de 76px que .hero-grid ja desenha em CSS;
 * 3. o loop dorme sozinho quando nao ha nada visivel (igual ao original) e
 *    tambem quando a aba perde o foco.
 */

const FALLOFF_CURVES = {
  linear: (t) => t,
  smooth: (t) => t * t * (3 - 2 * t),
  sharp: (t) => t * t * t,
};

function hexToRgb(hex) {
  const h = hex.replace("#", "");
  const v =
    h.length === 3
      ? h
          .split("")
          .map((c) => c + c)
          .join("")
      : h;
  const num = parseInt(v.slice(0, 6), 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

export function createCursorGrid(container, options = {}) {
  const p = {
    cellSize: 70,
    color: "#5AD7FF",
    radius: 140,
    falloff: "smooth",
    holdTime: 400,
    fadeDuration: 800,
    lineWidth: 1.2,
    maxOpacity: 1,
    fillOpacity: 0,
    gridOpacity: 0,
    cellRadius: 0,
    clickPulse: true,
    pulseSpeed: 600,
    /* de onde vem pointermove/pointerdown; o canvas nao escuta nada */
    eventTarget: container,
    /* true = malha centralizada (original); false = ancorada na origem */
    centerLattice: false,
    maxPixelRatio: 1.5,
    targetFps: 60,
    ...options,
  };

  const canvas = document.createElement("canvas");
  canvas.className = "cursor-grid__canvas";
  container.appendChild(canvas);

  const ctx = canvas.getContext("2d");
  if (!ctx) return { dispose() {} };

  const dpr = Math.min(
    window.devicePixelRatio || 1,
    Math.max(0.75, p.maxPixelRatio),
  );
  const frameInterval = 1000 / Math.max(20, p.targetFps);

  /* Estado da grade: um par alpha + timestamp por celula, em row-major. */
  let cols = 0;
  let rows = 0;
  let offX = 0;
  let offY = 0;
  let alphas = new Float32Array(0);
  let touched = new Float64Array(0);
  let w = 0;
  let h = 0;
  const pulses = [];
  let raf = 0;
  let pointerRaf = 0;
  let pendingPointerX = 0;
  let pendingPointerY = 0;
  let hasPendingPointer = false;
  let running = false;
  let lastFrame = 0;
  let nextPaint = 0;
  let colorChannels = hexToRgb(p.color);

  function rebuild() {
    w = container.offsetWidth;
    h = container.offsetHeight;
    canvas.width = Math.max(1, Math.round(w * dpr));
    canvas.height = Math.max(1, Math.round(h * dpr));
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cols = Math.ceil(w / p.cellSize) + 1;
    rows = Math.ceil(h / p.cellSize) + 1;
    if (p.centerLattice) {
      offX = (w - cols * p.cellSize) / 2;
      offY = (h - rows * p.cellSize) / 2;
    } else {
      offX = 0;
      offY = 0;
    }
    alphas = new Float32Array(cols * rows);
    touched = new Float64Array(cols * rows);
  }

  function cellCenterX(i) {
    return offX + (i % cols) * p.cellSize + p.cellSize / 2;
  }

  function cellCenterY(i) {
    return offY + Math.floor(i / cols) * p.cellSize + p.cellSize / 2;
  }

  /* Acende toda celula cujo centro cai dentro do raio, com a curva de
     falloff mapeando distancia -> brilho. */
  function energize(x, y, boost) {
    const r = Math.max(p.radius, 1);
    const ease = FALLOFF_CURVES[p.falloff] ?? FALLOFF_CURVES.linear;
    const now = performance.now();
    const minCol = Math.max(0, Math.floor((x - r - offX) / p.cellSize));
    const maxCol = Math.min(cols - 1, Math.floor((x + r - offX) / p.cellSize));
    const minRow = Math.max(0, Math.floor((y - r - offY) / p.cellSize));
    const maxRow = Math.min(rows - 1, Math.floor((y + r - offY) / p.cellSize));

    for (let cRow = minRow; cRow <= maxRow; cRow++) {
      for (let cCol = minCol; cCol <= maxCol; cCol++) {
        const i = cRow * cols + cCol;
        const dist = Math.hypot(cellCenterX(i) - x, cellCenterY(i) - y);
        if (dist > r) continue;
        const level = ease(1 - dist / r) * p.maxOpacity * (boost ?? 1);
        if (level > alphas[i]) {
          alphas[i] = level;
          touched[i] = now;
        } else if (level > 0) {
          touched[i] = now;
        }
      }
    }
  }

  function draw(now) {
    if (nextPaint && now < nextPaint - 1) {
      raf = requestAnimationFrame(draw);
      return;
    }
    if (!nextPaint || now - nextPaint > frameInterval * 3) nextPaint = now;
    nextPaint += frameInterval;
    const dt = Math.min(now - lastFrame, 50);
    lastFrame = now;
    ctx.clearRect(0, 0, w, h);
    const [cr, cg, cb] = colorChannels;

    /* lattice estatico opcional */
    if (p.gridOpacity > 0) {
      ctx.strokeStyle = `rgba(${cr}, ${cg}, ${cb}, ${p.gridOpacity})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let cCol = 0; cCol <= cols; cCol++) {
        const x = Math.round(offX + cCol * p.cellSize) + 0.5;
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
      }
      for (let cRow = 0; cRow <= rows; cRow++) {
        const y = Math.round(offY + cRow * p.cellSize) + 0.5;
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
      }
      ctx.stroke();
    }

    /* pulsos de clique entregam energia as celulas conforme passam */
    for (let pi = pulses.length - 1; pi >= 0; pi--) {
      const pulse = pulses[pi];
      const age = (now - pulse.t0) / 1000;
      const ringR = age * p.pulseSpeed;
      if (ringR > Math.hypot(w, h)) {
        pulses.splice(pi, 1);
        continue;
      }
      const band = p.cellSize;
      const reach = ringR + band;
      const minCol = Math.max(0, Math.floor((pulse.x - reach - offX) / p.cellSize));
      const maxCol = Math.min(cols - 1, Math.floor((pulse.x + reach - offX) / p.cellSize));
      const minRow = Math.max(0, Math.floor((pulse.y - reach - offY) / p.cellSize));
      const maxRow = Math.min(rows - 1, Math.floor((pulse.y + reach - offY) / p.cellSize));

      for (let cRow = minRow; cRow <= maxRow; cRow++) {
        for (let cCol = minCol; cCol <= maxCol; cCol++) {
          const i = cRow * cols + cCol;
          const dist = Math.hypot(
            cellCenterX(i) - pulse.x,
            cellCenterY(i) - pulse.y,
          );
          if (Math.abs(dist - ringR) < band / 2 && p.maxOpacity > alphas[i]) {
            alphas[i] = p.maxOpacity;
            touched[i] = now;
          }
        }
      }
    }

    let anyVisible = pulses.length > 0;
    const fadeStep = dt / Math.max(p.fadeDuration, 16);
    const half = p.cellSize / 2;

    for (let i = 0; i < alphas.length; i++) {
      let a = alphas[i];
      if (a <= 0) continue;
      if (now - touched[i] > p.holdTime) {
        a = Math.max(0, a - fadeStep);
        alphas[i] = a;
        if (a <= 0) continue;
      }
      anyVisible = true;

      const cx = cellCenterX(i);
      const cy = cellCenterY(i);
      const gradient = ctx.createRadialGradient(
        cx,
        cy,
        half * 0.1,
        cx,
        cy,
        p.cellSize,
      );
      gradient.addColorStop(0, `rgba(${cr}, ${cg}, ${cb}, ${a})`);
      gradient.addColorStop(1, `rgba(${cr}, ${cg}, ${cb}, 0)`);

      const x = cx - half + 0.5;
      const y = cy - half + 0.5;
      const s = p.cellSize - 1;

      ctx.beginPath();
      if (p.cellRadius > 0 && ctx.roundRect) {
        ctx.roundRect(x, y, s, s, p.cellRadius);
      } else {
        ctx.rect(x, y, s, s);
      }
      if (p.fillOpacity > 0) {
        ctx.fillStyle = `rgba(${cr}, ${cg}, ${cb}, ${a * p.fillOpacity})`;
        ctx.fill();
      }
      ctx.strokeStyle = gradient;
      ctx.lineWidth = p.lineWidth;
      ctx.stroke();
    }

    if (anyVisible) {
      raf = requestAnimationFrame(draw);
    } else {
      running = false;
      if (p.gridOpacity <= 0) ctx.clearRect(0, 0, w, h);
    }
  }

  function wake() {
    if (running) return;
    running = true;
    lastFrame = performance.now();
    nextPaint = 0;
    raf = requestAnimationFrame(draw);
  }

  function toLocal(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    return [clientX - rect.left, clientY - rect.top];
  }

  function onPointerMove(event) {
    if (event.pointerType === "touch") return;
    pendingPointerX = event.clientX;
    pendingPointerY = event.clientY;
    hasPendingPointer = true;
    if (pointerRaf) return;
    pointerRaf = requestAnimationFrame(() => {
      pointerRaf = 0;
      if (!hasPendingPointer) return;
      const [x, y] = toLocal(pendingPointerX, pendingPointerY);
      hasPendingPointer = false;
      energize(x, y);
      wake();
    });
  }

  function onPointerDown(event) {
    if (!p.clickPulse || event.pointerType === "touch") return;
    const [x, y] = toLocal(event.clientX, event.clientY);
    pulses.push({ x, y, t0: performance.now() });
    wake();
  }

  /* aba escondida: zera a grade para nao voltar com um frame velho aceso */
  function onVisibility() {
    if (!document.hidden) return;
    alphas.fill(0);
    pulses.length = 0;
  }

  const observer = new ResizeObserver(() => {
    rebuild();
    wake();
  });
  observer.observe(container);
  rebuild();

  const target = p.eventTarget;
  target.addEventListener("pointermove", onPointerMove, { passive: true });
  target.addEventListener("pointerdown", onPointerDown, { passive: true });
  document.addEventListener("visibilitychange", onVisibility);

  return {
    setColor(value) {
      p.color = value;
      colorChannels = hexToRgb(value);
      wake();
    },
    dispose() {
      cancelAnimationFrame(raf);
      cancelAnimationFrame(pointerRaf);
      observer.disconnect();
      target.removeEventListener("pointermove", onPointerMove);
      target.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("visibilitychange", onVisibility);
      canvas.remove();
    },
  };
}
