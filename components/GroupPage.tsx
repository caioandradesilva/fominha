"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { SignedIn, Splash } from "@/components/SignedIn";
import { Avatar, BackLink, Screen, StatusPill, primaryButton, secondaryButton, shareLink } from "@/components/ui";
import type { Profile } from "@/lib/auth";
import { formatWhen } from "@/lib/format";
import { MAX_WEIGHT, MIN_WEIGHT, normalizeScoring, scoringSummary, type Scoring } from "@/lib/scoring";
import { PieceArt, QUICK_PIECES } from "@/components/QuickPieces";
import { getSupabase } from "@/lib/supabase/client";

type Group = { id: string; name: string; invite_code: string; created_at: string; scoring?: unknown };
type Member = { user_id: string; role: "admin" | "member"; profiles: { nickname: string } | null };
type EventRow = { id: string; name: string; status: "scheduled" | "live" | "closed"; starts_at: string | null; restaurant_name: string | null };

async function fetchGroup(id: string) {
  const supabase = getSupabase();
  const [g, m, e] = await Promise.all([
    supabase.from("groups").select("id, name, invite_code, created_at, scoring").eq("id", id).maybeSingle(),
    supabase.from("group_members").select("user_id, role, profiles(nickname)").eq("group_id", id).order("joined_at"),
    supabase
      .from("events")
      .select("id, name, status, starts_at, restaurant_name")
      .eq("group_id", id)
      .order("created_at", { ascending: false }),
  ]);
  return {
    group: (g.data as Group | null) ?? null,
    members: (m.data as Member[] | null) ?? [],
    events: (e.data as EventRow[] | null) ?? [],
  };
}

export function GroupScreen() {
  return <SignedIn>{(profile) => <GroupLoader profile={profile} />}</SignedIn>;
}

function GroupLoader({ profile }: { profile: Profile }) {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const isNew = useSearchParams().get("novo") === "1";
  const [group, setGroup] = useState<Group | null | undefined>(undefined);
  const [members, setMembers] = useState<Member[]>([]);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [shareMsg, setShareMsg] = useState<string | null>(null);
  const [managing, setManaging] = useState<Member | null>(null);
  const [editingScore, setEditingScore] = useState(false);

  useEffect(() => {
    let active = true;
    const supabase = getSupabase();
    const load = () =>
      fetchGroup(id).then((r) => {
        if (!active) return;
        setGroup(r.group);
        setMembers(r.members);
        setEvents(r.events);
      });
    load();
    // Ao vivo: quem entra pelo convite e eventos novos aparecem sem recarregar a página
    let channel: ReturnType<typeof supabase.channel> | null = null;
    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return;
      if (data.session) await supabase.realtime.setAuth(data.session.access_token);
      channel = supabase
        .channel(`group-${id}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "group_members", filter: `group_id=eq.${id}` }, load)
        .on("postgres_changes", { event: "*", schema: "public", table: "events", filter: `group_id=eq.${id}` }, load)
        .subscribe();
    });
    // Celular que ficou em segundo plano pode perder a conexão ao vivo: recarrega ao voltar
    const onVisible = () => document.visibilityState === "visible" && load();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      active = false;
      document.removeEventListener("visibilitychange", onVisible);
      if (channel) supabase.removeChannel(channel);
    };
  }, [id]);

  if (group === undefined) return <Splash />;
  if (group === null) {
    return (
      <Screen>
        <BackLink href="/" />
        <h1 className="font-display text-2xl font-extrabold">Grupo não encontrado</h1>
        <p className="text-muted">Ele pode ter sido apagado, ou você não faz parte dele.</p>
      </Screen>
    );
  }

  const me = members.find((m) => m.user_id === profile.id);
  const isAdmin = me?.role === "admin";
  const inviteUrl = `${window.location.origin}/convite/${group.invite_code}`;

  async function invite() {
    const result = await shareLink(inviteUrl, `Bora competir no rodízio? Entra no grupo "${group!.name}" no Rodizium:`);
    setShareMsg(result === "copied" ? "Link copiado! Cole no grupo do WhatsApp." : result === "failed" ? inviteUrl : null);
  }

  const adminCount = members.filter((m) => m.role === "admin").length;

  async function leave() {
    const msg =
      isAdmin && adminCount === 1 && members.length > 1
        ? "Você é o único admin. Se sair, o membro mais antigo do grupo vira admin. Sair mesmo assim?"
        : "Sair do grupo? Você pode voltar pelo link de convite.";
    if (!window.confirm(msg)) return;
    await getSupabase().from("group_members").delete().eq("group_id", group!.id).eq("user_id", profile.id);
    router.replace("/");
  }

  return (
    <Screen>
      <div className="flex items-center gap-2">
        <BackLink href="/" />
        <div className="flex h-12 w-12 items-center justify-center rounded-[14px] bg-tomato-soft font-display text-xl font-extrabold text-tomato-dark">
          {group.name.charAt(0).toUpperCase()}
        </div>
        <div className="flex min-w-0 flex-1 flex-col">
          <h1 className="truncate font-display text-[22px] leading-tight font-extrabold">{group.name}</h1>
          <span className="text-[13px] text-muted">
            {members.length} {members.length === 1 ? "membro" : "membros"}
          </span>
        </div>
      </div>

      {isNew && members.length <= 1 && (
        <div className="flex flex-col gap-1 rounded-2xl bg-gold-soft px-4 py-3.5 text-[#5c3e00]">
          <span className="font-semibold">Grupo criado!</span>
          <span className="text-sm">Agora mande o link de convite no grupo do WhatsApp da galera.</span>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2.5">
        <button onClick={invite} className={primaryButton + " !h-12 text-[15px]"}>
          Convidar
        </button>
        <Link href={`/g/${group.id}/novo-evento`} className={secondaryButton}>
          Novo evento
        </Link>
      </div>
      {shareMsg && <p className="-mt-2 text-center text-sm break-all text-muted">{shareMsg}</p>}

      <section className="flex flex-col gap-2">
        <h2 className="text-[15px] font-bold">Eventos</h2>
        {events.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line-strong px-4 py-4 text-sm text-muted">
            Nenhum evento ainda. Marque o próximo rodízio em &quot;Novo evento&quot;.
          </p>
        ) : (
          <div className="rounded-2xl border border-line bg-white px-4">
            {events.map((ev, i) => (
              <Link
                key={ev.id}
                href={`/e/${ev.id}`}
                className={`flex items-center gap-3 py-3 ${i < events.length - 1 ? "border-b border-[#f0ece6]" : ""}`}
              >
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm font-semibold">{ev.name}</span>
                  <span className="truncate text-xs text-muted">
                    {formatWhen(ev.starts_at)}
                    {ev.restaurant_name ? ` · ${ev.restaurant_name}` : ""}
                  </span>
                </div>
                <StatusPill status={ev.status} />
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-[15px] font-bold">Pontuação</h2>
        <button
          onClick={() => isAdmin && setEditingScore(true)}
          disabled={!isAdmin}
          className="flex items-center gap-3 rounded-2xl border border-line bg-white px-4 py-3 text-left disabled:cursor-default"
        >
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="text-sm font-semibold">
              {normalizeScoring(group.scoring).modo === "pontos" ? "Pontos por peça" : "Contar peças"}
            </span>
            <span className="truncate text-xs text-muted">{scoringSummary(normalizeScoring(group.scoring))}</span>
          </span>
          {isAdmin && <span className="text-sm font-semibold text-tomato-dark">Mudar</span>}
        </button>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-[15px] font-bold">Membros</h2>
        <div className="grid grid-cols-4 gap-3">
          {members.map((m) => {
            const name = m.profiles?.nickname ?? "?";
            const body = (
              <>
                <Avatar id={m.user_id} name={name} size={48} />
                <span className="w-full truncate text-xs font-semibold">
                  {m.user_id === profile.id ? "Você" : name}
                </span>
                <span className={`h-4 rounded-full px-1.5 text-[10px] font-bold ${m.role === "admin" ? "bg-gold-soft text-[#5c3e00]" : "text-transparent"}`}>
                  admin
                </span>
              </>
            );
            return isAdmin ? (
              <button key={m.user_id} onClick={() => setManaging(m)} className="flex flex-col items-center gap-1 text-center">
                {body}
              </button>
            ) : (
              <div key={m.user_id} className="flex flex-col items-center gap-1 text-center">
                {body}
              </div>
            );
          })}
        </div>
        {isAdmin && members.length > 1 && (
          <p className="text-xs text-muted">Toque em alguém para tornar admin. Admins começam e encerram eventos e corrigem registros de qualquer pessoa.</p>
        )}
      </section>

      {editingScore && (
        <ScoringSheet
          groupId={group.id}
          initial={normalizeScoring(group.scoring)}
          onClose={() => setEditingScore(false)}
          onSaved={(sc) => setGroup({ ...group, scoring: sc })}
        />
      )}

      {managing && (
        <MemberSheet
          groupId={group.id}
          member={managing}
          isMe={managing.user_id === profile.id}
          adminCount={adminCount}
          onClose={() => setManaging(null)}
          onChanged={() => fetchGroup(group.id).then((r) => setMembers(r.members))}
        />
      )}

      <div className="flex-1" />
      <button onClick={leave} className="h-11 text-sm font-semibold text-[#b3261e]">
        Sair do grupo
      </button>
    </Screen>
  );
}

function MemberSheet({
  groupId,
  member,
  isMe,
  adminCount,
  onClose,
  onChanged,
}: {
  groupId: string;
  member: Member;
  isMe: boolean;
  adminCount: number;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const name = isMe ? "Você" : member.profiles?.nickname ?? "?";
  const admin = member.role === "admin";
  const lastAdmin = admin && adminCount === 1;

  async function run(fn: () => PromiseLike<{ error: { message: string } | null }>) {
    setBusy(true);
    setError(null);
    const { error: err } = await fn();
    setBusy(false);
    if (err) return setError(err.message.includes("last admin") ? "O grupo precisa de pelo menos um admin." : "Não deu certo. Tente de novo.");
    onChanged();
    onClose();
  }

  const setRole = (role: "admin" | "member") =>
    run(() => getSupabase().rpc("set_member_role", { p_group: groupId, p_user: member.user_id, p_role: role }));
  const removeMember = () => {
    if (!window.confirm(`Remover ${name} do grupo? Os registros dessa pessoa nos eventos continuam no placar.`)) return;
    run(() => getSupabase().from("group_members").delete().eq("group_id", groupId).eq("user_id", member.user_id));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-[rgba(26,23,20,0.55)]" onClick={onClose}>
      <div
        role="dialog"
        aria-label={`Opções de ${name}`}
        className="mx-auto flex w-full max-w-md flex-col gap-3 rounded-t-3xl bg-cream px-5 pt-3 pb-[max(1.5rem,env(safe-area-inset-bottom))]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto h-1.5 w-10 shrink-0 rounded-full bg-line-strong" />
        <div className="flex items-center gap-3">
          <Avatar id={member.user_id} name={member.profiles?.nickname ?? "?"} size={52} />
          <div className="flex flex-col">
            <span className="font-display text-xl font-extrabold">{name}</span>
            <span className="text-sm text-muted">{admin ? "Admin do grupo" : "Membro"}</span>
          </div>
        </div>
        {admin ? (
          <button onClick={() => setRole("member")} disabled={busy || lastAdmin} className={secondaryButton + (lastAdmin ? " opacity-50" : "")}>
            {isMe ? "Deixar de ser admin" : "Tirar de admin"}
          </button>
        ) : (
          <button onClick={() => setRole("admin")} disabled={busy} className={primaryButton}>
            Tornar admin
          </button>
        )}
        {lastAdmin && <p className="-mt-1 text-center text-xs text-muted">É o único admin. Torne outra pessoa admin antes.</p>}
        {!isMe && (
          <button onClick={removeMember} disabled={busy} className="h-11 text-sm font-semibold text-[#b3261e]">
            Remover do grupo
          </button>
        )}
        {error && <p className="text-center text-sm text-tomato-dark">{error}</p>}
        <button onClick={onClose} className="h-10 text-sm font-semibold text-muted">
          Cancelar
        </button>
      </div>
    </div>
  );
}

function ScoringSheet({
  groupId,
  initial,
  onClose,
  onSaved,
}: {
  groupId: string;
  initial: Scoring;
  onClose: () => void;
  onSaved: (s: Scoring) => void;
}) {
  const [modo, setModo] = useState<Scoring["modo"]>(initial.modo);
  const [pesos, setPesos] = useState<Record<string, number>>(() => {
    const base: Record<string, number> = { Temaki: 3 };
    return initial.modo === "pontos" ? { ...initial.pesos } : base;
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const bump = (id: string, d: number) =>
    setPesos((p) => ({ ...p, [id]: Math.min(MAX_WEIGHT, Math.max(MIN_WEIGHT, (p[id] ?? 1) + d)) }));

  async function save() {
    setBusy(true);
    setError(null);
    const clean: Record<string, number> = {};
    for (const [k, v] of Object.entries(pesos)) if (v !== 1) clean[k] = v;
    const scoring: Scoring = modo === "pontos" ? { modo, pesos: clean } : { modo: "pecas" };
    const { error: err } = await getSupabase().from("groups").update({ scoring }).eq("id", groupId);
    setBusy(false);
    if (err) return setError("Não salvou. Só admins mudam a pontuação.");
    onSaved(scoring);
    onClose();
  }

  const option = (value: Scoring["modo"], title: string, sub: string) => {
    const on = modo === value;
    return (
      <button
        type="button"
        aria-pressed={on}
        onClick={() => setModo(value)}
        className={`flex flex-1 flex-col items-start gap-0.5 rounded-2xl border-2 px-3.5 py-2.5 text-left ${on ? "border-ink bg-ink text-white" : "border-line bg-white text-ink"}`}
      >
        <span className="text-[15px] font-bold">{title}</span>
        <span className={`text-xs ${on ? "text-[#d8d1c8]" : "text-muted"}`}>{sub}</span>
      </button>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-[rgba(26,23,20,0.55)]" onClick={onClose}>
      <div
        role="dialog"
        aria-label="Pontuação do grupo"
        className="mx-auto flex max-h-[92dvh] w-full max-w-md flex-col gap-4 overflow-y-auto rounded-t-3xl bg-cream px-5 pt-3 pb-[max(1.5rem,env(safe-area-inset-bottom))]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto h-1.5 w-10 shrink-0 rounded-full bg-line-strong" />
        <div className="flex flex-col gap-1">
          <h2 className="font-display text-2xl font-extrabold">Pontuação do grupo</h2>
          <p className="text-sm text-muted">Vale para todos os eventos do grupo, inclusive os que já aconteceram.</p>
        </div>
        <div className="flex gap-2">
          {option("pecas", "Contar peças", "1 peça = 1 ponto")}
          {option("pontos", "Pontos por peça", "Cada tipo vale de 1 a 5")}
        </div>

        {modo === "pontos" && (
          <div className="rounded-2xl border border-line bg-white px-3">
            {QUICK_PIECES.map((p, i) => {
              const n = pesos[p.id] ?? 1;
              return (
                <div key={p.id} className={`flex h-13 items-center gap-3 ${i < QUICK_PIECES.length - 1 ? "border-b border-[#f0ece6]" : ""}`}>
                  <PieceArt id={p.id} size={28} />
                  <span className="flex-1 text-[15px] font-semibold">{p.label}</span>
                  <button onClick={() => bump(p.id, -1)} disabled={n <= MIN_WEIGHT} aria-label={`Menos um ponto para ${p.label}`} className="flex h-9 w-9 items-center justify-center rounded-full border border-line text-lg disabled:opacity-30">
                    −
                  </button>
                  <span className="w-14 text-center text-[15px] font-bold">
                    {n} {n === 1 ? "pt" : "pts"}
                  </span>
                  <button onClick={() => bump(p.id, 1)} disabled={n >= MAX_WEIGHT} aria-label={`Mais um ponto para ${p.label}`} className="flex h-9 w-9 items-center justify-center rounded-full border border-line text-lg disabled:opacity-30">
                    +
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {error && <p className="text-center text-sm text-tomato-dark">{error}</p>}
        <button onClick={save} disabled={busy} className={primaryButton}>
          {busy ? "Salvando…" : "Salvar pontuação"}
        </button>
        <button onClick={onClose} className="h-10 text-sm font-semibold text-muted">
          Cancelar
        </button>
      </div>
    </div>
  );
}
