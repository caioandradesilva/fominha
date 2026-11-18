"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PlateMark, Wordmark } from "@/components/Logo";
import { Screen, primaryButton } from "@/components/ui";
import { useAuth, type Profile } from "@/lib/auth";
import { getSupabase } from "@/lib/supabase/client";

type GroupRow = {
  role: "admin" | "member";
  groups: { id: string; name: string } | null;
};

/** Início: saudação e lista de grupos (ou o estado vazio do primeiro acesso). */
export function Home({ profile }: { profile: Profile }) {
  const { signOut } = useAuth();
  const [groups, setGroups] = useState<GroupRow[] | null>(null);

  useEffect(() => {
    getSupabase()
      .from("group_members")
      .select("role, groups(id, name)")
      .eq("user_id", profile.id)
      .order("joined_at", { ascending: false })
      .then(({ data }) => setGroups((data as GroupRow[] | null) ?? []));
  }, [profile.id]);

  return (
    <Screen className="!gap-6 !pt-7">
      <header className="flex items-center justify-between">
        <Wordmark className="text-[32px]" />
        <button
          onClick={signOut}
          className="h-11 rounded-full border border-line bg-white px-4 text-sm font-semibold"
        >
          Sair
        </button>
      </header>

      <p className="font-display text-2xl font-extrabold">Oi, {profile.nickname}!</p>

      {groups === null && <p className="text-muted">Carregando…</p>}

      {groups && groups.length === 0 && (
        <section className="flex flex-1 flex-col items-center justify-center gap-4 px-3 text-center">
          <PlateMark size={120} plate="#efeae3" rim="#d8d1c8" />
          <h1 className="font-display text-[28px] leading-tight font-extrabold">Bora pro primeiro rodízio?</h1>
          <p className="text-[15px] leading-relaxed text-muted">
            Crie um grupo com a galera, ou abra o link de convite que mandaram no WhatsApp.
          </p>
          <Link href="/grupos/novo" className={primaryButton + " mt-2"}>
            Criar meu grupo
          </Link>
        </section>
      )}

      {groups && groups.length > 0 && (
        <section className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between">
            <h2 className="text-[17px] font-bold">Seus grupos</h2>
            <Link href="/grupos/novo" className="text-sm font-semibold text-tomato">
              + Novo grupo
            </Link>
          </div>
          {groups.map(
            (g) =>
              g.groups && (
                <Link
                  key={g.groups.id}
                  href={`/g/${g.groups.id}`}
                  className="flex items-center gap-3.5 rounded-2xl border border-line bg-white px-4 py-3.5"
                >
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-tomato-soft font-display text-lg font-extrabold text-tomato-dark">
                    {g.groups.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-[15px] font-semibold">{g.groups.name}</span>
                    <span className="text-[13px] text-muted">{g.role === "admin" ? "Você é admin" : "Membro"}</span>
                  </div>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6B645C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="m9 18 6-6-6-6" />
                  </svg>
                </Link>
              ),
          )}
        </section>
      )}
    </Screen>
  );
}
