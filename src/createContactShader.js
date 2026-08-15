const MAX_PULSES = 12;

const VERTEX_SHADER = `
attribute vec2 aPosition;

void main() {
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
`;

const FRAGMENT_SHADER = `
precision highp float;

#define MAX_PULSES 12

uniform vec2 uResolution;
uniform float uTime;
uniform vec2 uPointer;
uniform float uPointerEnergy;
uniform vec4 uPulses[MAX_PULSES];

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float valueNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);

  return mix(
    mix(hash21(i), hash21(i + vec2(1.0, 0.0)), f.x),
    mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0)), f.x),
    f.y
  );
}

float fbm(vec2 p) {
  float value = 0.0;
  float amplitude = 0.52;
  mat2 turn = mat2(0.82, -0.57, 0.57, 0.82);

  for (int i = 0; i < 5; i++) {
    value += valueNoise(p) * amplitude;
    p = turn * p * 2.03 + vec2(9.7, 4.1);
    amplitude *= 0.49;
  }
  return value;
}

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution;
  vec2 p = (gl_FragCoord.xy * 2.0 - uResolution) / min(uResolution.x, uResolution.y);
  vec2 pointer = (uPointer * uResolution * 2.0 - uResolution) /
    min(uResolution.x, uResolution.y);

  float time = uTime * 0.18;
  vec2 delta = p - pointer;
  float pointerDistance = length(delta);
  float pointerField = exp(-pointerDistance * 2.55) * uPointerEnergy;
  vec2 tangent = vec2(-delta.y, delta.x) / max(pointerDistance, 0.035);

  vec2 warped = p;
  warped += tangent * pointerField * (0.12 + 0.045 * sin(uTime * 1.7));
  warped -= delta * pointerField * 0.045;

  float pulseLight = 0.0;
  float trailLight = 0.0;

  for (int i = 0; i < MAX_PULSES; i++) {
    vec4 pulse = uPulses[i];
    float life = clamp(1.0 - pulse.z / 3.15, 0.0, 1.0) * pulse.w;
    vec2 pulsePosition = (pulse.xy * uResolution * 2.0 - uResolution) /
      min(uResolution.x, uResolution.y);
    vec2 fromPulse = warped - pulsePosition;
    float distanceToPulse = length(fromPulse);
    float radius = pulse.z * (0.2 + pulse.w * 0.035);
    float ring = exp(-abs(distanceToPulse - radius) * 34.0) * life;
    float wake = exp(-distanceToPulse * 4.8) * life;

    warped += fromPulse / max(distanceToPulse, 0.04) * ring * 0.034;
    pulseLight += ring;
    trailLight += wake;
  }

  float broadNoise = fbm(warped * 1.42 + vec2(time * 0.72, -time * 0.31));
  float detailNoise = fbm(warped * 3.1 - vec2(time * 0.24, time * 0.46));
  float current = sin(
    warped.x * 3.8 - warped.y * 2.15 +
    broadNoise * 5.4 - time * 4.1
  );
  float ribbon = pow(clamp(1.0 - abs(current) * 0.86, 0.0, 1.0), 7.0);
  float secondary = pow(
    clamp(1.0 - abs(sin(warped.y * 5.1 + broadNoise * 3.7 + time * 2.2)), 0.0, 1.0),
    11.0
  );

  vec2 gridUv = warped * vec2(8.0, 6.0);
  vec2 gridCell = abs(fract(gridUv) - 0.5);
  float grid = 1.0 - smoothstep(0.468, 0.498, max(gridCell.x, gridCell.y));
  grid *= 0.12 + detailNoise * 0.16;

  vec3 deep = vec3(0.006, 0.018, 0.032);
  vec3 blue = vec3(0.035, 0.35, 0.52);
  vec3 cyan = vec3(0.35, 0.88, 1.0);
  vec3 violet = vec3(0.24, 0.18, 0.54);

  float atmosphere = smoothstep(0.18, 0.88, broadNoise);
  vec3 color = deep + mix(vec3(0.008, 0.045, 0.075), violet * 0.18, atmosphere);
  color += blue * ribbon * (0.2 + detailNoise * 0.48);
  color += cyan * secondary * 0.12;
  color += cyan * grid;
  color += mix(blue, cyan, 0.72) * pulseLight * 0.52;
  color += violet * trailLight * 0.2;
  color += cyan * pointerField * (0.055 + ribbon * 0.2);

  float vignette = 1.0 - smoothstep(0.2, 1.48, length(p * vec2(0.72, 0.9)));
  color *= 0.46 + vignette * 0.76;
  color += vec3(0.008, 0.025, 0.04) * (hash21(gl_FragCoord.xy + uTime) - 0.5);

  gl_FragColor = vec4(color, 1.0);
}
`;

function compileShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const message = gl.getShaderInfoLog(shader) || "Falha ao compilar shader";
    gl.deleteShader(shader);
    throw new Error(message);
  }
  return shader;
}

function createProgram(gl) {
  const vertex = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
  const fragment = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
  const program = gl.createProgram();

  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const message = gl.getProgramInfoLog(program) || "Falha ao conectar shader";
    gl.deleteProgram(program);
    throw new Error(message);
  }
  return program;
}

const isFormControl = (target) =>
  target instanceof Element &&
  Boolean(target.closest("input, textarea, select, button, a, label"));

/**
 * Campo de fluxos luminosos exclusivo do contato. Mouse altera o vortice em
 * hover e deixa pulsos durante o clique/arraste; touch e caneta usam a area
 * visual dedicada, que captura o gesto sem bloquear os controles do formulario.
 */
export function createContactShader(section, options = {}) {
  const canvas = section?.querySelector(".contact-shader");
  const interactionZone = section?.querySelector("[data-contact-interaction]");
  if (!section || !canvas || !interactionZone) return { destroy() {} };

  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const finePointer = matchMedia("(hover: hover) and (pointer: fine)").matches;
  const maxPixelRatio = Math.max(0.75, options.maxPixelRatio ?? 1.4);
  const qualityScale = Math.max(0.42, Math.min(1, options.qualityScale ?? 0.72));
  const targetFps = reducedMotion ? 20 : Math.max(24, options.targetFps ?? 60);
  const frameInterval = 1000 / targetFps;

  const gl = canvas.getContext("webgl", {
    alpha: false,
    antialias: false,
    depth: false,
    stencil: false,
    powerPreference: options.lowPower ? "low-power" : "high-performance",
  });

  if (!gl) {
    section.classList.add("contact-shader-fallback");
    return {
      destroy() {
        section.classList.remove("contact-shader-fallback");
      },
    };
  }

  let program;
  try {
    program = createProgram(gl);
  } catch (error) {
    console.warn("Contact shader:", error);
    section.classList.add("contact-shader-fallback");
    return {
      destroy() {
        section.classList.remove("contact-shader-fallback");
      },
    };
  }

  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
    gl.STATIC_DRAW,
  );

  const positionLocation = gl.getAttribLocation(program, "aPosition");
  const uniforms = {
    resolution: gl.getUniformLocation(program, "uResolution"),
    time: gl.getUniformLocation(program, "uTime"),
    pointer: gl.getUniformLocation(program, "uPointer"),
    pointerEnergy: gl.getUniformLocation(program, "uPointerEnergy"),
    pulses: gl.getUniformLocation(program, "uPulses[0]"),
  };

  gl.useProgram(program);
  gl.enableVertexAttribArray(positionLocation);
  gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

  const pointer = { x: 0.7, y: 0.5, tx: 0.7, ty: 0.5, energy: 0.14, target: 0.14 };
  const pulses = Array.from({ length: MAX_PULSES }, () => ({
    x: 0.5,
    y: 0.5,
    age: 99,
    strength: 0,
  }));
  const pulseData = new Float32Array(MAX_PULSES * 4);

  let pulseIndex = 0;
  let activePointerId = null;
  let lastPulseX = pointer.x;
  let lastPulseY = pointer.y;
  let lastPulseAt = 0;
  let lastFrameAt = 0;
  let elapsed = 0;
  let animationFrame = 0;
  let resizeFrame = 0;
  let inView = false;
  let transitionActive = false;
  let destroyed = false;

  const resize = () => {
    resizeFrame = 0;
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(devicePixelRatio || 1, maxPixelRatio) * qualityScale;
    const width = Math.max(2, Math.round(rect.width * dpr));
    const height = Math.max(2, Math.round(rect.height * dpr));

    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
      gl.viewport(0, 0, width, height);
    }
  };

  const scheduleResize = () => {
    if (resizeFrame) return;
    resizeFrame = requestAnimationFrame(resize);
  };

  const pushPulse = (x, y, strength = 0.72) => {
    const pulse = pulses[pulseIndex];
    pulse.x = x;
    pulse.y = y;
    pulse.age = 0;
    pulse.strength = strength;
    pulseIndex = (pulseIndex + 1) % MAX_PULSES;
  };

  const pointFromEvent = (event) => {
    const rect = canvas.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(1, (event.clientX - rect.left) / Math.max(1, rect.width))),
      y: Math.max(0, Math.min(1, 1 - (event.clientY - rect.top) / Math.max(1, rect.height))),
    };
  };

  const updatePointer = (event, leaveTrail = false) => {
    const point = pointFromEvent(event);
    pointer.tx = point.x;
    pointer.ty = point.y;
    pointer.target = 1;

    const now = performance.now();
    const distance = Math.hypot(point.x - lastPulseX, point.y - lastPulseY);
    const enoughDistance = distance > (leaveTrail ? 0.014 : 0.055);
    const enoughTime = now - lastPulseAt > (leaveTrail ? 34 : 95);

    if (enoughDistance && enoughTime) {
      pushPulse(point.x, point.y, leaveTrail ? 0.9 : 0.34);
      lastPulseX = point.x;
      lastPulseY = point.y;
      lastPulseAt = now;
    }
  };

  const onPointerDown = (event) => {
    const touchLike = event.pointerType === "touch" || event.pointerType === "pen";
    if (touchLike && !interactionZone.contains(event.target)) return;
    if (!touchLike && isFormControl(event.target)) return;

    activePointerId = event.pointerId;
    updatePointer(event, true);
    pushPulse(pointer.tx, pointer.ty, 1.2);
    section.classList.add("is-contact-engaged", "is-contact-dragging");

    try {
      section.setPointerCapture(event.pointerId);
    } catch {
      /* Captura e um aprimoramento: o shader continua seguindo sem ela. */
    }
  };

  const onPointerMove = (event) => {
    if (event.pointerType === "touch" || event.pointerType === "pen") {
      if (event.pointerId !== activePointerId) return;
      updatePointer(event, true);
      return;
    }

    updatePointer(event, event.pointerId === activePointerId || event.buttons > 0);
    section.classList.add("is-contact-engaged");
  };

  const endPointer = (event) => {
    if (event.pointerId !== activePointerId) return;
    activePointerId = null;
    pointer.target = finePointer ? 0.48 : 0.16;
    section.classList.remove("is-contact-dragging");

    if (section.hasPointerCapture?.(event.pointerId)) {
      section.releasePointerCapture(event.pointerId);
    }
  };

  const onPointerLeave = (event) => {
    if (event.pointerType === "touch" || activePointerId !== null) return;
    pointer.target = 0.12;
    section.classList.remove("is-contact-engaged");
  };

  const onTransition = (event) => {
    transitionActive = Boolean(event.detail?.active);
    if (transitionActive) start();
  };

  const onPortalBurst = () => {
    pointer.tx = 0.5;
    pointer.ty = 0.5;
    pointer.target = 1;
    pushPulse(0.5, 0.5, 1.45);
    pushPulse(0.5, 0.5, 0.95);
    start();
  };

  const render = (now) => {
    animationFrame = 0;
    if (destroyed || (!inView && !transitionActive)) return;

    if (now - lastFrameAt < frameInterval) {
      animationFrame = requestAnimationFrame(render);
      return;
    }

    const delta = Math.min(0.05, Math.max(0.001, (now - (lastFrameAt || now - 16)) / 1000));
    lastFrameAt = now;
    elapsed += delta * (reducedMotion ? 0.16 : 1);

    pointer.x += (pointer.tx - pointer.x) * 0.09;
    pointer.y += (pointer.ty - pointer.y) * 0.09;
    pointer.energy += (pointer.target - pointer.energy) * 0.075;

    pulses.forEach((pulse, index) => {
      pulse.age += delta;
      const offset = index * 4;
      pulseData[offset] = pulse.x;
      pulseData[offset + 1] = pulse.y;
      pulseData[offset + 2] = pulse.age;
      pulseData[offset + 3] = pulse.strength;
    });

    gl.useProgram(program);
    gl.uniform2f(uniforms.resolution, canvas.width, canvas.height);
    gl.uniform1f(uniforms.time, elapsed);
    gl.uniform2f(uniforms.pointer, pointer.x, pointer.y);
    gl.uniform1f(uniforms.pointerEnergy, pointer.energy);
    gl.uniform4fv(uniforms.pulses, pulseData);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    animationFrame = requestAnimationFrame(render);
  };

  function start() {
    if (!animationFrame && !destroyed) animationFrame = requestAnimationFrame(render);
  }

  const visibilityObserver = new IntersectionObserver(
    ([entry]) => {
      inView = entry.isIntersecting;
      if (inView) start();
    },
    { rootMargin: "180px 0px" },
  );
  visibilityObserver.observe(section);

  const resizeObserver = "ResizeObserver" in window ? new ResizeObserver(scheduleResize) : null;
  resizeObserver?.observe(section);

  section.addEventListener("pointerdown", onPointerDown);
  section.addEventListener("pointermove", onPointerMove, { passive: true });
  section.addEventListener("pointerup", endPointer, { passive: true });
  section.addEventListener("pointercancel", endPointer, { passive: true });
  section.addEventListener("pointerleave", onPointerLeave, { passive: true });
  section.addEventListener("nexus:section-transition", onTransition);
  section.addEventListener("nexus:brand-portal-burst", onPortalBurst);
  window.addEventListener("resize", scheduleResize, { passive: true });

  resize();
  pushPulse(0.7, 0.5, 0.5);
  start();

  return {
    destroy() {
      destroyed = true;
      cancelAnimationFrame(animationFrame);
      cancelAnimationFrame(resizeFrame);
      visibilityObserver.disconnect();
      resizeObserver?.disconnect();
      section.removeEventListener("pointerdown", onPointerDown);
      section.removeEventListener("pointermove", onPointerMove);
      section.removeEventListener("pointerup", endPointer);
      section.removeEventListener("pointercancel", endPointer);
      section.removeEventListener("pointerleave", onPointerLeave);
      section.removeEventListener("nexus:section-transition", onTransition);
      section.removeEventListener("nexus:brand-portal-burst", onPortalBurst);
      window.removeEventListener("resize", scheduleResize);
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
      section.classList.remove(
        "is-contact-engaged",
        "is-contact-dragging",
        "contact-shader-fallback",
      );
    },
  };
}
