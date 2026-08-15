/* Perfil de renderizacao progressiva.
 *
 * Nao identifica modelos por user-agent: combina sinais de capacidade que o
 * navegador realmente expoe. Quando algum sinal nao existe (Safari/iOS, por
 * exemplo), ele simplesmente nao pesa na decisao. Todos os perfis preservam
 * os efeitos; mudam apenas densidade, resolucao interna e frequencia de frame.
 */

const numberOrZero = (value) => {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
};

export function createPerformanceProfile() {
  const compact = matchMedia("(max-width: 700px)").matches;
  const coarsePointer = matchMedia("(pointer: coarse)").matches;
  const memory = numberOrZero(navigator.deviceMemory);
  const cores = numberOrZero(navigator.hardwareConcurrency);
  const pixelRatio = numberOrZero(devicePixelRatio) || 1;
  const saveData = Boolean(navigator.connection?.saveData);

  let pressure = 0;
  if (saveData) pressure += 4;
  if (memory && memory <= 4) pressure += 2;
  else if (memory && memory <= 6) pressure += 1;
  if (cores && cores <= 4) pressure += 2;
  else if (cores && cores <= 6) pressure += 1;
  if (compact || coarsePointer) pressure += 1;
  if (!memory && !cores) pressure += 1;
  /* DPR alto multiplica a area de todos os canvases mesmo em uma tela pequena. */
  if (pixelRatio >= 2.75) pressure += 1;

  const tier = pressure >= 3 ? "low" : pressure >= 1 ? "balanced" : "high";

  const tiers = {
    high: {
      targetFps: 60,
      heroPoints: compact ? 26000 : 46000,
      heroDpr: compact ? 1.25 : 1.5,
      heroDetail: 1,
      backgroundDpr: compact ? 0.75 : 1,
      backgroundIntensity: compact ? 0.72 : 1,
      cursorDpr: 1.5,
      contactDpr: coarsePointer ? 1.15 : 1.5,
      contactShaderScale: coarsePointer ? 0.48 : 0.72,
    },
    balanced: {
      targetFps: 45,
      heroPoints: compact ? 21000 : 34000,
      heroDpr: compact ? 1 : 1.25,
      heroDetail: 0.72,
      backgroundDpr: compact ? 0.6 : 0.82,
      backgroundIntensity: compact ? 0.66 : 0.88,
      cursorDpr: 1.15,
      contactDpr: 1.15,
      contactShaderScale: 0.56,
    },
    low: {
      targetFps: 30,
      heroPoints: compact ? 14000 : 22000,
      heroDpr: compact ? 0.85 : 1,
      heroDetail: 0.35,
      backgroundDpr: compact ? 0.48 : 0.62,
      backgroundIntensity: compact ? 0.58 : 0.76,
      cursorDpr: 1,
      contactDpr: 1,
      contactShaderScale: 0.44,
    },
  };

  return Object.freeze({
    tier,
    compact,
    coarsePointer,
    memory,
    cores,
    saveData,
    ...tiers[tier],
  });
}
