/**
 * Pontuação do grupo (v0.2 item 5).
 * "pecas": 1 peça = 1 ponto (padrão, como sempre foi).
 * "pontos": cada tipo de peça vale o peso definido pelo admin (1 a 5); tipo sem peso vale 1.
 */

export type Scoring = { modo: "pecas" | "pontos"; pesos?: Record<string, number> };

export const DEFAULT_SCORING: Scoring = { modo: "pecas" };
export const MIN_WEIGHT = 1;
export const MAX_WEIGHT = 5;

type ScoredEntry = { count_final: number; ai_result?: { por_tipo?: Record<string, number> } | null };

export function normalizeScoring(raw: unknown): Scoring {
  const s = raw as Partial<Scoring> | null | undefined;
  if (!s || s.modo !== "pontos") return DEFAULT_SCORING;
  const pesos: Record<string, number> = {};
  for (const [k, v] of Object.entries(s.pesos ?? {})) {
    const n = Math.round(Number(v));
    if (Number.isFinite(n)) pesos[k] = Math.min(MAX_WEIGHT, Math.max(MIN_WEIGHT, n));
  }
  return { modo: "pontos", pesos };
}

export const isPoints = (s: Scoring) => s.modo === "pontos";
export const weightOf = (s: Scoring, tipo: string) => (s.modo === "pontos" ? s.pesos?.[tipo] ?? 1 : 1);

/**
 * Pontos de um registro. Usa as peças por tipo quando elas batem com o total do registro;
 * registros antigos (sem tipo, ou com tipos que não somam o total corrigido) valem 1 por peça.
 */
export function entryPoints(e: ScoredEntry, s: Scoring): number {
  if (s.modo !== "pontos") return e.count_final;
  const tipos = e.ai_result?.por_tipo;
  if (!tipos) return e.count_final;
  const pieces = Object.values(tipos).reduce((a, b) => a + b, 0);
  if (pieces !== e.count_final) return e.count_final;
  return Object.entries(tipos).reduce((a, [k, n]) => a + n * weightOf(s, k), 0);
}

/** "pts"/"peças" no singular ou plural. */
export function unitLabel(s: Scoring, n: number) {
  if (s.modo === "pontos") return n === 1 ? "ponto" : "pontos";
  return n === 1 ? "peça" : "peças";
}

/** Resumo curto: "Temaki 3 · Hot roll 2 · demais 1". */
export function scoringSummary(s: Scoring) {
  if (s.modo !== "pontos") return "1 peça = 1 ponto";
  const special = Object.entries(s.pesos ?? {})
    .filter(([, v]) => v !== 1)
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => `${k} ${v}`);
  return special.length ? `${special.join(" · ")} · demais 1` : "todas as peças valem 1";
}
