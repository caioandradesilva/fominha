"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { VerifiedBadge } from "@/components/RestaurantPicker";
import { SignedIn, Splash } from "@/components/SignedIn";
import { BackLink, Screen } from "@/components/ui";
import type { Profile } from "@/lib/auth";
import type { Restaurant } from "@/lib/restaurants";
import { entryPoints, normalizeScoring, unitLabel } from "@/lib/scoring";
import { currentSeason, seasonLabel, type SeasonConfig } from "@/lib/season";
import { getSupabase } from "@/lib/supabase/client";

const MEDALS = ["#F5B529", "#C9CED6", "#E0A77C"];
export const medal = (i: number) => (i < 3 ? MEDALS[i] : "#F0ECE6");

type GroupRow = { id: string; name: string; scoring: unknown } & SeasonConfig;
type SeasonRow = { user_id: string; nickname: string; total: number; events: number; best: number };

export function RankingScreen() {
  return <SignedIn>{(profile) => <Ranking profile={profile} />}</SignedIn>;
}

/** Ranking (tela 5 do MVP): temporada do grupo e as casas onde o grupo já comeu. */
function Ranking({ profile }: { profile: Profile }) {
  const params = useSearchParams();
  const [tab, setTab] = useState<"grupo" | "restaurante">(params.get("aba") === "restaurante" ? "restaurante" : "grupo");
  const [groups, setGroups] = useState<GroupRow[] | null>(null);
  const [groupId, setGroupId] = useState<string | null>(params.get("g"));
  const [restaurants, setRestaurants] = useState<(Restaurant & { n: number })[] | null>(null);

  useEffect(() => {
    const supabase = getSupabase();
    supabase
      .from("group_members")
      .select("groups(id, name, scoring, season_start, season_months)")
      .eq("user_id", profile.id)
      .order("joined_at", { ascending: false })
      .then(({ data }) => {
        const gs = ((data ?? []) as unknown as { groups: GroupRow | null }[]).map((r) => r.groups).filter((g): g is GroupRow => !!g);
        setGroups(gs);
        setGroupId((cur) => (cur && gs.some((g) => g.id === cur) ? cur : gs[0]?.id ?? null));
      });
    // Casas onde os meus grupos já fizeram rodízio (RLS: só eventos dos meus grupos)
    supabase
      .from("events")
      .select("restaurant_id, restaurants(id, name, city, kind, status)")
      .not("restaurant_id", "is", null)
      .then(({ data }) => {
        const map = new Map<string, Restaurant & { n: number }>();
        for (const row of (data ?? []) as unknown as { restaurants: Restaurant | null }[]) {
          if (!row.restaurants) continue;
          const cur = map.get(row.restaurants.id);
          map.set(row.restaurants.id, { ...row.restaurants, n: (cur?.n ?? 0) + 1 });
        }
        setRestaurants([...map.values()].sort((a, b) => b.n - a.n));
      });
  }, [profile.id]);

  if (groups === null) return <Splash />;
  const group = groups.find((g) => g.id === groupId) ?? null;

  return (
    <Screen className="!gap-4">
      <div className="flex items-center gap-2">
        <BackLink href="/" label="Início" />
        <h1 className="font-display text-[28px] font-extrabold">Ranking</h1>
      </div>

      <div role="tablist" className="grid grid-cols-2 gap-1 rounded-[14px] bg-chip p-1">
        {(["grupo", "restaurante"] as const).map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={`h-10 rounded-[10px] text-sm font-semibold ${tab === t ? "bg-white shadow-sm" : ""}`}
          >
            {t === "grupo" ? "Meu grupo" : "Restaurante"}
          </button>
        ))}
      </div>

      {tab === "grupo" && (
        <>
          {groups.length > 1 && (
            <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1">
              {groups.map((g) => (
                <button
                  key={g.id}
                  onClick={() => setGroupId(g.id)}
                  aria-pressed={g.id === groupId}
                  className={`h-9 shrink-0 rounded-full border px-3.5 text-sm font-semibold ${g.id === groupId ? "border-ink bg-ink text-white" : "border-line-strong bg-white"}`}
                >
                  {g.name}
                </button>
              ))}
            </div>
          )}
          {group ? <SeasonTable key={group.id} group={group} me={profile.id} /> : <Empty text="Entre num grupo para ver o ranking da temporada." />}
        </>
      )}

      {tab === "restaurante" &&
        (restaurants === null ? (
          <p className="text-muted">Carregando…</p>
        ) : restaurants.length === 0 ? (
          <Empty text="Quando um evento tiver restaurante escolhido da lista, a casa aparece aqui com o recorde e o ranking do mês." />
        ) : (
          <div className="flex flex-col gap-2.5">
            {restaurants.map((r) => (
              <Link key={r.id} href={`/r/${r.id}`} className="flex items-center gap-3 rounded-2xl border border-line bg-white px-4 py-3.5">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-tomato-soft font-display text-lg font-extrabold text-tomato-dark">
                  {r.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="flex items-center gap-1.5">
                    <span className="truncate text-[15px] font-semibold">{r.name}</span>
                    <VerifiedBadge status={r.status} />
                  </span>
                  <span className="text-[13px] text-muted">
                    {[r.city, `${r.n} ${r.n === 1 ? "rodízio" : "rodízios"} dos seus grupos`].filter(Boolean).join(" · ")}
                  </span>
                </div>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6B645C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="m9 18 6-6-6-6" />
                </svg>
              </Link>
            ))}
          </div>
        ))}
    </Screen>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="rounded-2xl border border-dashed border-line-strong px-4 py-6 text-center text-[15px] text-muted">{text}</p>;
}

/** Soma da temporada: total, média por evento em que a pessoa registrou, e a melhor noite. */
function SeasonTable({ group, me }: { group: GroupRow; me: string }) {
  const scoring = useMemo(() => normalizeScoring(group.scoring), [group.scoring]);
  const season = useMemo(() => currentSeason(group), [group]);
  const [rows, setRows] = useState<SeasonRow[] | null>(null);
  const [eventCount, setEventCount] = useState(0);

  useEffect(() => {
    let active = true;
    (async () => {
      const supabase = getSupabase();
      const { data: evs } = await supabase
        .from("events")
        .select("id, starts_at, started_at, created_at, status")
        .eq("group_id", group.id)
        .neq("status", "scheduled");
      const inSeason = (evs ?? []).filter((e) => {
        const at = new Date(e.started_at ?? e.starts_at ?? e.created_at);
        return at >= season.start && at < season.end;
      });
      const ids = inSeason.map((e) => e.id);
      const [{ data: entries }, { data: members }] = await Promise.all([
        ids.length
          ? supabase.from("entries").select("user_id, event_id, count_final, ai_result").in("event_id", ids)
          : Promise.resolve({ data: [] as never[] }),
        supabase.from("group_members").select("user_id, profiles(nickname)").eq("group_id", group.id),
      ]);
      const names = new Map(((members ?? []) as unknown as { user_id: string; profiles: { nickname: string } | null }[]).map((m) => [m.user_id, m.profiles?.nickname ?? "?"]));
      const perEvent = new Map<string, Map<string, number>>();
      for (const e of (entries ?? []) as { user_id: string; event_id: string; count_final: number; ai_result: never }[]) {
        const m = perEvent.get(e.user_id) ?? new Map<string, number>();
        m.set(e.event_id, (m.get(e.event_id) ?? 0) + entryPoints(e, scoring));
        perEvent.set(e.user_id, m);
      }
      const out: SeasonRow[] = [...perEvent.entries()].map(([user_id, m]) => {
        const vals = [...m.values()];
        return { user_id, nickname: names.get(user_id) ?? "Ex-membro", total: vals.reduce((a, b) => a + b, 0), events: vals.length, best: Math.max(...vals) };
      });
      out.sort((a, b) => b.total - a.total || b.best - a.best);
      if (!active) return;
      setEventCount(ids.length);
      setRows(out);
    })();
    return () => {
      active = false;
    };
  }, [group.id, season, scoring]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-2">
        <span className="truncate text-base font-bold">{group.name}</span>
        <span className="shrink-0 text-[13px] text-muted">
          {seasonLabel(season.start, season.end)} · {eventCount} {eventCount === 1 ? "evento" : "eventos"}
        </span>
      </div>
      {rows === null ? (
        <p className="text-muted">Carregando…</p>
      ) : rows.length === 0 ? (
        <Empty text="Nenhum rodízio nesta temporada ainda. O primeiro evento já conta!" />
      ) : (
        <div className="rounded-2xl border border-line bg-white px-4 py-1">
          <div className="flex h-[34px] items-center gap-2.5 border-b border-[#f0ece6] text-xs font-semibold text-muted">
            <span className="w-7">#</span>
            <span className="flex-1">Nome</span>
            <span className="w-14 text-right">Média</span>
            <span className="w-14 text-right">Total</span>
          </div>
          {rows.map((r, i) => (
            <div key={r.user_id} className="flex h-12 items-center gap-2.5 border-b border-[#f0ece6] last:border-0">
              <div className="flex h-7 w-7 items-center justify-center rounded-full text-[13px] font-bold" style={{ background: medal(i) }}>
                {i + 1}
              </div>
              <span className={`min-w-0 flex-1 truncate text-[15px] font-semibold ${r.user_id === me ? "text-tomato-dark" : ""}`}>
                {r.nickname}
                {r.user_id === me ? " (você)" : ""}
              </span>
              <span className="w-14 text-right text-sm text-muted">{(r.total / r.events).toFixed(1).replace(".", ",")}</span>
              <span className="w-14 text-right text-[15px] font-bold">{r.total}</span>
            </div>
          ))}
        </div>
      )}
      <p className="text-[12px] text-muted">
        Total em {unitLabel(scoring, 2)} · média por rodízio em que a pessoa registrou. A temporada vira sozinha a cada{" "}
        {group.season_months} {group.season_months === 1 ? "mês" : "meses"}; o admin muda isso na página do grupo.
      </p>
    </div>
  );
}
