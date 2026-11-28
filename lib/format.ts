const TZ = "America/Sao_Paulo";

/** "sáb, 23 nov · 20h00" */
export function formatWhen(iso: string | null): string {
  if (!iso) return "Data a combinar";
  const d = new Date(iso);
  const day = new Intl.DateTimeFormat("pt-BR", { weekday: "short", day: "numeric", month: "short", timeZone: TZ })
    .format(d)
    .replace(/\./g, "");
  const time = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: TZ }).format(d);
  return `${day} · ${time.replace(":", "h")}`;
}

/** "há 3 min" */
export function timeAgo(iso: string): string {
  const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return "agora";
  const m = Math.round(s / 60);
  if (m < 60) return `há ${m} min`;
  const h = Math.floor(m / 60);
  return `há ${h}h${String(m % 60).padStart(2, "0")}`;
}

/** Valor padrão para <input type="datetime-local">: hoje às 20h (ou amanhã, se já passou). */
/**
 * Data/hora sugerida ao criar um evento. Quase sempre o evento é criado na hora, na mesa:
 * a partir das 17h sugere agora (arredondado para baixo em 15 min); antes disso, hoje às 20h.
 * Nunca joga para o dia seguinte (bug do Rodízio #1 e #2).
 */
export function defaultEventLocal(): string {
  const d = new Date();
  if (d.getHours() >= 17) d.setMinutes(Math.floor(d.getMinutes() / 15) * 15, 0, 0);
  else d.setHours(20, 0, 0, 0);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function monthName(): string {
  return new Intl.DateTimeFormat("pt-BR", { month: "long", timeZone: TZ }).format(new Date());
}
