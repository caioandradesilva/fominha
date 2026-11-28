"use client";

import { useEffect, useState } from "react";
import { inputClass } from "@/components/ui";
import { KINDS, addRestaurant, norm, searchRestaurants, type Restaurant, type RestaurantKind } from "@/lib/restaurants";
import { track } from "@/lib/telemetry";

export function VerifiedBadge({ status, size = 16 }: { status: Restaurant["status"]; size?: number }) {
  if (status === "verificado")
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" role="img" aria-label="Restaurante verificado" className="shrink-0">
        <polygon points="12,1 15.44,3.69 19.78,4.22 20.31,8.56 23,12 20.31,15.44 19.78,19.78 15.44,20.31 12,23 8.56,20.31 4.22,19.78 3.69,15.44 1,12 3.69,8.56 4.22,4.22 8.56,3.69" fill="#1D6FE0" />
        <path d="M7.6 12.2l3 3 5.8-6" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  return <span className="shrink-0 rounded-full bg-chip px-2 py-0.5 text-[11px] font-semibold text-muted">não verificado</span>;
}

/**
 * Campo "Restaurante" do novo evento (backlog C3; telas CreateEvent e AddRestaurant do MVP):
 * busca na base; se não achar, cadastra ali mesmo como "não verificado".
 */
export function RestaurantPicker({
  userId,
  value,
  onChange,
}: {
  userId: string;
  value: Restaurant | null;
  onChange: (r: Restaurant | null) => void;
}) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Restaurant[] | null>(null);
  const [adding, setAdding] = useState(false);
  const [city, setCity] = useState("");
  const [kind, setKind] = useState<RestaurantKind>("sushi");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const term = q.trim();
    let active = true;
    const t = setTimeout(async () => {
      const r = term.length >= 2 ? await searchRestaurants(term) : null;
      if (active) setResults(r);
    }, 250);
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [q]);

  async function add() {
    if (q.trim().length < 2) return;
    setBusy(true);
    setError(null);
    const r = await addRestaurant(userId, { name: q, city, kind });
    setBusy(false);
    if (!r) return setError("Não deu para cadastrar. Tente de novo.");
    track("restaurant_added", { kind });
    setAdding(false);
    setQ("");
    onChange(r);
  }

  if (value)
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-line-strong bg-white px-4 py-3">
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="flex items-center gap-1.5">
            <span className="truncate text-base font-semibold">{value.name}</span>
            <VerifiedBadge status={value.status} />
          </span>
          {value.city && <span className="text-[13px] text-muted">{value.city}</span>}
        </div>
        <button type="button" onClick={() => onChange(null)} className="text-sm font-semibold text-tomato">
          Trocar
        </button>
      </div>
    );

  const exact = results?.some((r) => norm(r.name) === norm(q));

  return (
    <div className="flex flex-col gap-2">
      <input
        id="ev-rest"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setAdding(false);
        }}
        maxLength={80}
        autoComplete="off"
        placeholder="Buscar restaurante"
        className={inputClass}
      />
      {results && results.length > 0 && !adding && (
        <ul className="flex flex-col overflow-hidden rounded-2xl border border-line bg-white">
          {results.map((r) => (
            <li key={r.id} className="border-b border-[#f0ece6] last:border-0">
              <button
                type="button"
                onClick={() => {
                  onChange(r);
                  setQ("");
                }}
                className="flex w-full items-center gap-2 px-4 py-3 text-left"
              >
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-[15px] font-semibold">{r.name}</span>
                  {r.city && <span className="text-[12px] text-muted">{r.city}</span>}
                </span>
                <VerifiedBadge status={r.status} />
              </button>
            </li>
          ))}
        </ul>
      )}
      {results && !exact && !adding && (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="flex h-11 items-center justify-center rounded-xl border border-dashed border-line-strong text-sm font-semibold"
        >
          + Cadastrar &ldquo;{q.trim()}&rdquo;
        </button>
      )}
      {adding && (
        <div className="flex flex-col gap-3 rounded-2xl border border-line bg-white p-4">
          <p className="rounded-xl bg-gold-soft px-3 py-2 text-[13px] leading-snug text-[#5c3e00]">
            Ele aparece para todos como <strong>não verificado</strong> até o dono reivindicar.
          </p>
          <span className="text-[15px] font-bold">{q.trim()}</span>
          <input
            aria-label="Cidade"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            maxLength={60}
            placeholder="Cidade (ex.: Florianópolis)"
            className="h-12 rounded-xl border border-line-strong bg-white px-3.5 text-base outline-none focus:border-ink"
          />
          <div className="flex flex-wrap gap-2" role="group" aria-label="Tipo de rodízio">
            {KINDS.map((k) => (
              <button
                key={k.id}
                type="button"
                aria-pressed={kind === k.id}
                onClick={() => setKind(k.id)}
                className={`h-9 rounded-full border px-3.5 text-sm font-semibold ${kind === k.id ? "border-ink bg-ink text-white" : "border-line-strong bg-white"}`}
              >
                {k.label}
              </button>
            ))}
          </div>
          {error && <p className="text-sm text-tomato-dark">{error}</p>}
          <div className="flex gap-2">
            <button type="button" onClick={() => setAdding(false)} className="h-11 flex-1 rounded-xl border border-line-strong text-sm font-semibold">
              Cancelar
            </button>
            <button type="button" disabled={busy} onClick={add} className="h-11 flex-1 rounded-xl bg-ink text-sm font-semibold text-white disabled:opacity-50">
              {busy ? "Salvando…" : "Adicionar e usar"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
