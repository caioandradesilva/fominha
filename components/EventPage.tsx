"use client";

import { useParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { SignedIn, Splash } from "@/components/SignedIn";
import { Avatar, BackLink, Screen, StatusPill, primaryButton, secondaryButton } from "@/components/ui";
import type { Profile } from "@/lib/auth";
import { formatWhen, timeAgo } from "@/lib/format";
import { QuickPanel } from "@/components/QuickPieces";
import { BoatSheet, type Boat } from "@/components/BoatSheet";
import type { Candidate } from "@/lib/duplicates";
import { entryPoints, isPoints, normalizeScoring, scoringSummary, unitLabel, type Scoring } from "@/lib/scoring";
import { LeaderCard, RankList } from "@/components/RankList";
import { StoryButton } from "@/components/StoryShare";
import { SaveAccountNudge } from "@/components/SaveAccount";
import { EventTour } from "@/components/EventTour";
import { reportError } from "@/lib/telemetry";
import { EntryEditSheet, RecordsSheet, editNote, entryAction, type RecordEntry, type RecordsFilter } from "@/components/Records";
import { PhotoSheet } from "@/components/PhotoSheet";
import { getSupabase } from "@/lib/supabase/client";

type EventRow = {
  id: string;
  group_id: string;
  name: string;
  restaurant_name: string | null;
  starts_at: string | null;
  status: "scheduled" | "live" | "closed";
  groups: { name: string; scoring?: unknown } | null;
};
type Member = { user_id: string; role: "admin" | "member"; profiles: { nickname: string } | null };
type Entry = RecordEntry;
type Score = { userId: string; name: string; total: number; pieces: number; plates: number };

async function fetchEvent(id: string) {
  const supabase = getSupabase();
  const { data: ev } = await supabase
    .from("events")
    .select("id, group_id, name, restaurant_name, starts_at, status, groups(name, scoring)")
    .eq("id", id)
    .maybeSingle();
  if (!ev) return { event: null, members: [], entries: [] };
  const [m, e] = await Promise.all([fetchMembers(ev.group_id), fetchEntries(id)]);
  return { event: ev as unknown as EventRow, members: m, entries: e };
}

async function fetchMembers(groupId: string): Promise<Member[]> {
  const { data } = await getSupabase().from("group_members").select("user_id, role, profiles(nickname)").eq("group_id", groupId);
  return (data as Member[] | null) ?? [];
}

async function fetchBoats(eventId: string): Promise<Boat[]> {
  const { data } = await getSupabase()
    .from("boats")
    .select("id, created_by, counts, total, created_at, photo_path, edited_by, total_original")
    .eq("event_id", eventId)
    .order("created_at", { ascending: true });
  return (data as Boat[] | null) ?? [];
}

async function fetchEntries(eventId: string): Promise<Entry[]> {
  const { data } = await getSupabase()
    .from("entries")
    .select("id, user_id, count_final, created_at, photo_path, ai_result, edited_by, edited_at, count_original")
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
  const [boats, setBoats] = useState<Boat[]>([]);
  const [boatSheet, setBoatSheet] = useState<{ editing?: Boat } | null>(null);
  const [records, setRecords] = useState<RecordsFilter | null>(null);
  const [editing, setEditing] = useState<Entry | null>(null);
  const [toast, setToast] = useState<{ label: string; entryId?: string; failed?: boolean } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    fetchBoats(id).then((b) => active && setBoats(b));
    let channel: ReturnType<typeof supabase.channel> | null = null;
    // O canal ao vivo precisa do token do usuário para as regras de acesso valerem.
    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return;
      if (data.session) await supabase.realtime.setAuth(data.session.access_token);
      channel = supabase
        .channel(`event-${id}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "entries", filter: `event_id=eq.${id}` }, () => {
          fetchEntries(id).then((e) => active && setEntries(e));
        })
        .on("postgres_changes", { event: "*", schema: "public", table: "boats", filter: `event_id=eq.${id}` }, () => {
          fetchBoats(id).then((b) => active && setBoats(b));
        })
        .on("postgres_changes", { event: "*", schema: "public", table: "group_members" }, () => {
          fetchEvent(id).then((r) => active && setMembers(r.members));
        })
        .on("postgres_changes", { event: "UPDATE", schema: "public", table: "events", filter: `id=eq.${id}` }, () => {
          fetchEvent(id).then((r) => {
            if (!active) return;
            setEvent(r.event);
            setEntries(r.entries);
          });
        })
        .subscribe();
    });
    // Celular que ficou em segundo plano pode perder a conexão ao vivo: recarrega tudo ao voltar
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      fetchEvent(id).then((r) => {
        if (!active) return;
        setEvent(r.event);
        setMembers(r.members);
        setEntries(r.entries);
      });
      fetchBoats(id).then((b) => active && setBoats(b));
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      active = false;
      document.removeEventListener("visibilitychange", onVisible);
      if (channel) supabase.removeChannel(channel);
    };
  }, [id]);

  const scoring = useMemo<Scoring>(() => normalizeScoring(event?.groups?.scoring), [event?.groups?.scoring]);
  const scores = useMemo<Score[]>(() => {
    const map = new Map<string, Score>();
    for (const m of members) {
      map.set(m.user_id, { userId: m.user_id, name: m.profiles?.nickname ?? "?", total: 0, pieces: 0, plates: 0 });
    }
    for (const e of entries) {
      const s = map.get(e.user_id) ?? { userId: e.user_id, name: "?", total: 0, pieces: 0, plates: 0 };
      s.total += entryPoints(e, scoring);
      s.pieces += e.count_final;
      s.plates += 1;
      map.set(e.user_id, s);
    }
    return [...map.values()].sort((a, b) => b.total - a.total || b.pieces - a.pieces || a.name.localeCompare(b.name));
  }, [members, entries, scoring]);

  // Quantas peças de cada tipo EU registrei pelo registro rápido (aparece no canto de cada botão)
  const myCounts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const e of entries) {
      if (e.user_id !== profile.id || e.ai_result?.fonte !== "rapido") continue;
      for (const [k, v] of Object.entries(e.ai_result.por_tipo ?? {})) c[k] = (c[k] ?? 0) + v;
    }
    return c;
  }, [entries, profile.id]);

  // Saldo da barca: tudo o que as fotos de barca contaram, menos o que o grupo já registrou no toque rápido
  const boatTotal = boats.reduce((a, b) => a + b.total, 0);
  const boatCounts = useMemo(() => {
    if (boats.length === 0) return null;
    const c: Record<string, number> = {};
    for (const b of boats) for (const [k, v] of Object.entries(b.counts)) c[k] = (c[k] ?? 0) + v;
    return c;
  }, [boats]);
  const remaining = useMemo(() => {
    if (boats.length === 0) return null;
    const r: Record<string, number> = {};
    for (const b of boats) for (const [k, v] of Object.entries(b.counts)) r[k] = (r[k] ?? 0) + v;
    for (const e of entries) {
      if (e.ai_result?.fonte !== "rapido") continue;
      for (const [k, v] of Object.entries(e.ai_result.por_tipo ?? {})) r[k] = (r[k] ?? 0) - v;
    }
    return r;
  }, [boats, entries]);

  function showToast(t: { label: string; entryId?: string; failed?: boolean }) {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(t);
    toastTimer.current = setTimeout(() => setToast(null), 4000);
  }

  // Quem entra no grupo depois de a tela abrir não estava na lista de membros e aparecia como "?".
  // Ao chegar registro ou barca de alguém desconhecido, recarrega os membros.
  const groupId = event?.group_id;
  const hasUnknown = useMemo(() => {
    const known = new Set(members.map((m) => m.user_id));
    return entries.some((e) => !known.has(e.user_id)) || boats.some((b) => !known.has(b.created_by));
  }, [members, entries, boats]);
  const dupCandidates = useMemo<Candidate[]>(
    () => [
      ...boats.map((b) => ({ id: b.id, kind: "barca" as const, userId: b.created_by, createdAt: b.created_at, counts: b.counts, photoPath: b.photo_path })),
      ...entries
        .filter((e) => e.user_id === profile.id && e.ai_result?.fonte === "foto" && e.ai_result.por_tipo)
        .map((e) => ({ id: e.id, kind: "prato" as const, userId: e.user_id, createdAt: e.created_at, counts: e.ai_result!.por_tipo!, photoPath: e.photo_path ?? null })),
    ],
    [boats, entries, profile.id],
  );
  useEffect(() => {
    if (!groupId || !hasUnknown) return;
    let active = true;
    fetchMembers(groupId).then((m) => active && setMembers(m));
    return () => {
      active = false;
    };
  }, [groupId, hasUnknown]);

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
  const canEdit = (e: Entry) => !e.id.startsWith("tmp-") && (isAdmin || (e.user_id === profile.id && event.status === "live"));
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

  // Registro rápido: cada toque vira +1 na hora (otimista) e o placar de todos atualiza pelo Realtime.
  async function quickAdd(tipo: string) {
    if (remaining && tipo !== "Outra" && (remaining[tipo] ?? 0) <= 0) {
      const ok = window.confirm(
        `Pela contagem da barca, não sobrou ${tipo}. Registrar mesmo assim?\n\nSe a IA errou, toque em "Corrigir" na barca para ajustar.`,
      );
      if (!ok) return;
    }
    navigator.vibrate?.(12);
    const tempId = `tmp-${crypto.randomUUID()}`;
    const ai_result = { fonte: "rapido", por_tipo: { [tipo]: 1 } };
    setEntries((list) => [{ id: tempId, user_id: profile.id, count_final: 1, created_at: new Date().toISOString(), ai_result }, ...list]);
    showToast({ label: `+1 ${tipo}` });
    const { data, error } = await getSupabase()
      .from("entries")
      .insert({ event_id: id, user_id: profile.id, count_final: 1, ai_result })
      .select("id")
      .single();
    if (error || !data) {
      setEntries((list) => list.filter((e) => e.id !== tempId));
      const label = error?.message.includes("rate_limited") ? "Calma! Muitos toques seguidos. Espere uns segundos." : "Não salvou. Confira a internet.";
      if (!error?.message.includes("rate_limited")) reportError("toque", error?.message ?? "sem dados", { tipo });
      showToast({ label, failed: true });
      return;
    }
    setEntries((list) => list.map((e) => (e.id === tempId ? { ...e, id: data.id } : e)));
    setToast((t) => (t && t.label === `+1 ${tipo}` && !t.entryId ? { ...t, entryId: data.id } : t));
  }

  async function undoToast() {
    const entryId = toast?.entryId;
    setToast(null);
    if (entryId) await undo(entryId, false);
  }

  async function undo(entryId: string, ask = true) {
    if (entryId.startsWith("tmp-")) return;
    if (ask && !window.confirm("Apagar este registro?")) return;
    await getSupabase().from("entries").delete().eq("id", entryId);
    setEntries(await fetchEntries(id));
  }

  return (
    <>
      <Screen className={event.status === "live" ? "!pb-[290px]" : ""}>
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
          <Lobby event={event} scores={scores} scoring={scoring} isAdmin={isAdmin} onStart={() => setStatus("live")} />
        )}
        {event.status === "live" && (
          <Live
            scores={scores}
            scoring={scoring}
            event={event}
            entries={entries}
            meId={profile.id}
            nameOf={nameOf}
            canEdit={canEdit}
            onEdit={setEditing}
            onOpenRecords={setRecords}
            boats={boats}
            remaining={remaining}
            onEditBoat={(b) => setBoatSheet({ editing: b })}
          />
        )}
        {event.status === "closed" && <Podium scores={scores} scoring={scoring} event={event} entries={entries} isAdmin={isAdmin} onOpenRecords={setRecords} />}
      </Screen>

      {event.status === "live" && (
        <div className="fixed inset-x-0 bottom-0 border-t border-line bg-white">
          <div className="mx-auto max-w-md px-4 pt-2.5" data-tour="pecas">
            <QuickPanel
              myCounts={myCounts}
              remaining={remaining}
              boatCounts={boatCounts}
              boatTotal={boatTotal}
              onTap={quickAdd}
              toast={toast}
              onUndoToast={undoToast}
            />
          </div>
          <div className="mx-auto flex max-w-md gap-2.5 px-4 pt-2.5 pb-[max(1rem,env(safe-area-inset-bottom))]">
            {isAdmin && (
              <button onClick={closeEvent} className="h-13 shrink-0 rounded-2xl border border-line-strong px-4 text-sm font-semibold">
                Encerrar
              </button>
            )}
            <button onClick={() => setSheetOpen(true)} className={primaryButton + " gap-2"} data-tour="foto">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" />
                <circle cx="12" cy="13.5" r="3.5" />
              </svg>
              Fotografar
            </button>
          </div>
        </div>
      )}

      <EventTour eventId={id} enabled={event.status === "live" && !entries.some((e) => e.user_id === profile.id)} />

      {boatSheet && (
        <BoatSheet
          eventId={id}
          userId={profile.id}
          editing={boatSheet.editing}
          onClose={() => setBoatSheet(null)}
          onSaved={() => fetchBoats(id).then(setBoats)}
        />
      )}

      {records && !editing && (
        <RecordsSheet
          entries={entries}
          filter={records}
          meId={profile.id}
          nameOf={nameOf}
          canEdit={canEdit}
          onEdit={setEditing}
          onClose={() => setRecords(null)}
        />
      )}

      {editing && (
        <EntryEditSheet
          entry={editing}
          meId={profile.id}
          nameOf={nameOf}
          onClose={() => setEditing(null)}
          onSaved={() => fetchEntries(id).then(setEntries)}
        />
      )}

      {sheetOpen && (
        <PhotoSheet
          eventId={id}
          userId={profile.id}
          candidates={dupCandidates}
          nameOf={nameOf}
          onClose={() => setSheetOpen(false)}
          onSaved={() => {
            fetchEntries(id).then(setEntries);
            fetchBoats(id).then(setBoats);
          }}
        />
      )}
    </>
  );
}

function Lobby({
  event,
  scores,
  scoring,
  isAdmin,
  onStart,
}: {
  event: EventRow;
  scores: Score[];
  scoring: Scoring;
  isAdmin: boolean;
  onStart: () => void;
}) {
  return (
    <>
      <div className="flex flex-col gap-1 rounded-2xl bg-ink px-5 py-4 text-white">
        <span className="text-xs font-bold tracking-wider text-gold uppercase">Marcado para</span>
        <span className="text-lg font-bold">{formatWhen(event.starts_at)}</span>
        <span className="text-sm text-[#d9d3cb]">{event.restaurant_name ?? "Restaurante a combinar"}</span>
      </div>

      <p className="rounded-xl bg-chip px-3 py-2 text-[13px] text-muted">
        <span className="font-semibold text-ink">Pontuação:</span> {scoringSummary(scoring)}
        {isAdmin && " · muda na página do grupo"}
      </p>

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
  scoring,
  event,
  entries,
  meId,
  nameOf,
  canEdit,
  onEdit,
  onOpenRecords,
  boats,
  remaining,
  onEditBoat,
}: {
  scores: Score[];
  scoring: Scoring;
  event: EventRow;
  entries: Entry[];
  meId: string;
  nameOf: (uid: string) => string;
  canEdit: (e: Entry) => boolean;
  onEdit: (e: Entry) => void;
  onOpenRecords: (f: RecordsFilter) => void;
  boats: Boat[];
  remaining: Record<string, number> | null;
  onEditBoat: (b: Boat) => void;
}) {
  const leader = scores[0];
  const second = scores[1];
  const hasPlates = entries.length > 0;

  return (
    <>
      {hasPlates && leader && (
        <LeaderCard
          leader={leader}
          second={second}
          meId={meId}
          unit={isPoints(scoring) ? "pontos" : "peças"}
          gapLabel={(n) => `${n} ${unitLabel(scoring, n)}`}
        />
      )}

      {!hasPlates && (
        <p className="rounded-2xl border border-dashed border-line-strong px-4 py-4 text-center text-sm text-muted">
          Placar aberto! Toque nas peças lá embaixo ou fotografe o prato.
        </p>
      )}

      <RankList scores={scores} meId={meId} onPick={(uid) => onOpenRecords(uid === meId ? "me" : uid)} />
      {isPoints(scoring) && <p className="-mt-2 text-xs text-muted">Pontuação do grupo: {scoringSummary(scoring)}</p>}
      {hasPlates && <StoryButton variant="parcial" event={event} scores={scores} scoring={scoring} entries={entries} />}
      <SaveAccountNudge
        eventId={event.id}
        variant="live"
        myRegs={entries.filter((e) => e.user_id === meId).length}
        myScore={scores.find((x) => x.userId === meId)?.total ?? 0}
        unit={isPoints(scoring) ? "pontos" : "peças"}
      />

      {boats.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-[15px] font-bold">Barcas</h2>
          {boats.map((b, i) => (
            <div key={b.id} className="flex items-center gap-3 rounded-2xl border border-line bg-white px-3.5 py-2.5">
              <span className="flex h-[34px] w-[34px] items-center justify-center rounded-full bg-gold-soft font-display text-sm font-extrabold">{i + 1}</span>
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm font-semibold">
                  {b.total} peças · foto de {b.created_by === meId ? "você" : nameOf(b.created_by)}
                </span>
                <span className="truncate text-xs text-muted">
                  {timeAgo(b.created_at)}
                  {b.edited_by && (
                    <span className="text-tomato-dark">
                      {" "}· corrigida por {b.edited_by === meId ? "você" : nameOf(b.edited_by)}
                      {b.total_original != null && b.total_original !== b.total ? ` · era ${b.total_original}` : ""}
                    </span>
                  )}
                </span>
              </div>
              <button onClick={() => onEditBoat(b)} className="h-8 rounded-lg border border-line px-2.5 text-xs font-semibold">
                Corrigir
              </button>
            </div>
          ))}
          {remaining && Object.values(remaining).some((v) => v < 0) && (
            <p className="rounded-xl bg-gold-soft px-3 py-2 text-[13px] text-[#5c3e00]">
              O grupo registrou mais peças do que a barca tinha em algum tipo. Se a IA contou errado, toque em Corrigir.
            </p>
          )}
        </section>
      )}

      {hasPlates && (
        <section className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <h2 className="text-[15px] font-bold">Últimos registros</h2>
            <button onClick={() => onOpenRecords("me")} className="text-sm font-semibold text-tomato-dark">
              Meus registros
            </button>
          </div>
          {entries.slice(0, 6).map((e) => (
            <div key={e.id} className="flex items-center gap-3 rounded-2xl border border-line bg-white px-3.5 py-2.5">
              <Avatar id={e.user_id} name={nameOf(e.user_id)} size={34} />
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm font-semibold">
                  {e.user_id === meId ? "Você" : nameOf(e.user_id)} {entryAction(e)}
                </span>
                <span className="truncate text-xs text-muted">
                  {timeAgo(e.created_at)}
                  {editNote(e, nameOf, meId) && <span className="text-tomato-dark"> · {editNote(e, nameOf, meId)}</span>}
                </span>
              </div>
              {canEdit(e) && (
                <button onClick={() => onEdit(e)} className="h-8 rounded-lg border border-line px-2.5 text-xs font-semibold">
                  Corrigir
                </button>
              )}
            </div>
          ))}
          {entries.length > 6 && (
            <button onClick={() => onOpenRecords("all")} className="h-10 text-sm font-semibold text-muted">
              Ver todos os {entries.length} registros
            </button>
          )}
        </section>
      )}
    </>
  );
}

function Podium({
  scores,
  scoring,
  event,
  entries,
  isAdmin,
  onOpenRecords,
}: {
  scores: Score[];
  scoring: Scoring;
  event: EventRow;
  entries: Entry[];
  isAdmin: boolean;
  onOpenRecords: (f: RecordsFilter) => void;
}) {
  const ranked = scores.filter((s) => s.total > 0);
  const total = entries.reduce((sum, e) => sum + e.count_final, 0);
  const avg = ranked.length ? total / ranked.length : 0;
  const [first, second, third] = ranked;

  if (!first) {
    return <p className="rounded-2xl bg-chip px-4 py-4 text-center text-sm text-muted">Evento encerrado sem pratos registrados.</p>;
  }

  // Peça mais comida pelo grupo (registro rápido + tipos que a IA encontrou nas fotos)
  const byType: Record<string, number> = {};
  for (const e of entries) for (const [k, v] of Object.entries(e.ai_result?.por_tipo ?? {})) if (k !== "Outra") byType[k] = (byType[k] ?? 0) + v;
  const topType = Object.entries(byType).sort((x, y) => y[1] - x[1])[0]?.[0];

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
        <span className="text-xs font-bold tracking-widest text-tomato-dark uppercase">Campeão da noite</span>
        <span className="font-display text-[44px] leading-none font-extrabold">{first.name}</span>
        <span className="text-base text-muted">
          {first.total} {unitLabel(scoring, first.total)}
          {isPoints(scoring) ? ` (${first.pieces} peças)` : ""}
          {second ? ` · ${first.total - second.total} a mais que ${second.name}` : ""}
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
        {topType ? <Stat value={topType} label="peça mais comida" /> : <Stat value={String(entries.length)} label="registros" />}
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

      <StoryButton variant="final" event={event} scores={scores} scoring={scoring} entries={entries} />
      <SaveAccountNudge
        eventId={event.id}
        variant="podium"
        myRegs={0}
        myScore={0}
        unit={isPoints(scoring) ? "pontos" : "peças"}
      />
      <button onClick={() => onOpenRecords(isAdmin ? "all" : "me")} className={secondaryButton}>
        {isAdmin ? "Conferir e corrigir registros" : "Ver meus registros"}
      </button>
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
