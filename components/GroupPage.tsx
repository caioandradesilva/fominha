"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { SignedIn, Splash } from "@/components/SignedIn";
import { Avatar, BackLink, Screen, StatusPill, primaryButton, secondaryButton, shareLink } from "@/components/ui";
import type { Profile } from "@/lib/auth";
import { formatWhen } from "@/lib/format";
import { getSupabase } from "@/lib/supabase/client";

type Group = { id: string; name: string; invite_code: string; created_at: string };
type Member = { user_id: string; role: "admin" | "member"; profiles: { nickname: string } | null };
type EventRow = { id: string; name: string; status: "scheduled" | "live" | "closed"; starts_at: string | null; restaurant_name: string | null };

async function fetchGroup(id: string) {
  const supabase = getSupabase();
  const [g, m, e] = await Promise.all([
    supabase.from("groups").select("id, name, invite_code, created_at").eq("id", id).maybeSingle(),
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

  async function leave() {
    const msg = isAdmin
      ? "Você é o admin. Se sair, o grupo fica sem ninguém para começar os eventos. Sair mesmo assim?"
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
        <h2 className="text-[15px] font-bold">Membros</h2>
        <div className="grid grid-cols-4 gap-3">
          {members.map((m) => {
            const name = m.profiles?.nickname ?? "?";
            return (
              <div key={m.user_id} className="flex flex-col items-center gap-1 text-center">
                <Avatar id={m.user_id} name={name} size={48} />
                <span className="w-full truncate text-xs font-semibold">
                  {m.user_id === profile.id ? "Você" : name}
                </span>
                <span className="h-3 text-[10px] text-muted">{m.role === "admin" ? "admin" : ""}</span>
              </div>
            );
          })}
        </div>
      </section>

      <div className="flex-1" />
      <button onClick={leave} className="h-11 text-sm font-semibold text-[#b3261e]">
        Sair do grupo
      </button>
    </Screen>
  );
}
