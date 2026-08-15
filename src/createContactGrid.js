/* Campo animado da secao de contato.
 *
 * Camadas, do fundo para a frente: poeira em deriva (com profundidade),
 * estrelas, circuitos com pulsos percorrendo o traçado, riscos ocasionais,
 * duas malhas de onda e o campo do ponteiro.
 *
 * A intensidade acompanha o quanto da secao esta na tela: o campo "acorda"
 * conforme ela cobre a anterior, em vez de ja estar a todo vapor quando
 * aparece. Vem do IntersectionObserver com varios limiares — assim nao ha
 * leitura de layout a cada frame.
 */
export function createContactGrid(canvas, options = {}) {
  if (!canvas) return { dispose() {} };

  const section = canvas.closest(".contact");
  const context = canvas.getContext("2d");
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const finePointer = matchMedia("(hover: hover) and (pointer: fine)").matches;
  const detail = Math.min(1, Math.max(0.45, options.detail ?? 1));
  const maxPixelRatio = Math.max(0.75, options.maxPixelRatio ?? 1.5);
  const frameInterval = 1000 / Math.max(20, options.targetFps ?? 60);
  const pointer = {
    x: 0, y: 0, tx: 0, ty: 0,
    active: 0, targetActive: 0, speed: 0,
  };
  const pulses = [];
  const motes = [];
  const streaks = [];
  let width = 1;
  let height = 1;
  let frame = 0;
  let pointerFrame = 0;
  let pendingPointerX = 0;
  let pendingPointerY = 0;
  let hasPendingPointer = false;
  let running = false;
  let visible = false;
  let intensity = 0;
  let targetIntensity = 0;
  let lastTime = 0;
  let nextPaint = 0;
  let circuitPaths = [];

  const random = (min, max) => min + Math.random() * (max - min);

  /* Poeira em deriva. `depth` (0 = longe, 1 = perto) comanda tamanho, brilho
     e velocidade de uma vez — e o que da paralaxe sem precisar de camadas
     separadas. */
  const seedMotes = () => {
    motes.length = 0;
    const total = Math.round(
      Math.min(90, Math.max(26, (width * height) / 16000)) * detail,
    );
    for (let index = 0; index < total; index += 1) {
      const depth = Math.random();
      motes.push({
        x: Math.random() * width,
        y: Math.random() * height,
        depth,
        vx: random(-5, 13) * (0.35 + depth),
        vy: random(-7, 7) * (0.3 + depth),
        radius: 0.4 + depth * 1.3,
        phase: Math.random() * Math.PI * 2,
      });
    }
  };

  const resize = () => {
    const bounds = canvas.getBoundingClientRect();
    const ratio = Math.min(devicePixelRatio || 1, maxPixelRatio);
    width = Math.max(1, bounds.width);
    height = Math.max(1, bounds.height);
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    if (!pointer.x) {
      pointer.x = pointer.tx = width * 0.72;
      pointer.y = pointer.ty = height * 0.46;
    }
    seedMotes();
    circuitPaths = [
      [[0, height * 0.16], [width * 0.13, height * 0.45], [width * 0.06, height * 0.62], [0, height * 0.62]],
      [[width, height * 0.06], [width * 0.78, height * 0.29], [width * 0.88, height * 0.45], [width, height * 0.45]],
      [[width, height * 0.86], [width * 0.85, height * 0.86], [width * 0.76, height * 0.72], [width * 0.83, height * 0.59]],
    ].map((points) => ({ points, total: pathLength(points) }));

    /* Atribuir width/height limpa o canvas. Com movimento reduzido nao existe
       loop de rAF para repintar, entao sem este redesenho a secao ficava com
       o fundo em branco: o ResizeObserver dispara depois do primeiro render e
       apagava tudo. */
    if (reducedMotion) render(performance.now(), true);
  };

  const drawMotes = (time, delta) => {
    for (const mote of motes) {
      mote.x += mote.vx * delta;
      mote.y += mote.vy * delta;

      /* Reentra pelo lado oposto: a deriva nunca esvazia o quadro. */
      const margin = 12;
      if (mote.x < -margin) mote.x = width + margin;
      if (mote.x > width + margin) mote.x = -margin;
      if (mote.y < -margin) mote.y = height + margin;
      if (mote.y > height + margin) mote.y = -margin;

      const twinkle = 0.55 + Math.sin(time * 0.0012 + mote.phase) * 0.45;
      context.globalAlpha =
        (0.08 + mote.depth * 0.3) * twinkle * intensity;
      context.beginPath();
      context.arc(mote.x, mote.y, mote.radius, 0, Math.PI * 2);
      context.fill();
    }
    context.globalAlpha = 1;
  };

  /* Risco atravessando o quadro de vez em quando — mesmo vocabulario dos
     data-streaks da hero. Raro de proposito: e um respiro, nao um efeito. */
  const spawnStreak = () => {
    const downward = Math.random() > 0.5;
    streaks.push({
      x: random(-0.1, 0.5) * width,
      y: random(0.05, 0.95) * height,
      length: random(90, 240),
      speed: random(420, 820),
      slope: downward ? random(0.05, 0.22) : random(-0.22, -0.05),
      life: 1,
    });
    if (streaks.length > 3) streaks.shift();
  };

  const drawStreaks = (delta) => {
    for (let index = streaks.length - 1; index >= 0; index -= 1) {
      const streak = streaks[index];
      streak.x += streak.speed * delta;
      streak.y += streak.speed * streak.slope * delta;
      streak.life -= delta * 0.55;

      if (streak.life <= 0 || streak.x - streak.length > width) {
        streaks.splice(index, 1);
        continue;
      }

      const tailX = streak.x - streak.length;
      const tailY = streak.y - streak.length * streak.slope;
      const gradient = context.createLinearGradient(
        tailX, tailY, streak.x, streak.y,
      );
      const alpha = Math.max(0, streak.life) * 0.5 * intensity;
      gradient.addColorStop(0, "rgba(90, 215, 255, 0)");
      gradient.addColorStop(1, `rgba(198, 236, 255, ${alpha})`);

      context.save();
      context.strokeStyle = gradient;
      context.lineWidth = 1.1;
      context.beginPath();
      context.moveTo(tailX, tailY);
      context.lineTo(streak.x, streak.y);
      context.stroke();
      context.restore();
    }
  };

  /* Ponto sobre uma polilinha, por comprimento acumulado. E o que troca o
     salto discreto entre vertices por um percurso continuo. */
  const pathPoint = new Float32Array(2);
  const pointOnPath = (points, distance, out) => {
    let travelled = 0;
    for (let index = 1; index < points.length; index += 1) {
      const [x0, y0] = points[index - 1];
      const [x1, y1] = points[index];
      const segment = Math.hypot(x1 - x0, y1 - y0);
      if (travelled + segment >= distance) {
        const t = segment ? (distance - travelled) / segment : 0;
        out[0] = x0 + (x1 - x0) * t;
        out[1] = y0 + (y1 - y0) * t;
        return out;
      }
      travelled += segment;
    }
    const last = points[points.length - 1];
    out[0] = last[0];
    out[1] = last[1];
    return out;
  };

  const pathLength = (points) => {
    let total = 0;
    for (let index = 1; index < points.length; index += 1) {
      total += Math.hypot(
        points[index][0] - points[index - 1][0],
        points[index][1] - points[index - 1][1],
      );
    }
    return total;
  };

  const drawCircuits = (time) => {
    context.save();
    context.lineWidth = 1;
    context.strokeStyle = `rgba(154, 190, 218, ${0.13 * intensity})`;

    circuitPaths.forEach(({ points, total }, pathIndex) => {
      context.beginPath();
      points.forEach(([x, y], index) => index ? context.lineTo(x, y) : context.moveTo(x, y));
      context.stroke();

      /* Pulso percorrendo o traçado com rastro, em vez de pular de vertice
         em vertice. */
      if (!total) return;
      const head = ((time * 0.05 + pathIndex * total * 0.37) % total);

      const trailSteps = Math.max(4, Math.round(7 * detail));
      for (let step = 0; step < trailSteps; step += 1) {
        const distance = head - step * 9;
        if (distance < 0) break;
        const point = pointOnPath(points, distance, pathPoint);
        const fade = (1 - step / trailSteps) ** 2;
        context.fillStyle = `rgba(181, 217, 241, ${0.5 * fade * intensity})`;
        context.beginPath();
        context.arc(point[0], point[1], 2.2 * (0.45 + fade * 0.55), 0, Math.PI * 2);
        context.fill();
      }
    });
    context.restore();
  };

  const wavePointResult = new Float32Array(2);
  const wavePoint = (side, progress, row, time, out) => {
    const right = side === "right";
    const x = right
      ? width * 0.52 + progress * width * 0.56
      : -width * 0.08 + progress * width * 0.68;
    /* Amplitude respira devagar: a malha deixa de parecer congelada. */
    const breath = 1 + Math.sin(time * 0.00042 + (right ? 1.7 : 0)) * 0.22;
    const amplitude = height * (right ? 0.115 : 0.14) * breath;
    const base = height * (right ? 0.44 : 0.69);
    const envelope = Math.sin(progress * Math.PI);
    const phase = progress * (right ? 7.2 : 8.4) + row * 0.11 + time * 0.00092;
    let y = base + Math.sin(phase) * amplitude * envelope + row * 3.35;

    const dx = x - pointer.x;
    const dy = y - pointer.y;
    const distance = Math.hypot(dx, dy);
    const radius = Math.min(width, height) * (0.28 + pointer.speed * 0.06);
    if (distance < radius && pointer.active > 0.01) {
      const influence = (1 - distance / radius) ** 2 * pointer.active;
      y += (dy / Math.max(distance, 1)) * influence * (76 + pointer.speed * 42);
      y += Math.sin(progress * 24 + time * 0.003) * influence * 16;
    }
    out[0] = x;
    out[1] = y;
    return out;
  };

  const drawWave = (side, time) => {
    const baseLines = width < 700 ? 18 : 30;
    const baseSegments = width < 700 ? 54 : 82;
    const lines = Math.max(12, Math.round(baseLines * detail));
    const segments = Math.max(38, Math.round(baseSegments * detail));
    for (let row = -lines / 2; row < lines / 2; row += 1) {
      context.beginPath();
      for (let segment = 0; segment <= segments; segment += 1) {
        const progress = segment / segments;
        const point = wavePoint(side, progress, row, time, wavePointResult);
        segment ? context.lineTo(point[0], point[1]) : context.moveTo(point[0], point[1]);
      }
      const edgeFade = 1 - Math.abs(row) / (lines * 0.7);
      context.strokeStyle = `rgba(142, 178, 207, ${(0.045 + Math.max(0, edgeFade) * 0.095) * intensity})`;
      context.lineWidth = row % 6 === 0 ? 0.85 : 0.48;
      context.stroke();
    }

    context.fillStyle = `rgba(187, 220, 244, ${0.34 * intensity})`;
    for (let dot = 4; dot < segments; dot += 6) {
      const progress = dot / segments;
      const point = wavePoint(side, progress, Math.sin(dot) * lines * 0.35, time, wavePointResult);
      context.beginPath();
      context.arc(point[0], point[1], dot % 12 === 0 ? 1.25 : 0.7, 0, Math.PI * 2);
      context.fill();
    }
  };

  const drawStars = (time) => {
    context.fillStyle = "rgba(176, 211, 236, 0.48)";
    const starCount = Math.max(34, Math.round(58 * detail));
    for (let index = 0; index < starCount; index += 1) {
      const x = ((index * 197.3) % 997) / 997 * width;
      const y = ((index * 331.7) % 991) / 991 * height;
      const flicker = 0.55 + Math.sin(time * 0.001 + index) * 0.35;
      const distance = Math.hypot(x - pointer.x, y - pointer.y);
      const linkRadius = 155;
      if (pointer.active > 0.02 && distance < linkRadius) {
        context.save();
        context.globalAlpha = (1 - distance / linkRadius) * pointer.active * 0.38 * intensity;
        context.strokeStyle = "rgba(90, 215, 255, 0.82)";
        context.lineWidth = 0.65;
        context.beginPath();
        context.moveTo(pointer.x, pointer.y);
        context.lineTo(x, y);
        context.stroke();
        context.restore();
      }
      context.globalAlpha = flicker * intensity;
      context.beginPath();
      context.arc(x, y, index % 13 === 0 ? 1.5 : 0.7, 0, Math.PI * 2);
      context.fill();
    }
    context.globalAlpha = 1;
  };

  const drawPointerField = () => {
    if (pointer.active > 0.01) {
      context.save();
      context.strokeStyle = `rgba(90, 215, 255, ${0.28 * pointer.active})`;
      context.lineWidth = 1;
      context.beginPath();
      context.arc(pointer.x, pointer.y, 22 + pointer.speed * 13, 0, Math.PI * 2);
      context.stroke();
      context.beginPath();
      context.arc(pointer.x, pointer.y, 4, 0, Math.PI * 2);
      context.fillStyle = `rgba(220, 244, 255, ${0.72 * pointer.active})`;
      context.fill();
      context.restore();
    }

    for (let index = pulses.length - 1; index >= 0; index -= 1) {
      const pulse = pulses[index];
      pulse.radius += 2.8;
      pulse.opacity *= 0.952;
      context.strokeStyle = `rgba(90, 215, 255, ${pulse.opacity})`;
      context.lineWidth = 1.2;
      context.beginPath();
      context.arc(pulse.x, pulse.y, pulse.radius, 0, Math.PI * 2);
      context.stroke();
      if (pulse.opacity < 0.015) pulses.splice(index, 1);
    }
  };

  const render = (time = 0, force = false) => {
    if (!running && !force) return;
    if (!force && nextPaint && time < nextPaint - 1) {
      frame = requestAnimationFrame(render);
      return;
    }
    if (!force) {
      if (!nextPaint || time - nextPaint > frameInterval * 3) nextPaint = time;
      nextPaint += frameInterval;
    }
    /* Em segundos e limitado: uma aba em segundo plano volta com um salto de
       varios segundos, e a deriva teleportaria. */
    const delta = Math.min(0.05, lastTime ? (time - lastTime) / 1000 : 0.016);
    lastTime = time;

    if (visible || force) {
      pointer.x += (pointer.tx - pointer.x) * 0.075;
      pointer.y += (pointer.ty - pointer.y) * 0.075;
      pointer.active += (pointer.targetActive - pointer.active) * 0.06;
      pointer.speed *= 0.9;
      /* Com movimento reduzido cada render e avulso: a interpolacao iria
         apagando o campo a cada redesenho em vez de mante-lo aceso. */
      if (!reducedMotion) intensity += (targetIntensity - intensity) * 0.05;
      context.clearRect(0, 0, width, height);

      const glow = context.createRadialGradient(pointer.x, pointer.y, 0, pointer.x, pointer.y, Math.min(width, height) * 0.38);
      glow.addColorStop(0, `rgba(45, 113, 166, ${0.12 * pointer.active})`);
      glow.addColorStop(1, "rgba(4, 8, 14, 0)");
      context.fillStyle = glow;
      context.fillRect(0, 0, width, height);

      context.fillStyle = "rgba(196, 226, 248, 1)";
      drawMotes(time, delta);
      drawStars(time);
      drawCircuits(time);
      drawStreaks(delta);
      drawWave("left", time);
      drawWave("right", time);
      drawPointerField();

      if (!reducedMotion && intensity > 0.5 && Math.random() < 0.006) {
        spawnStreak();
      }
    }
    frame = running && !reducedMotion ? requestAnimationFrame(render) : 0;
  };

  const onPointerMove = (event) => {
    pendingPointerX = event.clientX;
    pendingPointerY = event.clientY;
    hasPendingPointer = true;
    if (pointerFrame) return;
    pointerFrame = requestAnimationFrame(() => {
      pointerFrame = 0;
      if (!hasPendingPointer) return;
      const bounds = section.getBoundingClientRect();
      const nextX = pendingPointerX - bounds.left;
      const nextY = pendingPointerY - bounds.top;
      hasPendingPointer = false;
      pointer.speed = Math.min(
        1,
        Math.hypot(nextX - pointer.tx, nextY - pointer.ty) / 42,
      );
      pointer.tx = nextX;
      pointer.ty = nextY;
      pointer.targetActive = 1;
    });
  };
  const onPointerDown = (event) => {
    const bounds = section.getBoundingClientRect();
    pulses.push({
      x: event.clientX - bounds.left,
      y: event.clientY - bounds.top,
      radius: 8,
      opacity: 0.62,
    });
    if (pulses.length > 5) pulses.shift();
  };
  const onPointerLeave = () => {
    pointer.tx = width * 0.72;
    pointer.ty = height * 0.46;
    pointer.targetActive = 0;
  };

  const resizeObserver = new ResizeObserver(resize);
  const startAnimation = () => {
    if (reducedMotion) {
      render(performance.now(), true);
      return;
    }
    if (running) return;
    running = true;
    lastTime = performance.now();
    nextPaint = 0;
    frame = requestAnimationFrame(render);
  };
  const stopAnimation = () => {
    running = false;
    cancelAnimationFrame(frame);
    frame = 0;
  };
  /* Varios limiares: `intersectionRatio` vira a intensidade, entao o campo
     acende conforme a secao sobe — sem custo por frame. */
  const visibilityObserver = new IntersectionObserver(
    ([entry]) => {
      visible = entry.isIntersecting;
      targetIntensity = entry.isIntersecting
        ? Math.min(1, entry.intersectionRatio * 1.35)
        : 0;
      if (visible) startAnimation();
      else stopAnimation();
    },
    {
      rootMargin: "120px",
      threshold: Array.from({ length: 21 }, (_, step) => step / 20),
    },
  );
  resizeObserver.observe(section);
  visibilityObserver.observe(section);
  if (finePointer && !reducedMotion) {
    section.addEventListener("pointermove", onPointerMove, { passive: true });
    section.addEventListener("pointerdown", onPointerDown, { passive: true });
    section.addEventListener("pointerleave", onPointerLeave);
  }
  /* Com movimento reduzido nao ha loop para subir a intensidade: o campo
     precisa nascer aceso, so que parado. */
  if (reducedMotion) {
    intensity = 1;
    targetIntensity = 1;
  }
  resize();

  return {
    dispose() {
      stopAnimation();
      cancelAnimationFrame(pointerFrame);
      resizeObserver.disconnect();
      visibilityObserver.disconnect();
      section.removeEventListener("pointermove", onPointerMove);
      section.removeEventListener("pointerdown", onPointerDown);
      section.removeEventListener("pointerleave", onPointerLeave);
    },
  };
}
