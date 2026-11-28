/**
 * Limites de uso da IA (backlog B2). Referência real: Rodízio #1 (11 pessoas) usou 66 fotos no evento
 * inteiro; a pessoa que mais fotografou fez cerca de 10. Os tetos ficam bem acima disso.
 */
export const AI_LIMITS = {
  /** fotos contadas por pessoa nas últimas 24 h */
  userDay: 40,
  /** fotos contadas por pessoa no mesmo evento */
  userEvent: 30,
  /** fotos contadas no evento inteiro (todas as pessoas) */
  eventTotal: 150,
  /** disjuntor de custo: fotos no app inteiro nas últimas 24 h */
  globalDay: 1500,
} as const;

export type QuotaCounts = { user_day: number; user_event: number; event_total: number; global_day: number };

/** Devolve o motivo do bloqueio, ou null se ainda pode contar. */
export function quotaBlock(q: QuotaCounts): { code: string; message: string } | null {
  if (q.global_day >= AI_LIMITS.globalDay)
    return { code: "quota_global", message: "A contagem por foto está pausada por hoje. Registre tocando nas peças." };
  if (q.user_day >= AI_LIMITS.userDay)
    return { code: "quota_user_day", message: `Você já contou ${AI_LIMITS.userDay} fotos hoje. Registre tocando nas peças.` };
  if (q.user_event >= AI_LIMITS.userEvent)
    return { code: "quota_user_event", message: `Você já contou ${AI_LIMITS.userEvent} fotos neste evento. Registre tocando nas peças.` };
  if (q.event_total >= AI_LIMITS.eventTotal)
    return { code: "quota_event", message: "Este evento chegou ao limite de fotos. Registre tocando nas peças." };
  return null;
}
