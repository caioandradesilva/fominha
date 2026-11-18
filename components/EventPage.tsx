"use client";

import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { SignedIn, Splash } from "@/components/SignedIn";
import { Avatar, BackLink, Screen, StatusPill, primaryButton, secondaryButton } from "@/components/ui";
import type { Profile } from "@/lib/auth";
import { formatWhen, timeAgo } from "@/lib/format";
import { getSupabase } from "@/lib/supabase/client";

type EventRow = {
  id: string;
  group_id: string;
  name: string;
  restaurant_name: string | null;
  starts_at: string | null;
  status: "scheduled" | "live" | "closed";
  groups: { name: string } | null;
};
type Member = { user_id: string; role: "admin" | "member"; profiles: { nickname: string } | null };
type Entry = { id: string; user_id: string; count_final: number; created_at: string };
type Score = { userId: string; name: string; total: number; plates: number };

async function fetchEvent(id: string) {
  const supabase = getSupabase();
  const { data: ev } = await supabase
    .from("events")
    .select("id, group_id, name, restaurant_name, starts_at, status, groups(name)")
    .eq("id", id)
    .maybeSingle();
  if (!ev) return { event: null, members: [], entries: [] };
  const [m, e] = await Promise.all([
    supabase.from("group_members").select("user_id, role, profiles(nickname)").eq("group_id", ev.group_id),
    fetchEntries(id),
  ]);
  return { event: ev as unknown as EventRow, members: (m.data as Member[] | null) ?? [], entries: e };
}

async function fetchEntries(eventId: string): Promise<Entry[]> {
  const { data } = await getSupabase()
    .from("entries")
    .select("id, user_id, count_final, created_at")
    .eq("event_id", eventId)
    .order("created_at", { ascending: false });
  return (data as Entry[] | null) ?? [];
}

export function EventScreen() {
  return <SignedIn>{(profile) => <EventView profile={profile} />}</SignedIn>;
}

function EventView({ profile }: { profile: Profile }) {
  const { id } = useParams<{ id: string }>();
  const [event, setEvent] = useState<EventRow | null | undefined>(undefined);
  const [members, setMembers] = useState<Member[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [sheetOpen, setSheetOpen] = useState(false);

  // Carga inicial + placar ao vivo (Realtime): qualquer prato novo, corrigido ou
  // apagado, ou mudança no status do evento, recarrega os dados em todos os celulares.
  useEffect(() => {
    let active = true;
    const supabase = getSupabase();
    fetchEvent(id).then((r) => {
      if (!active) return;
      setEvent(r.event);
      setMembers(r.members);
      setEntries(r.entries);
    });
    const channel = supabase
      .channel(`event-${id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "entries", filter: `event_id=eq.${id}` }, () => {
        fetchEntries(id).then((e) => active && setEntries(e));
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "events", filter: `id=eq.${id}` }, () => {
        fetchEvent(id).then((r) => {
          if (!active) return;
          setEvent(r.event);
          setEntries(r.entries);
        });
      })
      .subscribe();
    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [id]);

  const scores = useMemo<Score[]>(() => {
    const map = new Map<string, Score>();
    for (const m of members) {
      map.set(m.user_id, { userId: m.user_id, name: m.profiles?.nickname ?? "?", total: 0, plates: 0 });
    }
    for (const e of entries) {
      const s = map.get(e.user_id) ?? { userId: e.user_id, name: "?", total: 0, plates: 0 };
      s.total += e.count_final;
      s.plates += 1;
      map.set(e.user_id, s);
    }
    return [...map.values()].sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
  }, [members, entries]);

  if (event === undefined) return <Splash />;
  if (event === null) {
    return (
      <Screen>
        <BackLink href="/" />
        <h1 className="font-display text-2xl font-extrabold">Evento não encontrado</h1>
        <p className="text-muted">Ele pode ter sido apagado, ou você não faz parte deste grupo.</p>
      </Screen>
    );
  }

  const isAdmin = members.some((m) => m.user_id === profile.id && m.role === "admin");
  const nameOf = (uid: string) => members.find((m) => m.user_id === uid)?.profiles?.nickname ?? "?";

  async function setStatus(status: "live" | "closed") {
    const patch =
      status === "live"
        ? { status, started_at: new Date().toISOString() }
        : { status, closed_at: new Date().toISOString() };
    const { data } = await getSupabase().from("events").update(patch).eq("id", id).select("status").single();
    if (data) setEvent((ev) => (ev ? { ...ev, status: data.status } : ev));
  }

  async function closeEvent() {
    if (!window.confirm(`Encerrar o ${event!.name}? O placar congela e o pódio é gerado.`)) return;
    await setStatus("closed");
  }

  async function addPlate(count: number) {
    const { error } = await getSupabase()
      .from("entries")
      .insert({ event_id: id, user_id: profile.id, count_final: count });
    if (!error) setEntries(await fetchEntries(id));
    return !error;
  }

  async function undo(entryId: string) {
    if (!window.confirm("Apagar este prato?")) return;
    await getSupabase().from("entries").delete().eq("id", entryId);
    setEntries(await fetchEntries(id));
  }

  return (
    <>
      <Screen className={event.status === "live" ? "!pb-32" : ""}>
        <div className="flex items-center gap-2">
          <BackLink href={`/g/${event.group_id}`} />
          <div className="flex min-w-0 flex-1 flex-col">
            <h1 className="truncate font-display text-[22px] leading-tight font-extrabold">{event.name}</h1>
            <span className="truncate text-[13px] text-muted">
              {[event.restaurant_name, event.groups?.name].filter(Boolean).join(" · ")}
            </span>
          </div>
          <StatusPill status={event.status} />
        </div>

        {event.status === "scheduled" && (
          <Lobby event={event} scores={scores} isAdmin={isAdmin} onStart={() => setStatus("live")} />
        )}
        {event.status === "live" && (
          <Live scores={scores} entries={entries} meId={profile.id} nameOf={nameOf} onUndo={undo} />
        )}
        {event.status === "closed" && <Podium scores={scores} entries={entries} />}
      </Screen>

      {event.status === "live" && (
        <div className="fixed inset-x-0 bottom-0 border-t border-line bg-white">
          <div className="mx-auto flex max-w-md gap-2.5 px-5 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
            {isAdmin && (
              <button onClick={closeEvent} className="h-13 shrink-0 rounded-2xl border border-line-strong px-4 text-sm font-semibold">
                Encerrar
              </button>
            )}
            <button onClick={() => setSheetOpen(true)} className={primaryButton}>
              Registrar prato
            </button>
          </div>
        </div>
      )}

      {sheetOpen && <PlateSheet onClose={() => setSheetOpen(false)} onConfirm={addPlate} />}
    </>
  );
}

function Lobby({ event, scores, isAdmin, onStart }: { event: EventRow; scores: Score[]; isAdmin: boolean; onStart: () => void }) {
  return (
    <>
      <div className="flex flex-col gap-1 rounded-2xl bg-ink px-5 py-4 text-white">
        <span className="text-xs font-bold tracking-wider text-gold uppercase">Marcado para</span>
        <span className="text-lg font-bold">{formatWhen(event.starts_at)}</span>
        <span className="text-sm text-[#d9d3cb]">{event.restaurant_name ?? "Restaurante a combinar"}</span>
      </div>

      <section className="flex flex-col gap-2">
        <h2 className="text-[15px] font-bold">Quem está no grupo ({scores.length})</h2>
        <div className="rounded-2xl border border-line bg-white px-4">
          {scores.map((s, i) => (
            <div key={s.userId} className={`flex h-12 items-center gap-3 ${i < scores.length - 1 ? "border-b border-[#f0ece6]" : ""}`}>
              <Avatar id={s.userId} name={s.name} size={30} />
              <span className="text-sm font-semibold">{s.name}</span>
            </div>
          ))}
        </div>
      </section>

      <div className="flex-1" />
      {isAdmin ? (
        <div className="flex flex-col gap-2">
          <button onClick={onStart} className={primaryButton}>
            Começar evento
          </button>
          <p className="text-center text-xs text-muted">Comece quando todo mundo estiver na mesa. O placar abre para o grupo.</p>
        </div>
      ) : (
        <p className="rounded-2xl bg-chip px-4 py-3 text-center text-sm text-[#4a443e]">
          O admin do grupo começa o evento na hora do rodízio. A tela atualiza sozinha.
        </p>
      )}
    </>
  );
}

function Live({
  scores,
  entries,
  meId,
  nameOf,
  onUndo,
}: {
  scores: Score[];
  entries: Entry[];
  meId: string;
  nameOf: (uid: string) => string;
  onUndo: (id: string) => void;
}) {
  const leader = scores[0];
  const second = scores[1];
  const max = Math.max(1, leader?.total ?? 1);
  const hasPlates = entries.length > 0;

  return (
    <>
      {hasPlates && leader && (
        <div className="flex items-center gap-4 rounded-[20px] bg-ink px-5 py-4 text-white">
          <Avatar id={leader.userId} name={leader.name} size={56} />
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="text-xs font-bold tracking-wider text-gold uppercase">Liderando</span>
            <span className="truncate text-lg font-bold">{leader.userId === meId ? "Você" : leader.name}</span>
            {second && leader.total > second.total && (
              <span className="text-[13px] text-[#d9d3cb]">
                {leader.total - second.total} {leader.total - second.total === 1 ? "peça" : "peças"} à frente
              </span>
            )}
            {second && leader.total === second.total && <span className="text-[13px] text-[#d9d3cb]">Empatado!</span>}
          </div>
          <div className="flex flex-col items-end">
            <span className="font-display text-[40px] leading-none font-extrabold">{leader.total}</span>
            <span className="text-xs text-[#d9d3cb]">peças</span>
          </div>
        </div>
      )}

      {!hasPlates && (
        <p className="rounded-2xl border border-dashed border-line-strong px-4 py-4 text-center text-sm text-muted">
          Placar aberto! Registre o primeiro prato.
        </p>
      )}

      <div className="rounded-2xl border border-line bg-white px-4 py-1">
        {scores.map((s, i) => (
          <div key={s.userId} className={`flex h-11 items-center gap-2.5 ${i < scores.length - 1 ? "border-b border-[#f0ece6]" : ""}`}>
            <span className="w-5 text-[13px] font-bold text-muted">{i + 1}</span>
            <span className="w-16 truncate text-sm font-semibold">{s.userId === meId ? "Você" : s.name}</span>
            <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-[#f0ece6]">
              <div
                className="h-2.5 rounded-full transition-[width] duration-500"
                style={{
                  width: `${Math.round((s.total / max) * 100)}%`,
                  background: i === 0 && s.total > 0 ? "#d33d15" : s.userId === meId ? "#1a1714" : "#c8bfb4",
                }}
              />
            </div>
            <span className="w-8 text-right text-[15px] font-bold">{s.total}</span>
          </div>
        ))}
      </div>

      {hasPlates && (
        <section className="flex flex-col gap-2">
          <h2 className="text-[15px] font-bold">Últimos pratos</h2>
          {entries.slice(0, 6).map((e) => (
            <div key={e.id} className="flex items-center gap-3 rounded-2xl border border-line bg-white px-3.5 py-2.5">
              <Avatar id={e.user_id} name={nameOf(e.user_id)} size={34} />
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm font-semibold">
                  {e.user_id === meId ? "Você" : nameOf(e.user_id)} registrou {e.count_final} {e.count_final === 1 ? "peça" : "peças"}
                </span>
                <span className="text-xs text-muted">{timeAgo(e.created_at)}</span>
              </div>
              {e.user_id === meId && (
                <button onClick={() => onUndo(e.id)} className="h-8 rounded-lg border border-line px-2.5 text-xs font-semibold">
                  Desfazer
                </button>
              )}
            </div>
          ))}
        </section>
      )}
    </>
  );
}

function Podium({ scores, entries }: { scores: Score[]; entries: Entry[] }) {
  const ranked = scores.filter((s) => s.total > 0);
  const total = entries.reduce((sum, e) => sum + e.count_final, 0);
  const avg = ranked.length ? total / ranked.length : 0;
  const [first, second, third] = ranked;

  if (!first) {
    return <p className="rounded-2xl bg-chip px-4 py-4 text-center text-sm text-muted">Evento encerrado sem pratos registrados.</p>;
  }

  const block = (s: Score | undefined, place: number, height: number, bg: string, fg = "#1a1714") =>
    s && (
      <div className="flex w-[30%] flex-col items-center gap-2">
        <Avatar id={s.userId} name={s.name} size={place === 1 ? 60 : 50} />
        <span className="w-full truncate text-center text-sm font-bold">{s.name}</span>
        <div
          className="flex w-full flex-col items-center justify-center rounded-t-2xl"
          style={{ height, background: bg, color: fg }}
        >
          <span className="font-display text-3xl font-extrabold">{s.total}</span>
          <span className="text-xs opacity-80">{place}º lugar</span>
        </div>
      </div>
    );

  return (
    <>
      <div className="flex flex-col items-center gap-1 text-center">
        <span className="text-xs font-bold tracking-widest text-tomato-dark uppercase">Fominha da noite</span>
        <span className="font-display text-[44px] leading-none font-extrabold">{first.name}</span>
        <span className="text-base text-muted">
          {first.total} peças{second ? ` · ${first.total - second.total} a mais que ${second.name}` : ""}
        </span>
      </div>

      <div className="flex h-[250px] items-end justify-center gap-2.5">
        {block(second, 2, 108, "#e7e2db")}
        {block(first, 1, 140, "#d33d15", "#ffffff")}
        {block(third, 3, 84, "#e7e2db")}
      </div>

      <div className="grid grid-cols-3 gap-2.5">
        <Stat value={String(total)} label="peças no grupo" />
        <Stat value={avg.toFixed(1).replace(".", ",")} label="média por pessoa" />
        <Stat value={String(entries.length)} label="pratos" />
      </div>

      {ranked.length > 3 && (
        <div className="rounded-2xl border border-line bg-white px-4">
          {ranked.slice(3).map((s, i) => (
            <div key={s.userId} className={`flex h-11 items-center gap-3 ${i < ranked.length - 4 ? "border-b border-[#f0ece6]" : ""}`}>
              <span className="w-5 text-[13px] font-bold text-muted">{i + 4}</span>
              <span className="flex-1 text-sm font-semibold">{s.name}</span>
              <span className="text-[15px] font-bold">{s.total}</span>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-2xl border border-line bg-white p-3">
      <span className="text-xl font-bold">{value}</span>
      <span className="text-xs text-muted">{label}</span>
    </div>
  );
}

function PlateSheet({ onClose, onConfirm }: { onClose: () => void; onConfirm: (count: number) => Promise<boolean> }) {
  const [count, setCount] = useState(8);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  async function confirm() {
    setBusy(true);
    setError(false);
    const ok = await onConfirm(count);
    if (ok) onClose();
    else {
      setError(true);
      setBusy(false);
    }
  }

  const step = (d: number) => setCount((c) => Math.min(60, Math.max(1, c + d)));

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-[rgba(26,23,20,0.55)]" onClick={onClose}>
      <div
        role="dialog"
        aria-label="Registrar prato"
        className="mx-auto flex w-full max-w-md flex-col gap-5 rounded-t-3xl bg-cream px-5 pt-3 pb-[max(1.5rem,env(safe-area-inset-bottom))]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto h-1.5 w-10 rounded-full bg-line-strong" />
        <h2 className="font-display text-2xl font-extrabold">Quantas peças no prato?</h2>
        <div className="flex items-center justify-between">
          <button onClick={() => step(-1)} aria-label="Diminuir uma peça" className="flex h-14 w-14 items-center justify-center rounded-full border border-line bg-white text-2xl">
            −
          </button>
          <div className="flex flex-col items-center">
            <span className="font-display text-7xl leading-none font-extrabold">{count}</span>
            <span className="text-sm text-muted">peças</span>
          </div>
          <button onClick={() => step(1)} aria-label="Somar uma peça" className="flex h-14 w-14 items-center justify-center rounded-full border border-line bg-white text-2xl">
            +
          </button>
        </div>
        <div className="flex justify-center gap-2">
          {[4, 6, 8, 10, 12].map((n) => (
            <button
              key={n}
              onClick={() => setCount(n)}
              className={`h-9 rounded-full border px-3.5 text-sm font-semibold ${count === n ? "border-ink bg-ink text-white" : "border-line-strong bg-white"}`}
            >
              {n}
            </button>
          ))}
        </div>
        {error && <p className="text-center text-sm text-tomato-dark">Não salvou. Confira a internet e tente de novo.</p>}
        <button onClick={confirm} disabled={busy} className={primaryButton}>
          {busy ? "Salvando…" : "Confirmar"}
        </button>
        <button onClick={onClose} className={secondaryButton + " !border-0 !bg-transparent"}>
          Cancelar
        </button>
        <p className="-mt-2 text-center text-xs text-muted">A foto com contagem automática chega na próxima versão.</p>
      </div>
    </div>
  );
}
