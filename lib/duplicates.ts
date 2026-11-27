/**
 * Aviso de registro duplicado.
 *
 * No Rodízio #1 (26 nov 2026) as duplicatas foram quase sempre duas pessoas fotografando
 * a mesma barca, de ângulos diferentes, com menos de 1 minuto de diferença (ex.: 20 Uramaki
 * às 20:40:30 e 20 Uramaki às 20:40:51). Comparar a imagem não pega isso; comparar
 * composição + tempo pega. Por isso a regra é: mesmos tipos, total parecido, poucos minutos.
 * É só uma pergunta para a pessoa: nunca bloqueia.
 */

export type Candidate = {
  id: string;
  kind: "barca" | "prato";
  userId: string;
  createdAt: string;
  counts: Record<string, number>;
  photoPath: string | null;
};

/** Janela de tempo em que um registro parecido conta como possível duplicata. */
export const DUP_WINDOW_MS = 3 * 60 * 1000;

/** Diferença peça a peça tolerada: 2 peças ou 15% do maior total, o que for maior. */
export function tolerance(a: number, b: number) {
  return Math.max(2, Math.round(0.15 * Math.max(a, b)));
}

function sum(c: Record<string, number>) {
  return Object.values(c).reduce((a, b) => a + b, 0);
}

/** Soma das diferenças por tipo (distância L1). */
export function distance(a: Record<string, number>, b: Record<string, number>) {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  let d = 0;
  for (const k of keys) d += Math.abs((a[k] ?? 0) - (b[k] ?? 0));
  return d;
}

export function isSimilar(a: Record<string, number>, b: Record<string, number>) {
  const ta = sum(a);
  const tb = sum(b);
  if (ta === 0 || tb === 0) return false;
  return distance(a, b) <= tolerance(ta, tb);
}

/** O registro recente mais parecido com `counts`, ou null. */
export function findDuplicate(
  counts: Record<string, number>,
  candidates: Candidate[],
  now = Date.now(),
): Candidate | null {
  let best: Candidate | null = null;
  let bestD = Infinity;
  for (const c of candidates) {
    const age = now - new Date(c.createdAt).getTime();
    if (age < 0 || age > DUP_WINDOW_MS) continue;
    if (!isSimilar(counts, c.counts)) continue;
    const d = distance(counts, c.counts);
    if (d < bestD) {
      best = c;
      bestD = d;
    }
  }
  return best;
}

/** "há 21 s", "há 2 min". */
export function agoLabel(createdAt: string, now = Date.now()) {
  const s = Math.max(0, Math.round((now - new Date(createdAt).getTime()) / 1000));
  return s < 60 ? `há ${s} s` : `há ${Math.round(s / 60)} min`;
}
