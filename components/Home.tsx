"use client";

import { useEffect, useState } from "react";
import { PlateMark, Wordmark } from "@/components/Logo";
import { getSupabase } from "@/lib/supabase/client";
import type { Profile } from "@/lib/useAuth";

type GroupRow = {
  role: "admin" | "member";
  groups: { id: string; name: string } | null;
};

/** Início: saudação e lista de grupos (ou o estado vazio do primeiro acesso). */
export function Home({ profile }: { profile: Profile }) {
  const [groups, setGroups] = useState<GroupRow[] | null>(null);

  useEffect(() => {
    getSupabase()
      .from("group_members")
      .select("role, groups(id, name)")
      .eq("user_id", profile.id)
      .then(({ data }) => setGroups((data as GroupRow[] | null) ?? []));
  }, [profile.id]);

  async function signOut() {
    await getSupabase().auth.signOut();
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-6 px-5 pt-7 pb-10">
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
          <h1 className="font-display text-[28px] leading-tight font-extrabold">
            Bora pro primeiro rodízio?
          </h1>
          <p className="text-[15px] leading-relaxed text-muted">
            Crie um grupo com a galera ou entre num que já existe pelo link de convite.
          </p>
          <button
            disabled
            className="mt-2 h-13 w-full rounded-2xl bg-tomato text-base font-semibold text-white opacity-50"
          >
            Criar meu grupo
          </button>
          <p className="text-xs text-muted">Criar grupo chega na próxima sessão de desenvolvimento.</p>
        </section>
      )}

      {groups && groups.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-[17px] font-bold">Seus grupos</h2>
          {groups.map(
            (g) =>
              g.groups && (
                <div
                  key={g.groups.id}
                  className="flex items-center gap-3.5 rounded-2xl border border-line bg-white px-4 py-3.5"
                >
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-tomato-soft font-display text-lg font-extrabold text-tomato-dark">
                    {g.groups.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex flex-1 flex-col">
                    <span className="text-[15px] font-semibold">{g.groups.name}</span>
                    <span className="text-[13px] text-muted">
                      {g.role === "admin" ? "Você é admin" : "Membro"}
                    </span>
                  </div>
                </div>
              ),
          )}
        </section>
      )}
    </main>
  );
}
