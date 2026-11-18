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
export function defaultEventLocal(): string {
  const d = new Date();
  if (d.getHours() >= 20) d.setDate(d.getDate() + 1);
  d.setHours(20, 0, 0, 0);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function monthName(): string {
  return new Intl.DateTimeFormat("pt-BR", { month: "long", timeZone: TZ }).format(new Date());
}
