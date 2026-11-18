"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { PlateMark } from "@/components/Logo";
import { Splash } from "@/components/SignedIn";
import { inputClass, primaryButton } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { getSupabase } from "@/lib/supabase/client";

type Preview = { group_id: string; group_name: string; member_count: number; invited_by: string | null };

/** Tela que abre pelo link do WhatsApp: mostra o grupo e põe a pessoa dentro. */
export function InviteScreen() {
  const { code } = useParams<{ code: string }>();
  const router = useRouter();
  const { loading, profile, signInWithNickname } = useAuth();
  const [preview, setPreview] = useState<Preview | null | undefined>(undefined);
  const [alreadyMember, setAlreadyMember] = useState(false);
  const [nickname, setNickname] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getSupabase()
      .rpc("invite_preview", { code })
      .then(({ data }) => setPreview(((data as Preview[] | null) ?? [])[0] ?? null));
  }, [code]);

  useEffect(() => {
    if (!profile || !preview) return;
    getSupabase()
      .from("group_members")
      .select("user_id")
      .eq("group_id", preview.group_id)
      .eq("user_id", profile.id)
      .maybeSingle()
      .then(({ data }) => setAlreadyMember(Boolean(data)));
  }, [profile, preview]);

  async function join(e?: FormEvent) {
    e?.preventDefault();
    if (!preview) return;
    setBusy(true);
    setError(null);
    if (!profile) {
      const name = nickname.trim();
      if (!name) {
        setBusy(false);
        return;
      }
      const result = await signInWithNickname(name);
      if (!result.ok) {
        setError(result.error);
        setBusy(false);
        return;
      }
    }
    const { data, error } = await getSupabase().rpc("join_group", { code });
    if (error || !data) {
      setError("Não deu para entrar no grupo. Tente de novo.");
      setBusy(false);
      return;
    }
    router.replace(`/g/${data}`);
  }

  if (loading || preview === undefined) return <Splash />;

  if (preview === null) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-7 text-center">
        <PlateMark size={96} plate="#efeae3" rim="#d8d1c8" />
        <h1 className="font-display text-2xl font-extrabold">Convite inválido</h1>
        <p className="text-muted">Esse link não existe mais. Peça um novo para quem te convidou.</p>
        <Link href="/" className="font-semibold text-tomato">
          Ir para o Fominha
        </Link>
      </main>
    );
  }

  const count = Number(preview.member_count);

  return (
    <main className="flex min-h-dvh flex-col bg-tomato text-white">
      <section className="flex flex-1 flex-col items-center justify-center gap-4 px-7 pt-10 pb-8 text-center">
        <PlateMark size={88} plate="#ffffff" rim="#d33d15" />
        <span className="text-base text-tomato-soft">
          {preview.invited_by ? `${preview.invited_by} te chamou para o grupo` : "Você foi chamado para o grupo"}
        </span>
        <h1 className="font-display text-[40px] leading-[1.05] font-extrabold">{preview.group_name}</h1>
        <span className="text-sm font-semibold">
          {count} {count === 1 ? "membro" : "membros"}
        </span>
      </section>

      <form
        onSubmit={join}
        className="flex flex-col gap-3 rounded-t-[28px] bg-cream px-6 pt-7 pb-[max(2rem,env(safe-area-inset-bottom))] text-ink"
      >
        {alreadyMember ? (
          <>
            <p className="text-center text-[15px] text-muted">Você já está neste grupo, {profile?.nickname}.</p>
            <Link href={`/g/${preview.group_id}`} className={primaryButton}>
              Abrir o grupo
            </Link>
          </>
        ) : (
          <>
            {profile ? (
              <p className="text-center text-[15px] text-muted">
                Entrando como <strong className="text-ink">{profile.nickname}</strong>
              </p>
            ) : (
              <>
                <label htmlFor="invite-nickname" className="text-sm font-semibold text-muted">
                  Como a galera vai te chamar?
                </label>
                <input
                  id="invite-nickname"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  maxLength={24}
                  autoComplete="nickname"
                  placeholder="Seu apelido"
                  className={inputClass}
                />
              </>
            )}
            <button type="submit" disabled={busy || (!profile && !nickname.trim())} className={primaryButton}>
              {busy ? "Entrando…" : "Entrar no grupo"}
            </button>
          </>
        )}
        {error && (
          <p role="alert" className="text-center text-sm text-tomato-dark">
            {error}
          </p>
        )}
        {!profile && (
          <p className="text-center text-[13px] text-muted">Seu acesso fica salvo neste celular. Entre sempre por ele.</p>
        )}
      </form>
    </main>
  );
}
