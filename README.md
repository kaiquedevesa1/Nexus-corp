# Nexus Corp Immersive Website

Website institucional premium inspirado na referência enviada, com identidade própria da Nexus Corp.

## Tecnologias

- HTML5
- CSS3
- JavaScript
- Three.js
- ShaderMaterial
- GSAP
- ScrollTrigger
- Lenis
- UnrealBloomPass
- Vite

## Executar

```bash
npm install
npm run dev
```

## Principais recursos

- Objeto procedural 3D com milhares de partículas.
- Rotação 360° com clique, arraste e toque.
- Inércia suave ao soltar.
- Deformação local ao passar o cursor.
- Bloom e shader com a paleta Nexus.
- Animações de entrada com texto dividido em caracteres.
- ScrollTrigger em seções, cards, console e linha de processo.
- Smooth scroll com Lenis.
- Background em shader reativo ao mouse (halo, ripple e parallax).
- Grade que acende sob o cursor na hero, com pulso ao clicar.
- Botões magnéticos.
- Layout totalmente responsivo.
- Qualidade adaptativa no celular.

## Paleta — Black Ice

Preto profundo e superfícies azul-grafite com Ice White e Signal Cyan. A menta
é usada apenas em estados positivos, mantendo a identidade precisa e técnica.

| Token           | Hex       | Uso                                      |
| --------------- | --------- | ---------------------------------------- |
| `--void`        | `#050608` | fundo base                               |
| `--surface`     | `#0D1318` | cards, consoles, superfícies elevadas    |
| `--accent`      | `#5AD7FF` | signal cyan — CTA, links, destaques      |
| `--accent-deep` | `#0A6C91` | profundidade, gradientes, estados        |
| `--counter`     | `#70E1C1` | menta — somente em status (`.online`)    |
| `--surface-elevated` | `#151E25` | superfícies elevadas e profundidade |
| `--text`        | `#F4F8FA` | Ice White — texto primário               |

Os tokens vivem em `src/style.css`. As mesmas cores estão espelhadas nos dois
shaders (`createShaderBackground.js` em `vec3` normalizado,
`createInteractiveFiberCloud.js` como `THREE.Color`), no `FogExp2` de
`main.js` e nos SVGs de `src/assets/`.

## Arquivos

- `index.html`: estrutura completa.
- `src/style.css`: design system e responsividade.
- `src/main.js`: animações, scroll e cena 3D.
- `src/createInteractiveFiberCloud.js`: objeto procedural Three.js.
