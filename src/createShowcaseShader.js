import {
  Geometry,
  Mesh,
  Program,
  Renderer,
  RenderTarget,
  Texture,
  Triangle,
} from "ogl";

/* Port do RippleDistortion (React Bits) para a showcase em JavaScript puro.
   A passagem de composicao foi estendida com duas texturas: a camada tecnica
   permanece visivel em repouso e o campo das ondas revela a camada de valor. */

const MAX_WAVES = 100;
const START_SCALE = 1.5;
const LIFE_CONSTANT = Math.log(500);
const QUALITY_SCALE = { low: 0.4, medium: 0.68 };

const waveVertex = /* glsl */ `
  precision highp float;

  attribute vec2 position;
  attribute vec2 uv;
  attribute vec2 iOffset;
  attribute vec2 iScale;
  attribute float iOpacity;

  varying vec2 vUv;
  varying float vOpacity;

  void main() {
    vUv = uv;
    vOpacity = iOpacity;
    gl_Position = vec4(iOffset + position * iScale, 0.0, 1.0);
  }
`;

const waveFragment = /* glsl */ `
  precision highp float;

  varying vec2 vUv;
  varying float vOpacity;
  uniform float uRings;

  const float PI = 3.141592653589793;
  const float EDGE = 0.006737947;

  void main() {
    vec2 point = vUv * 2.0 - 1.0;
    float radius = dot(point, point);
    if (radius > 1.0) discard;

    float brush = (exp(-radius * 5.0) - EDGE) / (1.0 - EDGE);
    brush *= 0.55 + 0.45 * cos(sqrt(radius) * PI * 2.0 * uRings);
    gl_FragColor = vec4(vec3(brush * vOpacity * vOpacity), 1.0);
  }
`;

const screenVertex = /* glsl */ `
  precision highp float;
  attribute vec2 position;
  attribute vec2 uv;
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = vec4(position, 0.0, 1.0);
  }
`;

const compositeFragment = /* glsl */ `
  precision highp float;

  varying vec2 vUv;

  uniform sampler2D uTechnicalTexture;
  uniform sampler2D uValueTexture;
  uniform sampler2D uDisplacement;
  uniform vec2 uResolution;
  uniform vec2 uTextureSize;
  uniform vec2 uTexel;
  uniform vec3 uTint;
  uniform vec3 uHighlight;
  uniform float uStrength;
  uniform float uSwirl;
  uniform float uDispersion;
  uniform float uGlint;
  uniform float uTintAmount;
  uniform float uStaticReveal;

  const float TAU = 6.283185307179586;

  vec2 coverUv(vec2 uv) {
    vec2 safeSize = max(uTextureSize, vec2(1.0));
    vec2 scale = uResolution / safeSize;
    vec2 scaledSize = safeSize * max(scale.x, scale.y);
    vec2 offset = (uResolution - scaledSize) * 0.5;
    return (uv * uResolution - offset) / scaledSize;
  }

  void main() {
    float amount = texture2D(uDisplacement, vUv).r;
    vec2 baseUv = coverUv(vUv);

    float theta = amount * uSwirl * TAU;
    vec2 direction = vec2(sin(theta), cos(theta));
    vec2 push = direction * amount * uStrength;

    vec3 technical = texture2D(uTechnicalTexture, baseUv + push * 0.16).rgb;
    vec3 valueColor;

    if (uDispersion > 0.001) {
      float split = uDispersion * 0.25;
      valueColor.r = texture2D(uValueTexture, baseUv + push * (1.0 + split)).r;
      valueColor.g = texture2D(uValueTexture, baseUv + push).g;
      valueColor.b = texture2D(uValueTexture, baseUv + push * (1.0 - split)).b;
    } else {
      valueColor = texture2D(uValueTexture, baseUv + push).rgb;
    }

    float reveal = max(uStaticReveal, smoothstep(0.012, 0.19, amount));
    vec3 color = mix(technical, valueColor, reveal);

    float edge = smoothstep(0.018, 0.075, amount)
      * (1.0 - smoothstep(0.16, 0.34, amount));
    color = mix(color, color * uTint * 1.75, edge * uTintAmount);

    if (uGlint > 0.001) {
      float dx = texture2D(uDisplacement, vUv + vec2(uTexel.x, 0.0)).r
        - texture2D(uDisplacement, vUv - vec2(uTexel.x, 0.0)).r;
      float dy = texture2D(uDisplacement, vUv + vec2(0.0, uTexel.y)).r
        - texture2D(uDisplacement, vUv - vec2(0.0, uTexel.y)).r;
      vec3 normal = normalize(vec3(-dx * 26.0, -dy * 26.0, 1.0));
      vec3 light = normalize(vec3(-0.35, 0.55, 1.0));
      float rawGlint = pow(max(dot(normal, light), 0.0), 22.0);
      float flatGlint = pow(max(light.z, 0.0), 22.0);
      float glint = clamp(
        (rawGlint - flatGlint) / max(1.0 - flatGlint, 0.0001),
        0.0,
        1.0
      );
      color += uHighlight * glint * uGlint;
    }

    gl_FragColor = vec4(color, 1.0);
  }
`;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const hexToRgb = (hex) => {
  const clean = hex.replace("#", "");
  const full =
    clean.length === 3
      ? clean
          .split("")
          .map((character) => character + character)
          .join("")
      : clean;
  const value = parseInt(full, 16);
  if (Number.isNaN(value)) return [1, 1, 1];
  return [
    ((value >> 16) & 255) / 255,
    ((value >> 8) & 255) / 255,
    (value & 255) / 255,
  ];
};

const roundedRect = (context, x, y, width, height, radius) => {
  context.beginPath();
  if (context.roundRect) {
    context.roundRect(x, y, width, height, radius);
  } else {
    context.rect(x, y, width, height);
  }
};

const fitTextureCanvas = (canvas, width, height, maxWidth) => {
  const scale = Math.min(1.25, maxWidth / Math.max(width, 1));
  canvas.width = Math.max(2, Math.round(width * scale));
  canvas.height = Math.max(2, Math.round(height * scale));
  const context = canvas.getContext("2d");
  context.setTransform(scale, 0, 0, scale, 0, 0);
  return context;
};

const drawGrid = (context, width, height, color, step = 52) => {
  context.save();
  context.strokeStyle = color;
  context.lineWidth = 1;
  context.beginPath();
  for (let x = step / 2; x < width; x += step) {
    context.moveTo(Math.round(x) + 0.5, 0);
    context.lineTo(Math.round(x) + 0.5, height);
  }
  for (let y = step / 2; y < height; y += step) {
    context.moveTo(0, Math.round(y) + 0.5);
    context.lineTo(width, Math.round(y) + 0.5);
  }
  context.stroke();
  context.restore();
};

const drawTechnicalCard = (context, x, y, width, height, index) => {
  context.save();
  roundedRect(context, x, y, width, height, 8);
  context.fillStyle = "rgba(5, 11, 16, 0.72)";
  context.fill();
  context.strokeStyle = "rgba(90, 215, 255, 0.16)";
  context.stroke();

  context.fillStyle = "rgba(90, 215, 255, 0.42)";
  context.font = '600 9px "Space Grotesk", Inter, sans-serif';
  context.letterSpacing = "1.2px";
  context.fillText(`NODE_0${index + 1}`, x + 14, y + 21);

  for (let line = 0; line < 3; line += 1) {
    const lineWidth = width * (0.66 - line * 0.1);
    context.fillStyle = `rgba(244, 248, 250, ${0.11 - line * 0.018})`;
    context.fillRect(x + 14, y + 38 + line * 13, lineWidth, 2);
  }

  context.fillStyle = "rgba(90, 215, 255, 0.25)";
  context.fillRect(x + 14, y + height - 19, width - 28, 1);
  context.restore();
};

const drawTechnicalLayer = (canvas, width, height, maxTextureWidth) => {
  const context = fitTextureCanvas(canvas, width, height, maxTextureWidth);
  const background = context.createRadialGradient(
    width * 0.5,
    height * 0.5,
    0,
    width * 0.5,
    height * 0.5,
    Math.max(width, height) * 0.72,
  );
  background.addColorStop(0, "#08141c");
  background.addColorStop(0.48, "#050b10");
  background.addColorStop(1, "#020406");
  context.fillStyle = background;
  context.fillRect(0, 0, width, height);

  drawGrid(
    context,
    width,
    height,
    "rgba(113, 177, 198, 0.065)",
    clamp(width / 27, 38, 58),
  );

  context.save();
  context.translate(width / 2, height / 2);
  context.strokeStyle = "rgba(90, 215, 255, 0.1)";
  context.setLineDash([6, 12]);
  [0.19, 0.3, 0.43].forEach((ratio) => {
    context.beginPath();
    context.arc(0, 0, Math.min(width, height) * ratio, 0, Math.PI * 2);
    context.stroke();
  });
  context.setLineDash([]);
  context.beginPath();
  context.moveTo(-Math.min(width, height) * 0.48, 0);
  context.lineTo(Math.min(width, height) * 0.48, 0);
  context.moveTo(0, -Math.min(width, height) * 0.48);
  context.lineTo(0, Math.min(width, height) * 0.48);
  context.stroke();
  context.restore();

  const cardWidth = clamp(width * 0.17, 118, 210);
  const cardHeight = clamp(height * 0.12, 72, 112);
  drawTechnicalCard(context, width * 0.07, height * 0.2, cardWidth, cardHeight, 0);
  drawTechnicalCard(
    context,
    width - width * 0.07 - cardWidth,
    height * 0.63,
    cardWidth,
    cardHeight,
    1,
  );
  drawTechnicalCard(
    context,
    width * 0.15,
    height - height * 0.12 - cardHeight,
    cardWidth,
    cardHeight,
    2,
  );

  context.save();
  context.strokeStyle = "rgba(90, 215, 255, 0.12)";
  context.lineWidth = 1;
  context.setLineDash([3, 8]);
  context.beginPath();
  context.moveTo(0, height * 0.34);
  context.lineTo(width * 0.23, height * 0.34);
  context.lineTo(width * 0.34, height * 0.46);
  context.moveTo(width, height * 0.27);
  context.lineTo(width * 0.78, height * 0.27);
  context.lineTo(width * 0.67, height * 0.4);
  context.moveTo(width, height * 0.82);
  context.lineTo(width * 0.73, height * 0.82);
  context.stroke();
  context.restore();

  context.fillStyle = "rgba(184, 222, 234, 0.35)";
  context.font = '600 9px "Space Grotesk", Inter, sans-serif';
  context.fillText("NEXUS / SYSTEM LAYER", 26, 35);
  context.textAlign = "right";
  context.fillText("INTERFACE BLUEPRINT_01", width - 26, height - 28);
};

const drawValueCard = (
  context,
  { x, y, width, height, accent },
) => {
  context.save();
  const fill = context.createLinearGradient(x, y, x + width, y + height);
  fill.addColorStop(0, "rgba(6, 20, 29, 0.92)");
  fill.addColorStop(1, "rgba(5, 10, 15, 0.72)");
  roundedRect(context, x, y, width, height, 12);
  context.fillStyle = fill;
  context.fill();
  context.strokeStyle = "rgba(128, 229, 255, 0.36)";
  context.lineWidth = 1;
  context.stroke();

  context.fillStyle = "rgba(222, 246, 252, 0.16)";
  context.fillRect(x + 16, y + 20, width * 0.34, 2);
  context.fillStyle = "rgba(222, 246, 252, 0.1)";
  context.fillRect(x + 16, y + 34, width * 0.58, 2);
  context.fillRect(x + 16, y + 47, width * 0.46, 2);

  const bar = context.createLinearGradient(x + 16, 0, x + width - 16, 0);
  bar.addColorStop(0, accent);
  bar.addColorStop(1, "rgba(90, 215, 255, 0)");
  context.fillStyle = bar;
  context.fillRect(x + 16, y + height - 15, width - 32, 2);
  context.restore();
};

const drawValueLayer = (canvas, width, height, maxTextureWidth) => {
  const context = fitTextureCanvas(canvas, width, height, maxTextureWidth);
  const background = context.createLinearGradient(0, 0, width, height);
  background.addColorStop(0, "#05131c");
  background.addColorStop(0.46, "#07344a");
  background.addColorStop(1, "#050b12");
  context.fillStyle = background;
  context.fillRect(0, 0, width, height);

  const glow = context.createRadialGradient(
    width * 0.52,
    height * 0.48,
    0,
    width * 0.52,
    height * 0.48,
    Math.max(width, height) * 0.55,
  );
  glow.addColorStop(0, "rgba(90, 215, 255, 0.3)");
  glow.addColorStop(0.34, "rgba(10, 108, 145, 0.19)");
  glow.addColorStop(1, "rgba(2, 6, 10, 0)");
  context.fillStyle = glow;
  context.fillRect(0, 0, width, height);

  drawGrid(
    context,
    width,
    height,
    "rgba(145, 231, 255, 0.1)",
    clamp(width / 23, 44, 68),
  );

  context.save();
  context.globalCompositeOperation = "screen";
  [
    [0.14, 0.24, 0.18, "rgba(90, 215, 255, 0.18)"],
    [0.84, 0.7, 0.2, "rgba(63, 123, 255, 0.15)"],
    [0.42, 0.88, 0.16, "rgba(120, 240, 226, 0.12)"],
  ].forEach(([x, y, radius, color]) => {
    const light = context.createRadialGradient(
      width * x,
      height * y,
      0,
      width * x,
      height * y,
      Math.min(width, height) * radius,
    );
    light.addColorStop(0, color);
    light.addColorStop(1, "rgba(0, 0, 0, 0)");
    context.fillStyle = light;
    context.fillRect(0, 0, width, height);
  });
  context.restore();

  const cardWidth = clamp(width * 0.18, 124, 220);
  const cardHeight = clamp(height * 0.13, 78, 118);
  drawValueCard(context, {
    x: width * 0.065,
    y: height * 0.19,
    width: cardWidth,
    height: cardHeight,
    accent: "#5ad7ff",
  });
  drawValueCard(context, {
    x: width - width * 0.065 - cardWidth,
    y: height * 0.62,
    width: cardWidth,
    height: cardHeight,
    accent: "#7ff8df",
  });
  drawValueCard(context, {
    x: width * 0.145,
    y: height - height * 0.12 - cardHeight,
    width: cardWidth,
    height: cardHeight,
    accent: "#69a8ff",
  });

  context.save();
  context.textAlign = "center";
  context.fillStyle = "rgba(227, 249, 255, 0.075)";
  context.font = `600 ${clamp(width * 0.072, 42, 116)}px "Space Grotesk", Inter, sans-serif`;
  context.fillText("VALOR", width * 0.5, height * 0.56);
  context.fillStyle = "rgba(190, 238, 250, 0.42)";
  context.font = '600 9px "Space Grotesk", Inter, sans-serif';
  context.fillText(
    "CLAREZA  •  CONFIANÇA  •  RESULTADO",
    width * 0.5,
    height * 0.66,
  );
  context.restore();
};

export function createShowcaseShader(section, options = {}) {
  const canvas = section?.querySelector(".showcase-shader");
  if (!section || !canvas) return null;

  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const finePointer = matchMedia("(hover: hover) and (pointer: fine)").matches;
  const quality = finePointer ? "medium" : "low";
  const qualityScale = Math.min(
    0.75,
    Math.max(0.28, options.qualityScale ?? QUALITY_SCALE[quality]),
  );
  const maxTextureWidth =
    options.maxTextureWidth ?? (qualityScale >= 0.6 ? 1440 : 900);
  const maxWaves = Math.max(32, Math.min(MAX_WAVES, options.maxWaves ?? MAX_WAVES));
  const frameInterval = 1000 / Math.max(20, options.targetFps ?? 60);
  const brushSize = finePointer ? 174 : 142;
  const spread = 4.6;
  const fade = 2.45;
  const spacing = finePointer ? 12 : 18;

  let renderer;
  try {
    renderer = new Renderer({
      canvas,
      alpha: false,
      antialias: false,
      depth: false,
      dpr: Math.min(
        devicePixelRatio || 1,
        options.maxPixelRatio ?? (finePointer ? 1.5 : 1.15),
      ),
      powerPreference: options.lowPower ? "low-power" : "high-performance",
    });
    if (!renderer.gl) throw new Error("WebGL indisponível");
  } catch (error) {
    console.warn("RippleDistortion fallback:", error);
    section.classList.add("showcase-ripple-fallback");
    return {
      destroy() {
        section.classList.remove("showcase-ripple-fallback");
      },
    };
  }

  const gl = renderer.gl;
  gl.clearColor(0.008, 0.016, 0.023, 1);
  section.classList.add("has-ripple-distortion");

  const technicalCanvas = document.createElement("canvas");
  const valueCanvas = document.createElement("canvas");
  const technicalTexture = new Texture(gl, {
    image: technicalCanvas,
    generateMipmaps: false,
    minFilter: gl.LINEAR,
    magFilter: gl.LINEAR,
    wrapS: gl.CLAMP_TO_EDGE,
    wrapT: gl.CLAMP_TO_EDGE,
  });
  const valueTexture = new Texture(gl, {
    image: valueCanvas,
    generateMipmaps: false,
    minFilter: gl.LINEAR,
    magFilter: gl.LINEAR,
    wrapS: gl.CLAMP_TO_EDGE,
    wrapT: gl.CLAMP_TO_EDGE,
  });

  const offsets = new Float32Array(maxWaves * 2);
  const scales = new Float32Array(maxWaves * 2);
  const opacities = new Float32Array(maxWaves);
  const waves = Array.from({ length: maxWaves }, () => ({
    x: 0,
    y: 0,
    scale: START_SCALE,
    target: START_SCALE,
    size: 1,
    opacity: 0,
  }));
  let currentWave = 0;

  const waveGeometry = new Geometry(gl, {
    position: {
      size: 2,
      data: new Float32Array([
        -1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1,
      ]),
    },
    uv: {
      size: 2,
      data: new Float32Array([0, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 1]),
    },
    iOffset: { instanced: 1, size: 2, data: offsets },
    iScale: { instanced: 1, size: 2, data: scales },
    iOpacity: { instanced: 1, size: 1, data: opacities },
  });
  const waveUniforms = { uRings: { value: 3.6 } };
  const waveProgram = new Program(gl, {
    vertex: waveVertex,
    fragment: waveFragment,
    uniforms: waveUniforms,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    cullFace: false,
  });
  waveProgram.setBlendFunc(gl.ONE, gl.ONE);
  const waveMesh = new Mesh(gl, {
    geometry: waveGeometry,
    program: waveProgram,
    frustumCulled: false,
  });

  const displacementTarget = new RenderTarget(gl, {
    width: 2,
    height: 2,
    depth: false,
    minFilter: gl.LINEAR,
    magFilter: gl.LINEAR,
    wrapS: gl.CLAMP_TO_EDGE,
    wrapT: gl.CLAMP_TO_EDGE,
  });

  const compositeUniforms = {
    uTechnicalTexture: { value: technicalTexture },
    uValueTexture: { value: valueTexture },
    uDisplacement: { value: displacementTarget.texture },
    uResolution: { value: [1, 1] },
    uTextureSize: { value: [1, 1] },
    uTexel: { value: [1, 1] },
    uTint: { value: hexToRgb("#5ad7ff") },
    uHighlight: { value: hexToRgb("#dffaff") },
    uStrength: { value: 0.16 },
    uSwirl: { value: 0.72 },
    uDispersion: { value: 0.12 },
    uGlint: { value: 0.38 },
    uTintAmount: { value: 0.72 },
    uStaticReveal: { value: reducedMotion ? 0.72 : 0 },
  };
  const compositeMesh = new Mesh(gl, {
    geometry: new Triangle(gl),
    program: new Program(gl, {
      vertex: screenVertex,
      fragment: compositeFragment,
      uniforms: compositeUniforms,
      depthTest: false,
      depthWrite: false,
    }),
  });

  let width = 1;
  let height = 1;
  let visible = false;
  let intersecting = false;
  let transitionActive = false;
  let disposed = false;
  let animationFrame = 0;
  let lastFrameTime = 0;
  let nextPaint = 0;
  let previousX = -1000;
  let previousY = -1000;
  let lastInteraction = -Infinity;
  let interactionHold = 320;
  let panelPresence = reducedMotion ? 1 : 0;

  const updatePanelPosition = (x, y) => {
    section.style.setProperty("--ripple-x", `${x.toFixed(1)}px`);
    section.style.setProperty("--ripple-y", `${y.toFixed(1)}px`);
  };

  const localPoint = (clientX, clientY) => {
    const bounds = section.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return null;
    if (
      clientX < bounds.left ||
      clientX > bounds.right ||
      clientY < bounds.top ||
      clientY > bounds.bottom
    ) {
      return null;
    }
    const x = clientX - bounds.left;
    const yFromTop = clientY - bounds.top;
    updatePanelPosition(x, yFromTop);
    return [x, bounds.height - yFromTop];
  };

  const setNewWave = (x, y, power = 1, sizeMultiplier = 1) => {
    const wave = waves[currentWave];
    currentWave = (currentWave + 1) % maxWaves;
    wave.x = x;
    wave.y = y;
    wave.scale = START_SCALE * power;
    wave.target = START_SCALE * spread * power;
    wave.size = brushSize * sizeMultiplier;
    wave.opacity = 1;
    lastInteraction = performance.now();
    section.classList.add("is-ripple-engaged");
  };

  const ensureRender = () => {
    if (!visible || disposed || reducedMotion || animationFrame) return;
    lastFrameTime = performance.now();
    animationFrame = requestAnimationFrame(renderFrame);
  };

  const renderFrame = (now) => {
    animationFrame = 0;
    if (!visible || disposed) return;
    if (!reducedMotion && nextPaint && now < nextPaint - 1) {
      animationFrame = requestAnimationFrame(renderFrame);
      return;
    }
    if (!reducedMotion) {
      if (!nextPaint || now - nextPaint > frameInterval * 3) nextPaint = now;
      nextPaint += frameInterval;
    }

    const delta = lastFrameTime
      ? Math.min(0.05, Math.max(0, (now - lastFrameTime) / 1000))
      : 0;
    lastFrameTime = now;
    const growth = reducedMotion ? 0 : 1 - Math.exp(-delta * 1.09);
    const decay = reducedMotion
      ? 0
      : Math.exp((-delta * LIFE_CONSTANT) / Math.max(0.15, fade));
    let hasActiveWave = false;

    for (let index = 0; index < maxWaves; index += 1) {
      const wave = waves[index];
      if (wave.opacity <= 0) {
        opacities[index] = 0;
        continue;
      }

      wave.opacity *= decay;
      wave.scale += (wave.target - wave.scale) * growth;
      if (wave.opacity < 0.002) {
        wave.opacity = 0;
        opacities[index] = 0;
        continue;
      }

      hasActiveWave = true;
      const halfSize = (wave.scale * wave.size) / 2;
      offsets[index * 2] = (wave.x / width) * 2 - 1;
      offsets[index * 2 + 1] = (wave.y / height) * 2 - 1;
      scales[index * 2] = (halfSize / width) * 2;
      scales[index * 2 + 1] = (halfSize / height) * 2;
      opacities[index] = wave.opacity;
    }

    waveGeometry.attributes.iOffset.needsUpdate = true;
    waveGeometry.attributes.iScale.needsUpdate = true;
    waveGeometry.attributes.iOpacity.needsUpdate = true;

    const targetPresence =
      reducedMotion || now - lastInteraction < interactionHold ? 1 : 0;
    const presenceSpeed = targetPresence > panelPresence ? 11 : 2.15;
    panelPresence +=
      (targetPresence - panelPresence) *
      (1 - Math.exp(-Math.max(delta, 0.016) * presenceSpeed));
    section.style.setProperty(
      "--ripple-presence",
      clamp(panelPresence, 0, 1).toFixed(3),
    );

    renderer.render({ scene: waveMesh, target: displacementTarget, clear: true });
    renderer.render({ scene: compositeMesh });

    if (
      !reducedMotion &&
      (hasActiveWave || panelPresence > 0.002 || targetPresence > 0)
    ) {
      animationFrame = requestAnimationFrame(renderFrame);
    }
  };

  const resetField = () => {
    waves.forEach((wave) => {
      wave.opacity = 0;
    });
    opacities.fill(0);
    panelPresence = 0;
    section.style.setProperty("--ripple-presence", "0");
  };

  /* A showcase tambem deve renderizar enquanto ainda esta atras da transicao.
     O IntersectionObserver sozinho so a ativava depois de ela entrar na tela. */
  const syncVisibility = () => {
    const nextVisible = intersecting || transitionActive;
    if (nextVisible === visible) {
      if (visible) ensureRender();
      return;
    }

    visible = nextVisible;
    cancelAnimationFrame(animationFrame);
    animationFrame = 0;

    if (visible) {
      lastFrameTime = performance.now();
      nextPaint = 0;
      if (reducedMotion) renderFrame(lastFrameTime);
      else animationFrame = requestAnimationFrame(renderFrame);
    } else {
      resetField();
    }
  };

  const resize = () => {
    const bounds = section.getBoundingClientRect();
    width = Math.max(1, bounds.width);
    height = Math.max(1, bounds.height);
    renderer.setSize(width, height);
    compositeUniforms.uResolution.value = [width, height];

    const fieldWidth = Math.max(2, Math.round(width * qualityScale));
    const fieldHeight = Math.max(2, Math.round(height * qualityScale));
    displacementTarget.setSize(fieldWidth, fieldHeight);
    compositeUniforms.uTexel.value = [1 / fieldWidth, 1 / fieldHeight];

    drawTechnicalLayer(technicalCanvas, width, height, maxTextureWidth);
    drawValueLayer(valueCanvas, width, height, maxTextureWidth);
    technicalTexture.needsUpdate = true;
    valueTexture.needsUpdate = true;
    compositeUniforms.uTextureSize.value = [
      technicalCanvas.width,
      technicalCanvas.height,
    ];

    if (visible) {
      if (reducedMotion) renderFrame(performance.now());
      else ensureRender();
    }
  };

  /* --- Arraste no touch ---------------------------------------------------
     Sem isto, o toque gerava UM pulso e acabava: pointermove ignorava touch
     e o navegador tomava o gesto para rolar (touch-action: pan-y). O padrao
     aqui e SEGURAR E ARRASTAR: um press parado por TOUCH_HOLD_MS — ou um
     arrasto horizontal imediato, que o pan-y nunca reivindicaria — engata o
     modo pintura. Engatado, o touchmove e cancelado (listener nao-passivo)
     para o scroll nao roubar o gesto, e o dedo pinta ondas como o mouse.
     Movimento vertical cedo demais e intencao de rolar: o gesto segue para
     o navegador intocado. */
  const TOUCH_HOLD_MS = 160;
  const TOUCH_SLOP_PX = 12;
  let touchPointerId = null;
  let touchEngaged = false;
  let touchStartX = 0;
  let touchStartY = 0;
  let touchHoldTimer = 0;

  const engageTouch = () => {
    if (touchPointerId === null || touchEngaged) return;
    touchEngaged = true;
    clearTimeout(touchHoldTimer);
    touchHoldTimer = 0;
    section.classList.add("is-ripple-dragging");
    const point = localPoint(touchStartX, touchStartY);
    if (point) {
      interactionHold = 900;
      setNewWave(point[0], point[1], 1.35, 1.1);
      previousX = point[0];
      previousY = point[1];
      ensureRender();
    }
  };

  const releaseTouch = () => {
    clearTimeout(touchHoldTimer);
    touchHoldTimer = 0;
    touchPointerId = null;
    touchEngaged = false;
    section.classList.remove("is-ripple-dragging");
  };

  const onPointerMove = (event) => {
    if (reducedMotion) return;
    if (event.pointerType === "touch") {
      if (!touchEngaged || event.pointerId !== touchPointerId) return;
    }
    const point = localPoint(event.clientX, event.clientY);
    if (!point) return;
    if (
      Math.abs(point[0] - previousX) > spacing ||
      Math.abs(point[1] - previousY) > spacing
    ) {
      interactionHold = event.pointerType === "touch" ? 700 : 360;
      setNewWave(point[0], point[1]);
      previousX = point[0];
      previousY = point[1];
      ensureRender();
    }
  };

  const onPointerDown = (event) => {
    if (reducedMotion) return;
    const point = localPoint(event.clientX, event.clientY);
    if (!point) return;
    const isTouch = event.pointerType === "touch";
    interactionHold = isTouch ? 1050 : 620;
    setNewWave(point[0], point[1], isTouch ? 1.5 : 1.24, isTouch ? 1.18 : 1);
    ensureRender();

    if (isTouch) {
      touchPointerId = event.pointerId;
      touchEngaged = false;
      touchStartX = event.clientX;
      touchStartY = event.clientY;
      clearTimeout(touchHoldTimer);
      touchHoldTimer = setTimeout(engageTouch, TOUCH_HOLD_MS);
    }
  };

  const onPointerUp = (event) => {
    if (event.pointerType === "touch") releaseTouch();
  };

  const onTouchMove = (event) => {
    if (touchEngaged) {
      /* Dono do gesto: sem isto o navegador iniciaria o pan e cortaria os
         pointermoves com um pointercancel. */
      event.preventDefault();
      return;
    }
    if (!touchHoldTimer) return;
    const touch = event.touches[0];
    if (!touch) return;
    const dx = touch.clientX - touchStartX;
    const dy = touch.clientY - touchStartY;
    if (Math.hypot(dx, dy) <= TOUCH_SLOP_PX) return;
    /* Decisao do gesto: horizontal e nosso (pan-y nunca o reivindicaria),
       vertical e scroll do navegador. */
    if (Math.abs(dx) > Math.abs(dy) * 1.2) {
      engageTouch();
      event.preventDefault();
    } else {
      releaseTouch();
    }
  };

  const onPointerLeave = () => {
    previousX = -1000;
    previousY = -1000;
    interactionHold = 180;
    releaseTouch();
  };

  /* A abertura da marca termina no mesmo campo de ondas usado pela showcase.
     Os aneis fazem o impacto atravessar a troca de secoes. */
  const onBrandPortalBurst = () => {
    if (reducedMotion || disposed) return;
    transitionActive = true;
    syncVisibility();
    const x = width / 2;
    const y = height / 2;
    updatePanelPosition(x, y);
    interactionHold = 1050;
    [1.25, 1.55, 1.9].forEach((power, index) => {
      setNewWave(x, y, power, 1 + index * 0.12);
    });
    ensureRender();
  };

  const onShowcaseTransition = (event) => {
    transitionActive = Boolean(event.detail?.active);
    syncVisibility();
  };

  const observer = new IntersectionObserver(
    ([entry]) => {
      intersecting = entry.isIntersecting;
      syncVisibility();
    },
    { rootMargin: "120px" },
  );
  observer.observe(section);

  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(section);
  section.addEventListener("pointermove", onPointerMove, { passive: true });
  section.addEventListener("pointerdown", onPointerDown, { passive: true });
  section.addEventListener("pointerup", onPointerUp, { passive: true });
  section.addEventListener("pointercancel", onPointerUp, { passive: true });
  section.addEventListener("pointerleave", onPointerLeave, { passive: true });
  /* Nao-passivo de proposito: e o preventDefault daqui que segura o scroll
     enquanto o dedo pinta. */
  section.addEventListener("touchmove", onTouchMove, { passive: false });
  section.addEventListener("nexus:brand-portal-burst", onBrandPortalBurst);
  section.addEventListener("nexus:showcase-transition", onShowcaseTransition);
  resize();

  return {
    destroy() {
      disposed = true;
      visible = false;
      intersecting = false;
      transitionActive = false;
      cancelAnimationFrame(animationFrame);
      observer.disconnect();
      resizeObserver.disconnect();
      releaseTouch();
      section.removeEventListener("pointermove", onPointerMove);
      section.removeEventListener("pointerdown", onPointerDown);
      section.removeEventListener("pointerup", onPointerUp);
      section.removeEventListener("pointercancel", onPointerUp);
      section.removeEventListener("pointerleave", onPointerLeave);
      section.removeEventListener("touchmove", onTouchMove);
      section.removeEventListener("nexus:brand-portal-burst", onBrandPortalBurst);
      section.removeEventListener("nexus:showcase-transition", onShowcaseTransition);
      section.classList.remove("has-ripple-distortion", "is-ripple-engaged");
      section.style.removeProperty("--ripple-x");
      section.style.removeProperty("--ripple-y");
      section.style.removeProperty("--ripple-presence");
      const loseContext = gl.getExtension("WEBGL_lose_context");
      loseContext?.loseContext();
    },
  };
}
