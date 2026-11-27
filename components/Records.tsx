"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { PieceArt, QUICK_PIECES } from "@/components/QuickPieces";
import { Avatar, primaryButton } from "@/components/ui";
import { timeAgo } from "@/lib/format";
import { getSupabase } from "@/lib/supabase/client";

export type RecordEntry = {
  id: string;
  user_id: string;
  count_final: number;
  created_at: string;
  photo_path?: string | null;
  edited_by?: string | null;
  edited_at?: string | null;
  count_original?: number | null;
  ai_result?: { fonte?: string; por_tipo?: Record<string, number>; [k: string]: unknown } | null;
};

/** Quem vê na lista: "me" (meus), "all" (todos) ou o id de uma pessoa. */
export type RecordsFilter = "me" | "all" | string;

const PIECE_IDS = new Set(QUICK_PIECES.map((p) => p.id));

/** "comeu 1 Joe", "fotografou 12 peças", "registrou 8 peças". */
export function entryAction(e: RecordEntry) {
  const n = e.count_final;
  if (e.ai_result?.fonte === "rapido") {
    const tipo = Object.keys(e.ai_result.por_tipo ?? {})[0] ?? "peça";
    return `comeu ${n} ${tipo}`;
  }
  const pecas = `${n} ${n === 1 ? "peça" : "peças"}`;
  return e.photo_path ? `fotografou ${pecas}` : `registrou ${pecas}`;
}

/** "corrigido por Caio · era 12", ou null se nunca foi corrigido. */
export function editNote(e: RecordEntry, nameOf: (uid: string) => string, meId: string) {
  if (!e.edited_by) return null;
  const who = e.edited_by === meId ? "você" : e.edited_by === e.user_id ? "a própria pessoa" : nameOf(e.edited_by);
  const was = e.count_original != null && e.count_original !== e.count_final ? ` · era ${e.count_original}` : "";
  return `corrigido por ${who}${was}`;
}

function Shell({ label, onClose, children }: { label: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end bg-[rgba(26,23,20,0.55)]" onClick={onClose}>
      <div
        role="dialog"
        aria-label={label}
        className="mx-auto flex max-h-[92dvh] w-full max-w-md flex-col gap-4 overflow-y-auto rounded-t-3xl bg-cream px-5 pt-3 pb-[max(1.5rem,env(safe-area-inset-bottom))]"
        onClick={(ev) => ev.stopPropagation()}
      >
        <div className="mx-auto h-1.5 w-10 shrink-0 rounded-full bg-line-strong" />
        {children}
      </div>
    </div>
  );
}

/**
 * Lista de registros do evento. "Meus" é o padrão; "Todos" e o filtro por pessoa
 * servem para conferir o placar. Corrigir aparece onde a pessoa tem permissão.
 */
export function RecordsSheet({
  entries,
  filter: initialFilter,
  meId,
  nameOf,
  canEdit,
  onEdit,
  onClose,
}: {
  entries: RecordEntry[];
  filter: RecordsFilter;
  meId: string;
  nameOf: (uid: string) => string;
  canEdit: (e: RecordEntry) => boolean;
  onEdit: (e: RecordEntry) => void;
  onClose: () => void;
}) {
  const [filter, setFilter] = useState<RecordsFilter>(initialFilter);
  const person = filter !== "me" && filter !== "all" ? filter : null;
  const list = useMemo(
    () =>
      entries.filter((e) => (filter === "all" ? true : filter === "me" ? e.user_id === meId : e.user_id === filter)),
    [entries, filter, meId],
  );
  const total = list.reduce((a, e) => a + e.count_final, 0);

  const chip = (value: RecordsFilter, text: string) => (
    <button
      key={value}
      onClick={() => setFilter(value)}
      aria-pressed={filter === value}
      className={`h-9 shrink-0 rounded-full px-3.5 text-sm font-semibold ${filter === value ? "bg-ink text-white" : "border border-line bg-white text-ink"}`}
    >
      {text}
    </button>
  );

  return (
    <Shell label="Registros" onClose={onClose}>
      <div className="flex items-end justify-between">
        <h2 className="font-display text-2xl font-extrabold">Registros</h2>
        <span className="text-sm text-muted">
          {list.length} {list.length === 1 ? "registro" : "registros"} · {total} {total === 1 ? "peça" : "peças"}
        </span>
      </div>
      <div className="-mx-5 flex gap-2 overflow-x-auto px-5">
        {chip("me", "Meus")}
        {chip("all", "Todos")}
        {person && person !== meId && chip(person, nameOf(person))}
      </div>

      {list.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line-strong px-4 py-4 text-center text-sm text-muted">Nenhum registro aqui.</p>
      ) : (
        <div className="rounded-2xl border border-line bg-white px-3.5">
          {list.map((e, i) => {
            const note = editNote(e, nameOf, meId);
            return (
              <div key={e.id} className={`flex items-center gap-3 py-2.5 ${i < list.length - 1 ? "border-b border-[#f0ece6]" : ""}`}>
                {e.ai_result?.fonte === "rapido" ? (
                  <span className="flex h-[34px] w-[34px] shrink-0 items-center justify-center">
                    <PieceArt id={Object.keys(e.ai_result.por_tipo ?? {})[0] ?? "Outra"} size={30} />
                  </span>
                ) : (
                  <Avatar id={e.user_id} name={nameOf(e.user_id)} size={34} />
                )}
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm font-semibold">
                    {e.user_id === meId ? "Você" : nameOf(e.user_id)} {entryAction(e)}
                  </span>
                  <span className="truncate text-xs text-muted">
                    {timeAgo(e.created_at)}
                    {note && <span className="text-tomato-dark"> · {note}</span>}
                  </span>
                </div>
                {canEdit(e) && (
                  <button onClick={() => onEdit(e)} className="h-8 shrink-0 rounded-lg border border-line px-2.5 text-xs font-semibold">
                    Corrigir
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
      <button onClick={onClose} className="h-10 text-sm font-semibold text-muted">
        Fechar
      </button>
    </Shell>
  );
}

/** Corrigir um registro: muda as peças por tipo (ou só o total, em registros antigos) ou apaga. */
export function EntryEditSheet({
  entry,
  meId,
  nameOf,
  onClose,
  onSaved,
}: {
  entry: RecordEntry;
  meId: string;
  nameOf: (uid: string) => string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const original = entry.ai_result?.por_tipo ?? {};
  const byType = Object.keys(original).length > 0 && Object.keys(original).every((k) => PIECE_IDS.has(k));
  const [counts, setCounts] = useState<Record<string, number>>(byType ? original : {});
  const [plain, setPlain] = useState(entry.count_final);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!entry.photo_path) return;
    let active = true;
    getSupabase()
      .storage.from("plates")
      .createSignedUrl(entry.photo_path, 600)
      .then(({ data }) => {
        if (active && data?.signedUrl) setPhotoUrl(data.signedUrl);
      });
    return () => {
      active = false;
    };
  }, [entry.photo_path]);

  const total = byType ? Object.values(counts).reduce((a, b) => a + b, 0) : plain;
  const changed = total !== entry.count_final || (byType && JSON.stringify(counts) !== JSON.stringify(original));
  const owner = entry.user_id === meId ? "seu" : `de ${nameOf(entry.user_id)}`;
  const note = editNote(entry, nameOf, meId);

  const bump = (id: string, d: number) =>
    setCounts((c) => {
      const n = Math.max(0, Math.min(200, (c[id] ?? 0) + d));
      const next = { ...c, [id]: n };
      if (n === 0) delete next[id];
      return next;
    });

  async function save() {
    if (total === 0) return remove();
    setBusy(true);
    setError(null);
    const { error: err } = await getSupabase()
      .from("entries")
      .update({
        count_final: total,
        ai_result: byType ? { ...(entry.ai_result ?? {}), por_tipo: counts } : entry.ai_result ?? null,
      })
      .eq("id", entry.id);
    setBusy(false);
    if (err) return setError("Não salvou. Só admins corrigem depois que o evento encerra.");
    onSaved();
    onClose();
  }

  async function remove() {
    if (!window.confirm(`Apagar este registro ${owner}? As ${entry.count_final} peças saem do placar.`)) return;
    setBusy(true);
    const { error: err } = await getSupabase().from("entries").delete().eq("id", entry.id);
    setBusy(false);
    if (err) return setError("Não apagou. Tente de novo.");
    onSaved();
    onClose();
  }

  return (
    <Shell label="Corrigir registro" onClose={onClose}>
      <div className="flex flex-col gap-0.5">
        <h2 className="font-display text-2xl font-extrabold">Corrigir registro {owner}</h2>
        <span className="text-sm text-muted">
          {entryAction(entry)} · {timeAgo(entry.created_at)}
          {note && <span className="text-tomato-dark"> · {note}</span>}
        </span>
      </div>

      {entry.photo_path &&
        (photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photoUrl} alt="Foto do registro" className="h-40 w-full shrink-0 rounded-2xl object-cover" />
        ) : (
          <div className="h-40 w-full shrink-0 animate-pulse rounded-2xl bg-chip" />
        ))}

      {entry.user_id !== meId && (
        <p className="rounded-xl bg-gold-soft px-3 py-2 text-[13px] text-[#5c3e00]">
          Você está corrigindo como admin. O grupo vê quem corrigiu e o valor anterior.
        </p>
      )}

      {byType ? (
        <div className="rounded-2xl border border-line bg-white px-3">
          {QUICK_PIECES.map((p, i) => {
            const n = counts[p.id] ?? 0;
            return (
              <div key={p.id} className={`flex h-13 items-center gap-3 ${i < QUICK_PIECES.length - 1 ? "border-b border-[#f0ece6]" : ""}`}>
                <PieceArt id={p.id} size={28} />
                <span className={`flex-1 text-[15px] font-semibold ${n ? "" : "text-muted"}`}>{p.label}</span>
                <button onClick={() => bump(p.id, -1)} aria-label={`Menos um ${p.label}`} className="flex h-9 w-9 items-center justify-center rounded-full border border-line text-lg">
                  −
                </button>
                <span className="w-7 text-center text-lg font-bold">{n}</span>
                <button onClick={() => bump(p.id, 1)} aria-label={`Mais um ${p.label}`} className="flex h-9 w-9 items-center justify-center rounded-full border border-line text-lg">
                  +
                </button>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex items-center justify-between rounded-2xl border border-line bg-white px-4 py-3">
          <button onClick={() => setPlain((v) => Math.max(0, v - 1))} aria-label="Menos uma peça" className="flex h-12 w-12 items-center justify-center rounded-full border border-line text-xl">
            −
          </button>
          <div className="flex flex-col items-center">
            <span className="font-display text-5xl leading-none font-extrabold">{plain}</span>
            <span className="text-sm text-muted">peças</span>
          </div>
          <button onClick={() => setPlain((v) => Math.min(200, v + 1))} aria-label="Mais uma peça" className="flex h-12 w-12 items-center justify-center rounded-full border border-line text-xl">
            +
          </button>
        </div>
      )}

      {error && <p className="text-center text-sm text-tomato-dark">{error}</p>}
      <button onClick={save} disabled={busy || !changed} className={primaryButton + (!changed ? " opacity-50" : "")}>
        {busy ? "Salvando…" : total === 0 ? "Apagar registro" : `Salvar · ${total} ${total === 1 ? "peça" : "peças"}`}
      </button>
      <button onClick={remove} disabled={busy} className="h-11 text-sm font-semibold text-[#b3261e]">
        Apagar registro
      </button>
    </Shell>
  );
}
