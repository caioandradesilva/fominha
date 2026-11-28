"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { medal } from "@/components/RankingPage";
import { VerifiedBadge } from "@/components/RestaurantPicker";
import { SignedIn, Splash } from "@/components/SignedIn";
import { BackLink, Screen } from "@/components/ui";
import { useAuth, type Profile } from "@/lib/auth";
import { fetchHouseRanking, type HouseRanking } from "@/lib/restaurants";
import { monthShort } from "@/lib/season";
import { getSupabase } from "@/lib/supabase/client";
import { track } from "@/lib/telemetry";

const MONTHS_LONG = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

export function RestaurantScreen() {
  return <SignedIn>{(profile) => <RestaurantView profile={profile} />}</SignedIn>;
}

/**
 * Página da casa (backlog C3 + C5; aba "Restaurante" da tela Ranking do MVP):
 * recorde da casa e ranking do mês, só com quem ativou o ranking público (opt-in).
 */
function RestaurantView({ profile }: { profile: Profile }) {
  const { id } = useParams<{ id: string }>();
  const { reloadProfile } = useAuth();
  const [data, setData] = useState<HouseRanking | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => fetchHouseRanking(id).then(setData), [id]);
  useEffect(() => {
    load();
  }, [load]);

  async function togglePublic(on: boolean) {
    setBusy(true);
    await getSupabase().from("profiles").update({ public_ranking: on }).eq("id", profile.id);
    track("public_ranking", { on, origem: "restaurante" });
    await reloadProfile();
    await load();
    setBusy(false);
  }

  if (data === undefined) return <Splash />;
  if (!data?.restaurant)
    return (
      <Screen>
        <BackLink href="/ranking?aba=restaurante" />
        <h1 className="font-display text-2xl font-extrabold">Restaurante não encontrado</h1>
      </Screen>
    );

  const r = data.restaurant;
  const month = MONTHS_LONG[new Date().getMonth()];

  return (
    <Screen className="!gap-4">
      <BackLink href="/ranking?aba=restaurante" />

      <div className="flex items-center gap-3 rounded-2xl border border-line bg-white px-4 py-3.5">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-tomato-soft font-display text-xl font-extrabold text-tomato-dark">
          {r.name.charAt(0).toUpperCase()}
        </div>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="flex items-center gap-1.5">
            <h1 className="truncate text-lg font-bold">{r.name}</h1>
            <VerifiedBadge status={r.status} size={18} />
          </span>
          <span className="text-[13px] text-muted">
            {[r.city, `${data.events} ${data.events === 1 ? "rodízio" : "rodízios"} · ${data.groups} ${data.groups === 1 ? "grupo" : "grupos"}`]
              .filter(Boolean)
              .join(" · ")}
          </span>
        </div>
      </div>

      <div className="flex items-center justify-between rounded-[14px] border border-line bg-white px-4 py-3">
        <span className="text-sm text-muted">Recorde da casa</span>
        <span className="text-sm font-bold">
          {data.record ? `${data.record.pieces} peças · ${data.record.nickname} · ${monthShort(data.record.at)}` : "ainda sem dono"}
        </span>
      </div>

      <section className="flex flex-col gap-2">
        <h2 className="text-[15px] font-bold">Ranking de {month}</h2>
        {data.month.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line-strong px-4 py-5 text-center text-sm text-muted">
            Ninguém no ranking público da casa este mês.
          </p>
        ) : (
          <div className="rounded-2xl border border-line bg-white px-4 py-1">
            {data.month.map((m, i) => (
              <div key={`${m.nickname}-${i}`} className="flex h-[52px] items-center gap-2.5 border-b border-[#f0ece6] last:border-0">
                <div className="flex h-7 w-7 items-center justify-center rounded-full text-[13px] font-bold" style={{ background: medal(i) }}>
                  {i + 1}
                </div>
                <span className="min-w-0 flex-1 truncate text-[15px] font-semibold">{m.nickname}</span>
                <span className="text-[15px] font-bold">{m.pieces}</span>
              </div>
            ))}
          </div>
        )}
        <p className="text-[12px] text-muted">Melhor noite de cada pessoa na casa, em peças (cada grupo tem a sua pontuação).</p>
      </section>

      <div className="flex items-center gap-3 rounded-2xl bg-chip px-4 py-3.5">
        <div className="flex flex-1 flex-col">
          <span className="text-[15px] font-semibold">Aparecer nos rankings das casas</span>
          <span className="text-[13px] text-muted">Só o seu apelido e suas peças. Vale para todos os restaurantes.</span>
        </div>
        <Switch on={profile.public_ranking} disabled={busy} onChange={togglePublic} label="Aparecer nos rankings das casas" />
      </div>
    </Screen>
  );
}

export function Switch({ on, onChange, disabled, label }: { on: boolean; onChange: (v: boolean) => void; disabled?: boolean; label: string }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className={`relative h-8 w-[52px] shrink-0 rounded-full transition-colors disabled:opacity-50 ${on ? "bg-tomato" : "bg-line-strong"}`}
    >
      <span className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-all ${on ? "left-[24px]" : "left-1"}`} />
    </button>
  );
}
