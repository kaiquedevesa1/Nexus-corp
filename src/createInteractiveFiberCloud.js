import * as THREE from "three";

const vertexShader = `
uniform float uTime;
uniform vec3 uPointer;
uniform float uPointerStrength;
uniform float uInteractionRadius;
uniform float uPointSize;
uniform float uPixelRatio;
uniform float uMorph;
uniform float uGlow;
uniform float uDetail;

attribute float aSeed;
attribute float aBand;
attribute vec3 aChip;
attribute vec3 aInterface;
attribute vec3 aInternet;
attribute vec3 aLogo;

varying float vEnergy;
varying float vBand;
varying float vDepth;
varying float vWave;
varying vec3 vWorldPosition;

float hash(float n) {
  vec3 p = fract(vec3(n) * vec3(.1031, .1030, .0973));
  p += dot(p, p.yzx + 33.33);
  return fract((p.x + p.y) * p.z);
}

float noise(vec3 x) {
  vec3 p = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  float n = p.x + p.y * 57.0 + p.z * 113.0;
  return mix(
    mix(mix(hash(n), hash(n+1.0), f.x), mix(hash(n+57.0), hash(n+58.0), f.x), f.y),
    mix(mix(hash(n+113.0), hash(n+114.0), f.x), mix(hash(n+170.0), hash(n+171.0), f.x), f.y),
    f.z
  );
}

void main() {
  vec3 p = position;
  vec3 n = normalize(position);
  float t = uTime * 0.35;

  // Cada faixa de uMorph conduz a mesma particula para a proxima forma.
  // Como a ida e a volta terminam na nuvem original, o ciclo nao tem corte.
  const float MORPH_SCALE = 1.65;
  if (uMorph < 1.0) {
    p = mix(position, aChip * MORPH_SCALE, smoothstep(0.0, 1.0, uMorph));
  } else if (uMorph < 2.0) {
    p = mix(aChip, aInterface, smoothstep(1.0, 2.0, uMorph)) * MORPH_SCALE;
  } else if (uMorph < 3.0) {
    p = mix(aInterface, aInternet, smoothstep(2.0, 3.0, uMorph)) * MORPH_SCALE;
  } else if (uMorph < 4.0) {
    p = mix(aInternet, aLogo, smoothstep(3.0, 4.0, uMorph)) * MORPH_SCALE;
  } else {
    p = mix(aLogo * MORPH_SCALE, position, smoothstep(4.0, 5.0, uMorph));
  }

  float formed = smoothstep(0.15, 0.9, uMorph) * (1.0 - smoothstep(4.15, 4.9, uMorph));

  float largeWave = sin(p.y * 2.6 + t * 1.15) * cos(p.x * 2.1 - t * 0.82) * 0.22;
  float ribbonWave = sin((p.x + p.z) * 5.3 + t * 1.6 + aSeed * 6.2831) * 0.075;
  /* O noise 3D e a operacao mais cara por vertice. Em hardware limitado a
     nuvem conserva ondas, respiracao e ripple, mas pula esta camada de
     microdeformacao. O branch e uniforme e nao diverge entre particulas. */
  float organicNoise = 0.0;
  if (uDetail > 0.5) {
    organicNoise = (noise(n * 2.4 + vec3(t*.22, -t*.14, t*.18)) - .5)
      * .34 * uDetail;
  }
  float breathing = sin(t * 1.45 + aSeed * 3.0) * .045;

  // onda que viaja de baixo pra cima pelo objeto inteiro
  float travelling = sin(p.y * 1.9 - t * 2.4) * 0.10;
  // ondulacao radial que sai do centro
  float ripple = sin(length(p.xz) * 3.4 - t * 2.05 + aSeed * 1.4) * 0.07;

  float displacement = (largeWave + ribbonWave + organicNoise + breathing + travelling + ripple)
    * mix(1.0, 0.16, formed);
  p += n * displacement;

  vWave = displacement;

  vec4 world = modelMatrix * vec4(p, 1.0);
  float pointerDistance = distance(world.xyz, uPointer);
  float influence = 1.0 - smoothstep(0.0, uInteractionRadius, pointerDistance);
  influence *= uPointerStrength;

  vec3 pointerDirection = normalize(uPointer - world.xyz + vec3(.0001));
  vec3 tangent = normalize(cross(pointerDirection, normalize(vec3(.2,1.,.15))));

  p += pointerDirection * influence * .18;
  p += tangent * influence * (.12 + .09 * sin(uTime*4. + aSeed*8.));

  vec4 mvPosition = modelViewMatrix * vec4(p,1.);
  gl_Position = projectionMatrix * mvPosition;

  float perspective = 1.0 / max(.5, -mvPosition.z);
  gl_PointSize = uPointSize * uPixelRatio * perspective * 8.;
  gl_PointSize *= (.55 + aBand*.4 + influence*.5) * (1.0 + uGlow*.12);

  vEnergy = influence + .16 * sin(uTime*1.9 + aSeed*10.);
  vBand = aBand;
  vDepth = clamp((-mvPosition.z - 1.) / 6., 0., 1.);
  vWorldPosition = world.xyz;
}
`;

const fragmentShader = `
uniform vec3 uSurface;
uniform vec3 uAccentDeep;
uniform vec3 uAccent;
uniform vec3 uText;
uniform float uTime;
uniform float uGlow;

varying float vEnergy;
varying float vBand;
varying float vDepth;
varying float vWave;
varying vec3 vWorldPosition;

void main() {
  vec2 centered = gl_PointCoord - .5;
  float d = length(centered);
  float coreAlpha = 1.0 - smoothstep(.10,.42,d);
  float halo = 1.0 - smoothstep(.24,.50,d);
  float alpha = max(coreAlpha, halo * (.16 + uGlow * .2));
  if(alpha <= .01) discard;

  float vertical = clamp(vWorldPosition.y*.22+.5,0.,1.);
  float horizontal = clamp(vWorldPosition.x*.2+.5,0.,1.);
  float pulse = sin(uTime*.65 + vWorldPosition.y*2.1)*.5+.5;

  vec3 baseA = mix(uAccentDeep,uAccent,vertical);
  vec3 baseB = mix(uAccent,uText,smoothstep(.55,.98,horizontal));
  vec3 color = mix(baseA,baseB,.18+vBand*.42);

  // carbono nas particulas de banda baixa: devolve profundidade a paleta
  color = mix(uSurface,color,.32+.68*smoothstep(0.,.5,vBand));
  // pontos distantes afundam no cyan profundo em vez de virar cinza
  color = mix(color,uAccentDeep,vDepth*.42);
  // crista da onda puxa pro ice white, vale puxa pro cyan profundo
  color = mix(color,uText,smoothstep(.05,.28,vWave)*.45);
  color = mix(color,uAccentDeep,smoothstep(-.05,-.26,vWave)*.4);

  color = mix(color,uText,clamp(vEnergy,0.,1.)*.34);
  color += uAccent*pulse*.05;

  float core = 1.0-smoothstep(0.,.16,d);
  color += core*.16*mix(uAccentDeep,uText,vBand);
  color += uAccent * halo * uGlow * .12;

  alpha *= mix(.26,.85,1.-vDepth) * (.34+vBand*.72);
  gl_FragColor = vec4(color,alpha);
}
`;

function fibonacciSphere(index, count, target = new THREE.Vector3()) {
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  const y = 1 - (index / Math.max(1, count - 1)) * 2;
  const radius = Math.sqrt(Math.max(0, 1 - y * y));
  const theta = goldenAngle * index;
  return target.set(Math.cos(theta)*radius, y, Math.sin(theta)*radius);
}

function random(index, salt = 0) {
  const x = Math.sin(index * 127.1 + salt * 311.7) * 43758.5453123;
  return x - Math.floor(x);
}

function writePoint(target, index, x, y, z) {
  target[index * 3] = x;
  target[index * 3 + 1] = y;
  target[index * 3 + 2] = z;
}

const MORPH_SCALE = 1.65;
function writePackedPoint(target, index, x, y, z) {
  target[index * 3] = Math.round(THREE.MathUtils.clamp(x / MORPH_SCALE, -1, 1) * 32767);
  target[index * 3 + 1] = Math.round(THREE.MathUtils.clamp(y / MORPH_SCALE, -1, 1) * 32767);
  target[index * 3 + 2] = Math.round(THREE.MathUtils.clamp(z / MORPH_SCALE, -1, 1) * 32767);
}

const yieldToMain = () =>
  globalThis.scheduler?.yield
    ? globalThis.scheduler.yield()
    : new Promise((resolve) => setTimeout(resolve, 0));

const shouldYield = (index, interval) => index > 0 && index % interval === 0;

function sampleBoxSurface(index, halfX, halfY, halfZ, salt = 0, out = {}) {
  const face = Math.floor(random(index, salt) * 6);
  let x = (random(index, salt + 1) * 2 - 1) * halfX;
  let y = (random(index, salt + 2) * 2 - 1) * halfY;
  let z = (random(index, salt + 3) * 2 - 1) * halfZ;
  if (face < 2) x = (face ? 1 : -1) * halfX;
  else if (face < 4) y = (face === 3 ? 1 : -1) * halfY;
  else z = (face === 5 ? 1 : -1) * halfZ;
  out.x = x;
  out.y = y;
  out.z = z;
  return out;
}

function sampleSegment(index, start, end, thickness, salt = 0, out = {}) {
  const t = random(index, salt);
  out.x = THREE.MathUtils.lerp(start[0], end[0], t) + (random(index, salt + 1) * 2 - 1) * thickness;
  out.y = THREE.MathUtils.lerp(start[1], end[1], t) + (random(index, salt + 2) * 2 - 1) * thickness;
  out.z = THREE.MathUtils.lerp(start[2], end[2], t) + (random(index, salt + 3) * 2 - 1) * thickness;
  return out;
}

const CHIP_TRACES = [
  [[-0.88, 0.52, 0.29], [-0.25, 0.52, 0.29]],
  [[-0.25, 0.52, 0.29], [-0.25, 0.2, 0.29]],
  [[0.88, 0.5, 0.29], [0.3, 0.5, 0.29]],
  [[0.3, 0.5, 0.29], [0.3, 0.2, 0.29]],
  [[-0.9, -0.48, 0.29], [-0.32, -0.48, 0.29]],
  [[-0.32, -0.48, 0.29], [-0.32, -0.18, 0.29]],
  [[0.9, -0.46, 0.29], [0.34, -0.46, 0.29]],
  [[0.34, -0.46, 0.29], [0.34, -0.18, 0.29]],
];

async function createChipTarget(target, count) {
  const point = { x: 0, y: 0, z: 0 };
  for (let i = 0; i < count; i++) {
    const zone = random(i, 20);

    if (zone < 0.58) {
      sampleBoxSurface(i, 1.12, 0.78, 0.24, 21, point);
    } else if (zone < 0.82) {
      const side = Math.floor(random(i, 22) * 4);
      const slot = (Math.floor(random(i, 23) * 9) / 8) * 2 - 1;
      const extension = 0.78 + random(i, 24) * 0.45;
      if (side < 2) {
        point.x = slot * 0.92 + (random(i, 25) - 0.5) * 0.055;
        point.y = (side ? 1 : -1) * extension;
        point.z = (random(i, 26) - 0.5) * 0.24;
      } else {
        point.x = (side === 3 ? 1 : -1) * (1.12 + random(i, 24) * 0.42);
        point.y = slot * 0.62 + (random(i, 25) - 0.5) * 0.055;
        point.z = (random(i, 26) - 0.5) * 0.24;
      }
    } else if (zone < 0.94) {
      const trace = CHIP_TRACES[Math.floor(random(i, 27) * CHIP_TRACES.length)];
      sampleSegment(i, trace[0], trace[1], 0.022, 28, point);
    } else {
      sampleBoxSurface(i, 0.3, 0.2, 0.31, 29, point);
    }

    writePackedPoint(target, i, point.x, point.y, point.z);
    if (shouldYield(i, 2048)) await yieldToMain();
  }
}

const INTERFACE_LINES = [
  [[-1.15, 0.8, 0.18], [1.15, 0.8, 0.18]],
  [[-1.15, -0.8, 0.18], [1.15, -0.8, 0.18]],
  [[-1.15, -0.8, 0.18], [-1.15, 0.8, 0.18]],
  [[1.15, -0.8, 0.18], [1.15, 0.8, 0.18]],
  [[-1.15, 0.53, 0.18], [1.15, 0.53, 0.18]],
  [[-0.88, 0.66, 0.18], [-0.83, 0.66, 0.18]],
  [[-0.7, 0.66, 0.18], [-0.65, 0.66, 0.18]],
  [[-0.52, 0.66, 0.18], [-0.47, 0.66, 0.18]],
  [[-0.86, 0.28, 0.2], [-0.22, 0.28, 0.2]],
  [[-0.86, 0.04, 0.2], [-0.36, 0.04, 0.2]],
  [[-0.86, -0.2, 0.2], [-0.28, -0.2, 0.2]],
  [[-0.86, -0.45, 0.2], [-0.48, -0.45, 0.2]],
  [[0.0, -0.45, 0.2], [0.2, -0.08, 0.2]],
  [[0.2, -0.08, 0.2], [0.43, -0.28, 0.2]],
  [[0.43, -0.28, 0.2], [0.7, 0.32, 0.2]],
  [[0.7, 0.32, 0.2], [0.94, 0.12, 0.2]],
];

async function createInterfaceTarget(target, count) {
  const point = { x: 0, y: 0, z: 0 };
  for (let i = 0; i < count; i++) {
    const zone = random(i, 40);
    if (zone < 0.72) {
      const line = INTERFACE_LINES[Math.floor(random(i, 41) * INTERFACE_LINES.length)];
      sampleSegment(i, line[0], line[1], 0.024, 42, point);
    } else {
      const back = zone < 0.86;
      const ox = back ? -0.32 : 0.34;
      const oy = back ? 0.23 : -0.25;
      const z = back ? -0.4 : -0.72;
      const edge = Math.floor(random(i, 43) * 4);
      const t = random(i, 44) * 2 - 1;
      point.x = edge < 2
        ? ox + t * 0.92
        : ox + (edge === 3 ? 1 : -1) * 0.92;
      point.y = edge < 2 ? oy + (edge ? 1 : -1) * 0.6 : oy + t * 0.6;
      point.z = z;
      point.x += (random(i, 45) - 0.5) * 0.04;
      point.y += (random(i, 46) - 0.5) * 0.04;
      point.z += (random(i, 47) - 0.5) * 0.05;
    }
    writePackedPoint(target, i, point.x, point.y, point.z);
    if (shouldYield(i, 2048)) await yieldToMain();
  }
}

const INTERNET_RADIUS = 1.22;

function pointOnGlobe(
  latitude,
  longitude,
  radius = INTERNET_RADIUS,
  out = new THREE.Vector3(),
) {
  const latitudeRadius = Math.cos(latitude) * radius;
  return out.set(
    Math.cos(longitude) * latitudeRadius,
    Math.sin(latitude) * radius,
    Math.sin(longitude) * latitudeRadius,
  );
}

// Pontos de presença distribuídos em diferentes regiões da esfera.
const INTERNET_NODES = [
  pointOnGlobe(0.72, -2.35), pointOnGlobe(0.45, -1.35),
  pointOnGlobe(0.08, -0.82), pointOnGlobe(-0.48, -1.12),
  pointOnGlobe(0.64, 0.12), pointOnGlobe(0.22, 0.58),
  pointOnGlobe(-0.36, 0.42), pointOnGlobe(0.52, 1.52),
  pointOnGlobe(0.02, 1.92), pointOnGlobe(-0.58, 2.28),
  pointOnGlobe(0.18, 2.92), pointOnGlobe(-0.12, -2.78),
];

const INTERNET_LINKS = [
  [0, 1], [0, 4], [1, 2], [1, 4], [1, 7], [2, 3], [2, 5],
  [3, 6], [3, 9], [4, 5], [4, 7], [5, 6], [5, 8], [6, 9],
  [7, 8], [7, 10], [8, 9], [8, 10], [9, 11], [10, 11], [0, 10],
];

function sampleInternetRoute(index, salt, out) {
  const link = INTERNET_LINKS[Math.floor(random(index, salt) * INTERNET_LINKS.length)];
  const start = INTERNET_NODES[link[0]];
  const end = INTERNET_NODES[link[1]];
  const t = random(index, salt + 1);
  out.copy(start).lerp(end, t).normalize();
  const arcHeight = Math.sin(Math.PI * t) * 0.28;
  out.multiplyScalar(INTERNET_RADIUS + arcHeight);
  out.x += (random(index, salt + 2) - 0.5) * 0.018;
  out.y += (random(index, salt + 3) - 0.5) * 0.018;
  out.z += (random(index, salt + 4) - 0.5) * 0.018;
  return out;
}

async function createInternetTarget(target, count) {
  const latitudes = [-0.78, -0.42, 0, 0.42, 0.78];
  const longitudes = [0, Math.PI / 4, Math.PI / 2, Math.PI * 0.75];
  const point = new THREE.Vector3();
  const direction = new THREE.Vector3();

  for (let i = 0; i < count; i++) {
    const zone = random(i, 60);
    if (zone < 0.34) {
      const latitude = latitudes[Math.floor(random(i, 61) * latitudes.length)];
      const longitude = random(i, 62) * Math.PI * 2;
      pointOnGlobe(latitude, longitude, INTERNET_RADIUS, point);
    } else if (zone < 0.62) {
      const longitude = longitudes[Math.floor(random(i, 63) * longitudes.length)]
        + (random(i, 66) < 0.5 ? 0 : Math.PI);
      const latitude = (random(i, 64) - 0.5) * Math.PI;
      pointOnGlobe(latitude, longitude, INTERNET_RADIUS, point);
    } else if (zone < 0.86) {
      sampleInternetRoute(i, 65, point);
    } else {
      const node = INTERNET_NODES[Math.floor(random(i, 70) * INTERNET_NODES.length)];
      fibonacciSphere(i, count, direction);
      const nodeRadius = zone > 0.96 ? 0.12 : 0.075;
      point.set(
        node.x + direction.x * nodeRadius,
        node.y + direction.y * nodeRadius,
        node.z + direction.z * nodeRadius,
      );
    }

    const jitter = 0.012;
    writePackedPoint(
      target,
      i,
      point.x + (random(i, 74) - 0.5) * jitter,
      point.y + (random(i, 75) - 0.5) * jitter,
      point.z + (random(i, 76) - 0.5) * jitter,
    );
    if (shouldYield(i, 1024)) await yieldToMain();
  }
}

// Mesmos poligonos do novo nexus-symbol.svg, centralizados no viewBox 390x470.
const LOGO_POLYGONS = [
  [[159, 63], [199, 37], [341, 127], [341, 345], [277, 385], [152, 304], [152, 249], [294, 334], [295, 152]],
  [[102, 100], [49, 131], [49, 345], [197, 436], [230, 413], [95, 330], [95, 159], [238, 249], [238, 190]],
];

function pointInPolygon(x, y, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i];
    const b = polygon[j];
    const crosses = (a[1] > y) !== (b[1] > y)
      && x < ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]) + a[0];
    if (crosses) inside = !inside;
  }
  return inside;
}

function sampleLogoPolygon(index, polygon, salt, out) {
  if (random(index, salt) < 0.28) {
    const edgeIndex = Math.floor(random(index, salt + 1) * polygon.length);
    const start = polygon[edgeIndex];
    const end = polygon[(edgeIndex + 1) % polygon.length];
    const t = random(index, salt + 2);
    out.x = THREE.MathUtils.lerp(start[0], end[0], t);
    out.y = THREE.MathUtils.lerp(start[1], end[1], t);
    return out;
  }

  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const point of polygon) {
    minX = Math.min(minX, point[0]); maxX = Math.max(maxX, point[0]);
    minY = Math.min(minY, point[1]); maxY = Math.max(maxY, point[1]);
  }

  for (let attempt = 0; attempt < 18; attempt++) {
    const x = THREE.MathUtils.lerp(minX, maxX, random(index, salt + 3 + attempt * 2));
    const y = THREE.MathUtils.lerp(minY, maxY, random(index, salt + 4 + attempt * 2));
    if (pointInPolygon(x, y, polygon)) {
      out.x = x;
      out.y = y;
      return out;
    }
  }
  out.x = polygon[0][0];
  out.y = polygon[0][1];
  return out;
}

async function createLogoTarget(target, count) {
  const point = { x: 0, y: 0 };
  for (let i = 0; i < count; i++) {
    const zone = random(i, 80);
    const polygonIndex = zone < 0.5 ? 0 : 1;
    sampleLogoPolygon(i, LOGO_POLYGONS[polygonIndex], 81, point);
    writePackedPoint(
      target,
      i,
      (point.x - 195) * 0.0076,
      (235 - point.y) * 0.0076,
      (random(i, 120) - 0.5) * 0.28,
    );
    if (shouldYield(i, 512)) await yieldToMain();
  }
}

const MORPH_KEYFRAMES = [
  [0, 0], [2.4, 0], [4.2, 1], [6.2, 1], [7.9, 2], [9.9, 2],
  [11.6, 3], [13.6, 3], [15.4, 4], [18.2, 4], [20.2, 5], [22.8, 5],
];

function morphAtTime(elapsed) {
  const time = elapsed % MORPH_KEYFRAMES[MORPH_KEYFRAMES.length - 1][0];
  for (let i = 1; i < MORPH_KEYFRAMES.length; i++) {
    const previous = MORPH_KEYFRAMES[i - 1];
    const next = MORPH_KEYFRAMES[i];
    if (time <= next[0]) {
      const progress = (time - previous[0]) / Math.max(0.001, next[0] - previous[0]);
      return THREE.MathUtils.lerp(previous[1], next[1], progress);
    }
  }
  return 0;
}

export async function createInteractiveFiberCloud(options = {}) {
  const pointCount = options.pointCount ?? 42000;
  const radius = options.radius ?? 1.65;
  const group = new THREE.Group();
  group.name = "InteractiveFiberCloud";

  const positions = new Float32Array(pointCount*3);
  const seeds = new Uint16Array(pointCount);
  const bands = new Uint16Array(pointCount);
  const chipPositions = new Int16Array(pointCount * 3);
  const interfacePositions = new Int16Array(pointCount * 3);
  const internetPositions = new Int16Array(pointCount * 3);
  const logoPositions = new Int16Array(pointCount * 3);
  const p = new THREE.Vector3();

  for(let i=0;i<pointCount;i++){
    fibonacciSphere(i,pointCount,p);
    const seed = Math.random();
    const band = Math.pow(Math.random(),.45);
    const theta = Math.atan2(p.z,p.x);
    const phi = Math.asin(p.y);
    const lobe = 1 + .13*Math.sin(theta*3+phi*2) + .09*Math.sin(theta*5-phi*4) + .06*Math.cos(theta*2+seed*6.2831);
    const asymmetry = 1 + p.x*.08 - p.z*.04;
    p.multiplyScalar(radius*lobe*asymmetry);
    p.x*=1.08;p.y*=.94;p.z*=.94;
    positions[i*3]=p.x;positions[i*3+1]=p.y;positions[i*3+2]=p.z;
    seeds[i]=Math.round(seed*65535);bands[i]=Math.round(band*65535);
    /* A distribuicao inicial tambem e cooperativa. Trigonometria em dezenas
       de milhares de pontos nao deve virar uma unica Long Task no bootstrap. */
    if (shouldYield(i, 4096)) await yieldToMain();
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position",new THREE.BufferAttribute(positions,3));
  geometry.setAttribute("aSeed",new THREE.Uint16BufferAttribute(seeds,1,true));
  geometry.setAttribute("aBand",new THREE.Uint16BufferAttribute(bands,1,true));
  const chipAttribute = new THREE.Int16BufferAttribute(chipPositions, 3, true);
  const interfaceAttribute = new THREE.Int16BufferAttribute(interfacePositions, 3, true);
  const internetAttribute = new THREE.Int16BufferAttribute(internetPositions, 3, true);
  const logoAttribute = new THREE.Int16BufferAttribute(logoPositions, 3, true);
  geometry.setAttribute("aChip", chipAttribute);
  geometry.setAttribute("aInterface", interfaceAttribute);
  geometry.setAttribute("aInternet", internetAttribute);
  geometry.setAttribute("aLogo", logoAttribute);

  const uniforms = {
    uTime:{value:0},
    uPointer:{value:new THREE.Vector3(999,999,999)},
    uPointerStrength:{value:0},
    uInteractionRadius:{value:options.interactionRadius??.95},
    uPointSize:{value:options.pointSize??2.1},
    uPixelRatio:{value:Math.min(options.pixelRatio ?? devicePixelRatio,2)},
    uMorph:{value:0},
    uGlow:{value:.62},
    uDetail:{value:options.detail??1},
    uSurface:{value:new THREE.Color("#0D1318")},
    uAccentDeep:{value:new THREE.Color("#0A6C91")},
    uAccent:{value:new THREE.Color("#5AD7FF")},
    uText:{value:new THREE.Color("#F4F8FA")}
  };

  const material = new THREE.ShaderMaterial({
    uniforms, vertexShader, fragmentShader,
    transparent:true, depthWrite:false,
    blending:THREE.AdditiveBlending
  });

  const points = new THREE.Points(geometry,material);
  points.frustumCulled = false;
  group.add(points);

  /* O proxy nunca e rasterizado nem recebe raycast por triangulos; o main usa
     apenas seu raio numa intersecao analitica. Poucos segmentos bastam. */
  const proxyGeometry = new THREE.SphereGeometry(Math.max(radius * 1.4, 1.9),8,6);
  const proxyMaterial = new THREE.MeshBasicMaterial({visible:false});
  const proxy = new THREE.Mesh(proxyGeometry,proxyMaterial);
  proxy.name = "InteractionProxy";
  group.add(proxy);

  let targetStrength=0,currentStrength=0;
  const targetPointer=new THREE.Vector3(999,999,999);
  const smoothPointer=new THREE.Vector3(999,999,999);
  let morphReady = false;
  let morphStartedAt = 0;
  let disposed = false;

  /* A nuvem inicial so precisa de `position`. Os quatro destinos do morph sao
     preenchidos cooperativamente depois do primeiro frame; enquanto isso
     uMorph permanece em zero. Assim o efeito nasce completo, o preloader pode
     sair cedo e nenhuma transicao e perdida — o ciclo apenas inicia quando os
     buffers estiverem prontos. */
  const ready = (async () => {
    await yieldToMain();
    await createChipTarget(chipAttribute.array, pointCount);
    await createInterfaceTarget(interfaceAttribute.array, pointCount);
    await createInternetTarget(internetAttribute.array, pointCount);
    await createLogoTarget(logoAttribute.array, pointCount);
    if (disposed) return;
    chipAttribute.needsUpdate = true;
    interfaceAttribute.needsUpdate = true;
    internetAttribute.needsUpdate = true;
    logoAttribute.needsUpdate = true;
    morphReady = true;
  })();

  return {
    group,
    ready,
    pointerUpdate(world,active,velocity=0){
      targetPointer.copy(world);
      targetStrength = active ? Math.min(1.4,1+velocity*.2) : 0;
    },
    tick(delta,elapsed){
      uniforms.uTime.value=elapsed;
      if (morphReady) {
        if (!morphStartedAt) morphStartedAt = elapsed;
        uniforms.uMorph.value = morphAtTime(elapsed - morphStartedAt);
      }
      currentStrength=THREE.MathUtils.damp(currentStrength,targetStrength,6.5,delta);
      smoothPointer.lerp(targetPointer,1-Math.exp(-10*delta));
      uniforms.uPointer.value.copy(smoothPointer);
      uniforms.uPointerStrength.value=currentStrength;
      group.position.y=Math.sin(elapsed*.55)*.06;
    },
    resize(pixelRatio){
      uniforms.uPixelRatio.value=Math.min(pixelRatio,2);
    },
    setGlow(value){
      uniforms.uGlow.value=value;
    },
    dispose(){
      disposed = true;
      geometry.dispose(); material.dispose(); proxyGeometry.dispose(); proxyMaterial.dispose();
    }
  };
}
