# Auditoria de performance — Nexus Corp Immersive

Data: 03/08/2026  
Ambiente: build de produção Vite servido localmente; Lighthouse mobile em Microsoft Edge headless.  
Relatórios brutos: `lighthouse-before.json` e `lighthouse-final.json`.

## Resultado executivo

| Métrica | Antes | Depois | Variação |
|---|---:|---:|---:|
| Lighthouse Performance | 57 | 72 | +15 pontos |
| FCP | 3.450 ms | 2.868 ms | -16,9% |
| LCP | 3.980 ms | 3.301 ms | -17,1% |
| TBT | 878 ms | 515 ms | -41,3% |
| Speed Index | 4.819 ms | 4.240 ms | -12,0% |
| TTI | 4.496 ms | 3.583 ms | -20,3% |
| Max Potential FID | 948 ms | 565 ms | -40,4% |
| CLS | 0,0015 | 0,0015 | estável/excelente |
| Trabalho total da main thread | 6.952 ms | 5.412 ms | -22,2% |
| Tempo total de tasks | 1.738 ms | 1.353 ms | -22,2% |
| Peso transferido na visita inicial | 1.514 KB | 290 KB | -80,8% |
| JavaScript não usado | 77,3 KB | 50,3 KB | -34,9% |

O JavaScript inicial passou de um chunk único de 718,9 KB / 209,0 KB gzip para três chunks cacheáveis que somam aproximadamente 658,7 KB / 188,1 KB gzip. Efeitos abaixo da dobra ficaram em chunks adiados (cerca de 50,8 KB / 21,6 KB gzip) e não são baixados na visita inicial.

## Problemas encontrados e correções

| # | Arquivo / linha final | Motivo técnico e impacto | Solução e código otimizado | Ganho |
|---:|---|---|---|---|
| 1 | `src/style.css:1` → `index.html:12` | `@import` de Google Fonts criava descoberta em cascata e prolongava o bloqueio de renderização. | Removido o `@import`; adicionados `preconnect` para Google Fonts e link direto do stylesheet no HTML. | Menor waterfall; contribui para FCP -582 ms no conjunto. |
| 2 | `index.html:894-1080`, `src/createPortfolioShowcase.js:89-108`, `:622-638` | O lazy loading nativo baixava as seis imagens do trilho horizontal, pois todas compartilham a mesma posição vertical. Isso adicionava ~1,20 MB, seis decodificações e refreshes repetidos à visita inicial. | `data-pg-src` + mapa de imports Vite + `IntersectionObserver` a 800 px da galeria; refreshes de imagem agrupados em um rAF. | Peso inicial -1,22 MB; transferência total -80,8%. |
| 3 | `index.html:493-501`, `index.html:1227-1230` | SVGs sem dimensões explícitas podiam recalcular layout durante o carregamento. | `width`/`height`, `loading="lazy"` e `decoding="async"`. | CLS mantido em 0,0015 e sem deslocamentos novos. |
| 4 | `src/main.js:777-824` | Portfolio, shader da showcase, Canvas de contato, SplitType e MotionPath entravam no bootstrap mesmo fora da dobra. | `import()` dinâmico acionado 1.200 px antes da galeria, em foco/âncora e em deep links. | JS inicial gzip -10%; JS não usado -34,9%. |
| 5 | `src/createInteractiveFiberCloud.js:183-188`, `:250-560` | A criação das quatro formas de 46 mil partículas era síncrona e criava muitos objetos temporários, gerando Long Tasks e GC. | Objetos/vetores reutilizados; destinos gerados cooperativamente com `scheduler.yield`; morph começa somente quando os buffers estão prontos. | Menor bloqueio durante bootstrap; TBT total -41,3%. |
| 6 | `src/createInteractiveFiberCloud.js:176-180`, `:507-510` | Cinco atributos Float32 consumiam muita memória e banda de vértice. | Quatro morphs em `Int16BufferAttribute` normalizado, escala 1,65 no vertex shader; seed/band em `Uint16` normalizado. | Armazenamento de atributos ~3,13 MB → ~1,84 MB (-41,2%), tanto na RAM quanto na VRAM. |
| 7 | `src/createInteractiveFiberCloud.js:11-15`, `:98`, `:113-150`; `src/main.js:1266` | `EffectComposer + UnrealBloomPass` fazia um render da cena e cerca de 13 passes fullscreen, além de manter grandes render targets HalfFloat. | Bloom reimplementado em um único passe no shader de pontos (`uGlow`), com halo aditivo e resposta ao hover; render direto da cena. | Hero ~14 → 1 draw call; dezenas de MB de render targets eliminadas; Long Task gráfica caiu de 948 ms para 565 ms. |
| 8 | `src/createInteractiveFiberCloud.js:26-39`, `:51-62` | Hash trigonométrico e cadeia completa de cinco `mix` eram executados para cada vértice em cada frame. | Hash aritmético sem `sin` e branch por fase do morph, mantendo o mesmo campo orgânico. | Menos ALU no vertex shader; melhora principalmente GPUs integradas/software. |
| 9 | `src/main.js:1058-1094`, `:1110-1148` | Raycast contra uma SphereGeometry percorria triângulos em todo `pointermove`. | Interseção analítica `Ray.intersectSphere`, com movimento consolidado para no máximo uma leitura/raycast por frame. | Remove até centenas de raycasts redundantes por segundo em mouses de alta taxa. |
| 10 | `src/main.js:614-680`, `:871-911`; `src/createPortfolioShowcase.js:62-82`, `:226`, `:386`; `src/createShowcaseShader.js:145-160` | `getBoundingClientRect`, criação de tweens e escritas CSS eram repetidos na frequência bruta do ponteiro. | Bounds cacheados, `gsap.quickTo`, cache por evento e throttling com `requestAnimationFrame`. | Evita forced reflow/event storm; interação limitada à taxa real de pintura. |
| 11 | `src/main.js:37-45`, `:1200` | O loop gráfico lia `body.scrollHeight` a cada frame, podendo sincronizar layout. | Progresso normalizado capturado no evento Lenis e apenas consumido pelo shader. | Uma leitura de layout potencial removida de cada frame. |
| 12 | `src/main.js:1271-1302` | `resize`, `orientationchange` e `ResizeObserver` podiam realocar buffers várias vezes na mesma pintura. | Scheduler de resize com um único rAF e dimensões cacheadas. | Menos realocações de canvas/VRAM e menos picos durante resize. |
| 13 | `src/createContactGrid.js:36-81`, `:196-270`, `:401-451` | O Canvas de contato mantinha rAF fora da viewport e alocava milhares de arrays por frame nas ondas/circuitos. | Loop liga/desliga pelo `IntersectionObserver`; caminhos pré-calculados e buffers reutilizáveis para pontos. | CPU zero fora da área observada; menos GC e frame-time no contato. |
| 14 | `src/createCursorGrid.js:79-83`, `:145`, `:259-310` | A grade reativa convertia cores e processava todos os eventos do mouse. | RGB cacheado e ponteiro consolidado por rAF; dispose cancela ambos os frames. | Menor CPU/GC durante hover da hero. |
| 15 | `src/createShaderBackground.js:145-166`, `:185-225`, `:235-249` | O shader global relia dimensões e reconfigurava programa/buffer a cada draw; caminhos de erro vazavam shaders/program. | Dimensões de exibição cacheadas; estado WebGL configurado uma vez; cleanup completo em falha e dispose. | Menos chamadas de driver por frame e sem vazamento em erro de compilação/link. |
| 16 | `src/style.css:2227-2262`, `src/main.js:724-735` | A linha do processo animava `width`, acionando layout/paint em scroll. `will-change` permanente promovia muitas camadas fora da viewport. | Linha em `scaleX`; `will-change` e `animation-play-state` ativados apenas nas seções em execução. | Remove layout por frame e reduz pressão de memória de composição. |
| 17 | `src/createSectionStack.js:89-106`, `src/sectionStack.css:60` | Leituras/escritas de altura eram intercaladas e camadas fullscreen ficavam promovidas permanentemente. | Leituras em lote, depois escritas; promoção somente durante a transição ativa. | Menos layout thrashing e menos VRAM fora da transição. |
| 18 | `src/main.js:1314-1337` | Controllers, observers, ticker, renderer e recursos Three/WebGL possuíam `dispose`, mas o bootstrap não os chamava. | Cleanup central em `pagehide` não persistido: cancela rAF, observers, GSAP, Lenis, geometria, materiais e contexto. | Evita retenção em shells/embeds e fecha o ciclo de vida de GPU/CPU. |

## Código otimizado representativo

```js
// Lazy real do portfolio: nenhum raster entra na visita inicial.
const imageObserver = new IntersectionObserver(([entry]) => {
  if (!entry.isIntersecting) return;
  imageObserver.disconnect();
  hydrateProjectImages();
}, { rootMargin: "800px 0px" });
```

```js
// Raycast O(1), uma vez por frame, sem percorrer triângulos.
interactionSphere.center.copy(proxyCenter);
interactionSphere.radius = proxy.geometry.parameters.radius
  * Math.max(proxyScale.x, proxyScale.y, proxyScale.z);
return raycaster.ray.intersectSphere(interactionSphere, analyticHit);
```

```glsl
// Halo/bloom no mesmo fragment shader, sem post-processing fullscreen.
float halo = 1.0 - smoothstep(.24, .50, d);
float alpha = max(coreAlpha, halo * (.16 + uGlow * .2));
color += uAccent * halo * uGlow * .12;
```

## Bundle, CPU, GPU e memória

- Bundle inicial: 209,0 KB gzip → 188,1 KB gzip (-10,0%).
- Transferência inicial total: 1,51 MB → 290 KB (-80,8%), principalmente por lazy loading horizontal real.
- Main thread medida: -22,2%; TBT: -41,3%.
- Hero: estimativa de ~14 draw calls para 1; o background global continua sendo um draw call separado.
- Render targets do composer/bloom removidos: em 1440×1000 e DPR 1,5, só os buffers de cor HalfFloat podiam passar de 70 MB, sem contar depth buffers.
- Atributos das partículas: economia aproximada de 1,29 MB na RAM e 1,29 MB na VRAM.
- FPS estimado, não telemetrado: hero em hardware intermediário de ~35–50 para ~55–60 FPS; hardware integrado/baixo consumo de ~20–30 para ~40–55 FPS. O valor real depende de GPU, DPR e viewport.
- GPU estimada: redução de 60–90% no custo de pós-processamento da hero; não há API Lighthouse que forneça percentual confiável de utilização de GPU.

## Core Web Vitals e limites da medição

- LCP: 3,98 s → 3,30 s. Melhorou 17,1%, mas ainda fica na faixa “precisa melhorar” do teste mobile; o preloader cinematográfico e a cena 3D acima da dobra são agora os limites dominantes.
- CLS: 0,0015, excelente e estável.
- INP: não é produzido por uma execução de laboratório sem interações reais. TBT caiu 41,3% e Max Potential FID 40,4%, bons proxies para maior responsividade; INP deve ser confirmado com RUM em produção.
- TTFB local: ~10 ms, inalterado. Em produção dependerá de CDN, cache e servidor.
- FPS/CPU/GPU por dispositivo exigem profiling em hardware real; os percentuais de Lighthouse acima são medidos, e as faixas de FPS/GPU são estimativas técnicas explícitas.

## Inventário auditado

O projeto usa HTML, CSS, JavaScript, GSAP/ScrollTrigger, Lenis, Three.js, GLSL, Canvas 2D, WebGL, SVG, Google Fonts e imagens JPG/PNG. Não há React, Next.js, TypeScript, Tailwind, Framer Motion ou vídeo neste repositório. Os SVGs são pequenos; os rasters do portfolio já estavam razoavelmente comprimidos e agora não competem com LCP/FCP.
