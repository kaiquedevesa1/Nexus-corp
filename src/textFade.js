import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

/* ===========================================================================
   TEXTO QUE ACENDE COM O SCROLL

   O texto comeca APAGADO (nao invisivel) e ganha luz conforme o scroll avanca.
   Como e `scrub`, a posicao da animacao esta amarrada a posicao do scroll:
   descer acende, subir apaga, e a volta e a ida percorrida ao contrario — nao
   um segundo gesto com tempo proprio, que e o que `toggleActions` daria.

   ---------------------------------------------------------------------------
   POR QUE O `gsap.set` EXPLICITO ABAIXO E OBRIGATORIO

   A tentacao e confiar no `immediateRender: true` do `fromTo`. Isso FALHA
   quando ha `stagger`: o tween e renderizado no tempo 0 e, no tempo 0, so a
   sub-tween do PRIMEIRO alvo comecou. Os demais ficam sem receber o estado
   inicial ate a vez deles chegar.

   Na pratica, num titulo de 42 caracteres, isso deixava a frase inteira
   legivel antes de o scroll alcancar a faixa, com apenas a primeira letra
   escondida — dava a impressao de duas animacoes brigando e de um caractere
   sumido. O `gsap.set` aplica o estado inicial aos 42 de uma vez, e por isso
   o tween usa `immediateRender: false`: quem manda no estado e o set.
   ---------------------------------------------------------------------------

   O texto tambem SOBE: em repouso ele fica deslocado alguns pixels para
   baixo e assenta na posicao final conforme acende.

   Cuidado ao aumentar o deslocamento: `.cap__title` e `.plan-card` sao
   `overflow: hidden`, entao um texto que em repouso desca demais e cortado
   pela borda do proprio cartao. Por isso as chamadas de dentro deles usam
   valores menores que o padrao.

   `ease: "none"` porque o efeito deve responder linearmente ao scroll: cada
   pixel rolado vale a mesma quantidade de luz e de deslocamento.
   ========================================================================= */

/* Opacidade de repouso. Baixa o bastante para o "acender" ser visivel, alta o
   bastante para o texto nunca sumir — importante para leitura e para quem
   chega por busca ou por link direto. */
const RESTING_OPACITY = 0.22;

/* Deslocamento de repouso, em pixels, abaixo da posicao final. */
const RESTING_OFFSET = 22;

export const prefersReducedMotion = () =>
  matchMedia("(prefers-reduced-motion: reduce)").matches;

export function textFade(targets, options = {}) {
  /* Com motion reduzida o texto fica aceso e parado: nao criamos nem o estado
     de repouso, portanto nao ha nada apagado na tela. */
  if (prefersReducedMotion()) return null;

  const list = gsap.utils.toArray(targets);
  if (!list.length) return null;

  const {
    trigger = list[0],
    start = "top 95%",
    end = "top 60%",
    from = RESTING_OPACITY,
    y = RESTING_OFFSET,
    /* Alternativa relativa ao corpo da fonte. Usada nos titulos, cujo
       tamanho varia por clamp() de 34px a 60px: um deslocamento fixo em px
       seria um salto no titulo pequeno e quase nada no grande. */
    yPercent,
    stagger = 0,
    duration = 1,
  } = options;

  const relative = yPercent !== undefined;
  const restingState = relative
    ? { opacity: from, yPercent }
    : { opacity: from, y };
  const settledState = relative
    ? { opacity: 1, yPercent: 0 }
    : { opacity: 1, y: 0 };

  /* O `gsap.set` explicito e o que garante que TODOS os alvos comecem no
     repouso — ver a nota sobre stagger acima. Sem `will-change`: os alvos aqui
     sao centenas (um titulo sozinho tem 42 caracteres) e promover cada um a
     camada propria custaria mais memoria do que o efeito economiza. */
  gsap.set(list, { ...restingState, force3D: true });

  return gsap.fromTo(list, restingState, {
    ...settledState,
    duration,
    stagger,
    ease: "none",
    force3D: true,
    immediateRender: false,
    scrollTrigger: {
      trigger,
      start,
      end,
      /* O Lenis ja entrega movimento amortecido; meio segundo evita que o
         texto continue atrasado quando a direcao do scroll muda. */
      scrub: 0.5,
      invalidateOnRefresh: true,
    },
  });
}
