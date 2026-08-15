/**
 * Background animado em shader — tema "infraestrutura de dados".
 * WebGL cru num quad fullscreen: sem three.js, sem geometria, sem passes.
 * Custo = 1 draw call de 2 triangulos por frame.
 */

const VERT = `
attribute vec2 aPos;
void main(){ gl_Position = vec4(aPos, 0.0, 1.0); }
`;

const FRAG = `
precision mediump float;

uniform vec2  uRes;
uniform float uTime;
uniform float uScroll;
uniform float uIntensity;
uniform vec2  uMouse;    // mesmo espaco de uv: centrado, normalizado pela altura
uniform float uMouseAmt; // 0 = sem cursor na tela, 1 = cursor presente

// paleta BLACK ICE em 0..1: #0D1318 / #0A6C91 / #5AD7FF
const vec3 SURFACE     = vec3(0.051, 0.075, 0.094);
const vec3 ACCENT_DEEP = vec3(0.039, 0.424, 0.569);
const vec3 ACCENT      = vec3(0.353, 0.843, 1.000);

float hash(vec2 p){
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

// linhas de uma grade, com anti-aliasing por derivada
float gridLines(vec2 uv, float density, float thickness){
  vec2 grid = abs(fract(uv * density - 0.5) - 0.5);
  vec2 w = fwidth(uv * density) * thickness;
  vec2 line = 1.0 - smoothstep(vec2(0.0), w, grid);
  return max(line.x, line.y);
}

void main(){
  vec2 frag = gl_FragCoord.xy;
  vec2 uv = (frag - 0.5 * uRes) / uRes.y;
  float t = uTime;

  vec3 color = vec3(0.0);

  // ---- 0. campo de influencia do cursor ----
  vec2 toMouse = uv - uMouse;
  float mouseDist = length(toMouse);
  vec2 mouseDir = normalize(toMouse + vec2(1e-4));
  // decai rapido de proposito: o efeito e local, nao lava a tela inteira
  float mouseNear = exp(-mouseDist * mouseDist * 5.0) * uMouseAmt;

  // ---- 1. plano de dados em perspectiva (piso + teto) ----
  // o horizonte inclina de leve com o cursor: parallax sutil, sem enjoo
  float horizon = 0.02 + uMouse.y * 0.03 * uMouseAmt;
  float dist = abs(uv.y - horizon);
  vec2 planeUv = vec2(uv.x / max(dist, 0.001), 1.0 / max(dist, 0.001));
  planeUv.y += t * 0.55 + uScroll * 2.4;
  planeUv.x += uMouse.x * 0.3 * uMouseAmt;

  float plane = gridLines(planeUv, 1.0, 1.2);
  float fade = (1.0 - smoothstep(0.02, 0.62, dist)) * smoothstep(0.0, 0.05, dist);
  color += mix(ACCENT_DEEP, ACCENT, 0.35) * plane * fade * 0.34;

  // ---- 2. grade estatica de fundo (placa de circuito) ----
  // onda radial que sai do cursor e deforma a grade por onde ele passa
  float ripple = sin(mouseDist * 22.0 - t * 3.4) * exp(-mouseDist * 5.0)
               * 0.03 * uMouseAmt;
  vec2 boardUv = uv + mouseDir * ripple;
  float board = gridLines(boardUv + vec2(t * 0.006, 0.0), 9.0, 0.9);
  color += ACCENT_DEEP * board * (0.09 + mouseNear * 0.6);

  // ---- 3. pacotes de dados subindo pelas colunas ----
  float cols = 26.0;
  float colId = floor((uv.x + 2.0) * cols);
  float colRnd = hash(vec2(colId, 3.0));
  float speed = 0.22 + colRnd * 0.55;
  float packet = fract(uv.y * 0.55 - t * speed - colRnd * 7.0);
  float streak = pow(1.0 - packet, 26.0);
  float colMask = step(0.82, hash(vec2(colId, 11.0)));
  // pacotes proximos ao cursor "acordam" e ficam mais quentes
  color += ACCENT * streak * colMask * (0.5 + mouseNear * 0.9);

  // ---- 4. pulso de varredura horizontal (scan) ----
  float scanPos = fract(t * 0.055);
  float scan = exp(-pow((uv.y * 0.5 + 0.5 - scanPos) * 14.0, 2.0));
  color += ACCENT * scan * 0.055;

  // ---- 5. nebulosa lenta, quebra a regularidade da grade ----
  float neb = hash(floor(uv * 5.0 + vec2(t * 0.05, -t * 0.03)));
  color += SURFACE * neb * 0.5;

  // ---- 6. halo + anel de sonar ancorados no cursor ----
  color += mix(ACCENT_DEEP, ACCENT, 0.6)
         * exp(-mouseDist * mouseDist * 13.0) * 0.13 * uMouseAmt;
  // sem pow(): a base fica negativa dentro do anel e pow(x<0) e indefinido em GLSL
  float sonarD = (mouseDist - 0.17 - 0.02 * sin(t * 1.5)) * 26.0;
  float sonar = exp(-sonarD * sonarD);
  color += ACCENT * sonar * 0.05 * uMouseAmt;

  // ---- 7. vinheta: mantem o centro limpo pro conteudo ----
  // o "buraco" limpo acompanha o cursor de leve, como uma lente
  vec2 vigUv = uv - uMouse * 0.12 * uMouseAmt;
  float vig = 1.0 - smoothstep(0.25, 1.15, length(vigUv * vec2(0.72, 1.0)));
  color *= mix(0.35, 1.0, 1.0 - vig * 0.75);

  // scanline fina de CRT
  color *= 0.94 + 0.06 * sin(frag.y * 1.6);

  color *= uIntensity;
  gl_FragColor = vec4(color, 1.0);
}
`;

function compile(gl, type, src) {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    console.error("shader bg:", gl.getShaderInfoLog(sh));
    gl.deleteShader(sh);
    return null;
  }
  return sh;
}

export function createShaderBackground(canvas, options = {}) {
  const gl = canvas.getContext("webgl", {
    alpha: false,
    antialias: false,
    depth: false,
    stencil: false,
    powerPreference: "low-power"
  });

  // sem WebGL o site continua funcionando com o background CSS por baixo
  if (!gl) {
    canvas.style.display = "none";
    return { setScroll(){}, setPointer(){}, clearPointer(){}, tick(){}, resize(){}, dispose(){} };
  }

  // fwidth() precisa desta extensao em WebGL1
  gl.getExtension("OES_standard_derivatives");

  const vs = compile(gl, gl.VERTEX_SHADER, VERT);
  const fs = compile(gl, gl.FRAGMENT_SHADER, "#extension GL_OES_standard_derivatives : enable\n" + FRAG);
  if (!vs || !fs) {
    if (vs) gl.deleteShader(vs);
    if (fs) gl.deleteShader(fs);
    canvas.style.display = "none";
    return { setScroll(){}, setPointer(){}, clearPointer(){}, tick(){}, resize(){}, dispose(){} };
  }

  const program = gl.createProgram();
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.bindAttribLocation(program, 0, "aPos");
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error("shader bg link:", gl.getProgramInfoLog(program));
    gl.deleteProgram(program);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    canvas.style.display = "none";
    return { setScroll(){}, setPointer(){}, clearPointer(){}, tick(){}, resize(){}, dispose(){} };
  }
  gl.useProgram(program);

  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 3,-1, -1,3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

  const uRes = gl.getUniformLocation(program, "uRes");
  const uTime = gl.getUniformLocation(program, "uTime");
  const uScroll = gl.getUniformLocation(program, "uScroll");
  const uIntensity = gl.getUniformLocation(program, "uIntensity");
  const uMouse = gl.getUniformLocation(program, "uMouse");
  const uMouseAmt = gl.getUniformLocation(program, "uMouseAmt");

  // resolucao baixa de proposito: e fundo desfocado, ninguem conta pixel
  const maxRatio = options.maxPixelRatio ?? 1;
  let scroll = 0;
  let displayWidth = 1;
  let displayHeight = 1;

  /* Ponteiro: alvo cru vindo dos eventos + valor suavizado usado no shader.
     Seguir o mouse direto fica nervoso; amortecer da a sensacao de peso. */
  let targetX = 0;
  let targetY = 0;
  let currentX = 0;
  let currentY = 0;
  let targetAmt = 0;
  let currentAmt = 0;
  let prevElapsed = 0;

  const damp = (from, to, lambda, dt) =>
    to + (from - to) * Math.exp(-lambda * dt);

  function resize() {
    const ratio = Math.min(devicePixelRatio || 1, maxRatio);
    displayWidth = Math.max(1, canvas.clientWidth);
    displayHeight = Math.max(1, canvas.clientHeight);
    const w = Math.max(1, Math.floor(displayWidth * ratio));
    const h = Math.max(1, Math.floor(displayHeight * ratio));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform2f(uRes, canvas.width, canvas.height);
  }

  resize();
  gl.uniform1f(uIntensity, options.intensity ?? 1);

  return {
    setScroll(value) { scroll = value; },

    /* Recebe coordenadas de viewport (clientX/clientY). O canvas e fixed
       inset:0, entao viewport e canvas compartilham o mesmo sistema. */
    setPointer(clientX, clientY) {
      targetX = (clientX - displayWidth / 2) / displayHeight;
      targetY = 0.5 - clientY / displayHeight; // shader tem Y para cima
      targetAmt = 1;
    },

    clearPointer() { targetAmt = 0; },

    tick(elapsed) {
      const dt = Math.min(Math.max(elapsed - prevElapsed, 0), 0.05);
      prevElapsed = elapsed;

      currentX = damp(currentX, targetX, 6, dt);
      currentY = damp(currentY, targetY, 6, dt);
      // entrada mais lenta que a saida: o efeito surge, some rapido
      currentAmt = damp(currentAmt, targetAmt, targetAmt > currentAmt ? 3 : 5, dt);

      gl.uniform1f(uTime, elapsed);
      gl.uniform1f(uScroll, scroll);
      gl.uniform2f(uMouse, currentX, currentY);
      gl.uniform1f(uMouseAmt, currentAmt);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    },
    resize,
    dispose() {
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
    }
  };
}
