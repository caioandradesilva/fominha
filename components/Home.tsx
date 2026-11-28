"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { InstallHint } from "@/components/InstallHint";
import { SaveAccountSheet } from "@/components/SaveAccount";
import { PlateMark, Wordmark } from "@/components/Logo";
import { Avatar, Screen, primaryButton } from "@/components/ui";
import { useAuth, type Profile } from "@/lib/auth";
import { getSupabase } from "@/lib/supabase/client";

type GroupRow = {
  role: "admin" | "member";
  groups: { id: string; name: string } | null;
};

/** Início: saudação e lista de grupos (ou o estado vazio do primeiro acesso). */
export function Home({ profile }: { profile: Profile }) {
  const { isAnonymous, user, authError, clearAuthError } = useAuth();
  const closeAccount = () => {
    setSaving(false);
    clearAuthError();
  };
  const [groups, setGroups] = useState<GroupRow[] | null>(null);
  const [saving, setSaving] = useState(false);
  const accountOpen = saving || (isAnonymous && authError !== null);


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
        <div className="flex items-center gap-2">
        <Link href="/ranking" aria-label="Ranking" className="flex h-11 w-11 items-center justify-center rounded-full border border-line bg-white text-ink">
          <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z" />
            <path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3" />
          </svg>
        </Link>
        <Link href="/conta" aria-label="Perfil e configurações" className="flex h-11 items-center gap-2 rounded-full border border-line bg-white pr-4 pl-1 text-sm font-semibold">
          <Avatar id={profile.id} name={profile.nickname} size={34} />
          Perfil
        </Link>
        </div>
      </header>

      <div className="flex flex-col gap-0.5">
        <p className="font-display text-2xl font-extrabold">Oi, {profile.nickname}!</p>
        {!isAnonymous && user?.email && <span className="text-[13px] text-muted">Conectado como {user.email}</span>}
      </div>

      {isAnonymous && (
        <button
          onClick={() => setSaving(true)}
          className="flex items-center gap-3 rounded-2xl border border-gold bg-gold-soft px-4 py-3 text-left text-[#5c3e00]"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="shrink-0">
            <path d="M12 3 4 6v6c0 4.4 3.4 8.4 8 9 4.6-.6 8-4.6 8-9V6z" />
            <path d="m9 12 2 2 4-4" />
          </svg>
          <span className="flex flex-1 flex-col">
            <span className="text-[15px] font-bold text-ink">Salve sua conta</span>
            <span className="text-[13px]">Entre com Google ou e-mail para usar em outro celular sem perder seus registros.</span>
          </span>
        </button>
      )}

      {accountOpen && <SaveAccountSheet onClose={closeAccount} />}

      <InstallHint />

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
