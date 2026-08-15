# Transicoes cinematograficas aplicadas

Foi adicionada uma linguagem de movimento consistente entre as grandes sections do site, usando GSAP + ScrollTrigger.

## O que mudou

- **Servicos -> Planos:** reveal por mascara, profundidade/scale e linha de luz ciano.
- **Planos -> Portfolio:** efeito de portal/zoom-through 2D com clip-path, scale e recuo da section anterior.
- **Portfolio -> Processo:** reveal vertical curto para nao disputar com o pin/storytelling do portfolio.
- **Acessibilidade:** `prefers-reduced-motion` desativa as transicoes cinematograficas.
- **Responsividade:** intensidades menores em telas ate 900px.
- **Performance:** sem novos videos, canvases ou WebGL; as transicoes reutilizam GSAP/ScrollTrigger ja existentes.

## Arquivos

- `src/createCinematicSectionTransitions.js` — novo controlador.
- `src/main.js` — import, inicializacao e dispose do controlador.
- `src/style.css` — linha de sweep compartilhada entre as transicoes.

## Observacao de build

O codigo passou em verificacao sintatica com `node --check`. O build Vite nao foi regenerado neste ambiente porque o registry disponivel nao possui o pacote `vite@7.3.6` exigido pelo lockfile. Ao abrir localmente, execute `npm install`/`npm ci` em um ambiente com acesso ao npm e depois `npm run build`.
