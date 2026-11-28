/**
 * Temporada do grupo (backlog C4; PRD F8): janela de N meses que recomeça sozinha.
 * season_start é o 1º dia da 1ª temporada; a atual é a janela que contém hoje.
 */
export type SeasonConfig = { season_start: string; season_months: number };
export const SEASON_OPTIONS = [1, 3, 6, 12] as const;

const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

function addMonths(d: Date, n: number) {
  return new Date(d.getFullYear(), d.getMonth() + n, d.getDate());
}

/** [início, fim) da temporada que contém `now`. */
export function currentSeason(cfg: SeasonConfig, now = new Date()) {
  const [y, m, d] = cfg.season_start.split("-").map(Number);
  const months = Math.max(1, cfg.season_months || 6);
  let start = new Date(y, m - 1, d);
  if (now < start) return { start, end: addMonths(start, months), index: 1 };
  let index = 1;
  while (addMonths(start, months) <= now) {
    start = addMonths(start, months);
    index++;
  }
  return { start, end: addMonths(start, months), index };
}

/** "jun–nov 2026" ou "dez 2026–mai 2027". */
export function seasonLabel(start: Date, end: Date) {
  const last = new Date(end.getTime() - 86400000);
  const a = MONTHS[start.getMonth()];
  const b = MONTHS[last.getMonth()];
  if (start.getFullYear() === last.getFullYear()) return a === b ? `${a} ${last.getFullYear()}` : `${a}–${b} ${last.getFullYear()}`;
  return `${a} ${start.getFullYear()}–${b} ${last.getFullYear()}`;
}

export const monthShort = (iso: string) => {
  const d = new Date(iso);
  return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
};

export const toDateInput = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
