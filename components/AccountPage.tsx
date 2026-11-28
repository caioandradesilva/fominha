"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { CONTACT_EMAIL } from "@/components/LegalPage";
import { SaveAccountSheet } from "@/components/SaveAccount";
import { Avatar, BackLink, Screen, primaryButton, secondaryButton } from "@/components/ui";
import { useAuth, type Profile } from "@/lib/auth";
import { getSupabase } from "@/lib/supabase/client";

/** Perfil e configurações (backlog C6), com "Excluir minha conta" (B6). */
export function AccountPage({ profile }: { profile: Profile }) {
  const { user, isAnonymous, signOut, reloadProfile } = useAuth();
  const router = useRouter();
  const [nickname, setNickname] = useState(profile.nickname);
  const [savingName, setSavingName] = useState(false);
  const [nameMsg, setNameMsg] = useState<string | null>(null);
  const [saveAccount, setSaveAccount] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const providers = (user?.identities ?? []).map((i) => i.provider).filter((p) => p !== "anonymous");
  const via = providers.includes("google") ? "Google" : providers.includes("email") ? "e-mail" : null;

  async function saveName(e: FormEvent) {
    e.preventDefault();
    const clean = nickname.trim().slice(0, 24);
    if (!clean || clean === profile.nickname) return;
    setSavingName(true);
    setNameMsg(null);
    const { error } = await getSupabase().from("profiles").update({ nickname: clean }).eq("id", profile.id);
    setSavingName(false);
    if (error) return setNameMsg("Não salvou. Tente de novo.");
    await reloadProfile();
    setNameMsg("Apelido atualizado.");
  }

  async function leave() {
    if (
      isAnonymous &&
      !window.confirm(
        "Sua conta não tem login. Se sair, você perde o acesso aos seus grupos e registros neste celular. Salve com Google ou e-mail antes. Sair mesmo assim?",
      )
    )
      return;
    await signOut();
    router.push("/");
  }

  return (
    <Screen className="!gap-6">
      <BackLink href="/" label="Início" />

      <div className="flex items-center gap-4">
        <Avatar id={profile.id} name={profile.nickname} size={64} />
        <div className="flex min-w-0 flex-col">
          <h1 className="truncate font-display text-[28px] leading-tight font-extrabold">{profile.nickname}</h1>
          <span className="truncate text-sm text-muted">
            {isAnonymous ? "Conta só neste celular" : `Conectado com ${via ?? "conta"}${user?.email ? ` · ${user.email}` : ""}`}
          </span>
        </div>
      </div>

      <section className="flex flex-col gap-2">
        <h2 className="text-[15px] font-bold">Apelido</h2>
        <form onSubmit={saveName} className="flex gap-2">
          <input
            aria-label="Apelido"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            maxLength={24}
            className="h-12 min-w-0 flex-1 rounded-xl border border-line-strong bg-white px-3.5 text-base outline-none focus:border-ink"
          />
          <button
            type="submit"
            disabled={savingName || !nickname.trim() || nickname.trim() === profile.nickname}
            className="h-12 rounded-xl bg-ink px-4 text-sm font-semibold text-white disabled:opacity-40"
          >
            {savingName ? "Salvando…" : "Salvar"}
          </button>
        </form>
        {nameMsg && <p className="text-[13px] text-muted">{nameMsg}</p>}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-[15px] font-bold">Conta</h2>
        {isAnonymous ? (
          <div className="flex flex-col gap-2.5 rounded-2xl border border-gold bg-gold-soft px-4 py-3 text-[#5c3e00]">
            <span className="text-[13px] leading-snug">
              Você entrou só com apelido. Se trocar de celular ou o navegador limpar os dados, perde o acesso. Salve com Google ou e-mail.
            </span>
            <button onClick={() => setSaveAccount(true)} className="h-10 rounded-xl bg-ink text-sm font-semibold text-white">
              Salvar conta
            </button>
          </div>
        ) : (
          <p className="rounded-2xl border border-line bg-white px-4 py-3 text-sm">
            Entre com {via ?? "a mesma conta"} em qualquer celular para ver seus grupos e registros.
          </p>
        )}
      </section>

      <section className="flex flex-col rounded-2xl border border-line bg-white px-4">
        <Link href="/privacidade" className="flex h-12 items-center justify-between border-b border-[#f0ece6] text-sm font-semibold">
          Política de Privacidade <span aria-hidden>›</span>
        </Link>
        <Link href="/termos" className="flex h-12 items-center justify-between border-b border-[#f0ece6] text-sm font-semibold">
          Termos de Uso <span aria-hidden>›</span>
        </Link>
        <a href={`mailto:${CONTACT_EMAIL}`} className="flex h-12 items-center justify-between text-sm font-semibold">
          Fale com a gente <span className="text-muted">{CONTACT_EMAIL}</span>
        </a>
      </section>

      <div className="flex-1" />
      <button onClick={leave} className={secondaryButton}>
        Sair
      </button>
      <button onClick={() => setDeleting(true)} className="-mt-2 h-11 text-sm font-semibold text-[#b3261e]">
        Excluir minha conta
      </button>

      {saveAccount && <SaveAccountSheet onClose={() => setSaveAccount(false)} />}
      {deleting && <DeleteSheet nickname={profile.nickname} onClose={() => setDeleting(false)} onDeleted={() => router.push("/")} />}
    </Screen>
  );
}

function DeleteSheet({ nickname, onClose, onDeleted }: { nickname: string; onClose: () => void; onDeleted: () => void }) {
  const { signOut } = useAuth();
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ok = typed.trim().toLowerCase() === "excluir";

  async function remove() {
    setBusy(true);
    setError(null);
    const supabase = getSupabase();
    // 1) apaga os registros e recebe as fotos de prato; 2) apaga as fotos; 3) apaga a conta
    const { data: paths, error: e1 } = await supabase.rpc("forget_my_entries");
    if (e1) {
      setBusy(false);
      return setError("Não deu para excluir agora. Tente de novo.");
    }
    const list = (paths as string[] | null) ?? [];
    for (let i = 0; i < list.length; i += 100) await supabase.storage.from("plates").remove(list.slice(i, i + 100));
    const { error: e2 } = await supabase.rpc("delete_my_account");
    if (e2) {
      setBusy(false);
      return setError("Seus registros foram apagados, mas a conta não. Tente de novo.");
    }
    await signOut().catch(() => undefined);
    onDeleted();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-[rgba(26,23,20,0.55)]" onClick={onClose}>
      <div
        role="dialog"
        aria-label="Excluir conta"
        className="mx-auto flex w-full max-w-md flex-col gap-3 rounded-t-3xl bg-cream px-5 pt-3 pb-[max(1.5rem,env(safe-area-inset-bottom))]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto h-1.5 w-10 shrink-0 rounded-full bg-line-strong" />
        <h2 className="font-display text-2xl font-extrabold">Excluir a conta de {nickname}?</h2>
        <ul className="flex list-disc flex-col gap-1 pl-5 text-sm text-ink">
          <li>Seus registros e as fotos dos seus pratos são apagados e saem dos placares.</li>
          <li>Você sai de todos os grupos.</li>
          <li>Grupos, eventos e barcas que você criou continuam para os amigos, sem o seu nome.</li>
          <li>Não dá para desfazer.</li>
        </ul>
        <label htmlFor="confirm-delete" className="mt-1 text-sm font-semibold text-muted">
          Para confirmar, digite EXCLUIR
        </label>
        <input
          id="confirm-delete"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          autoComplete="off"
          className="h-12 rounded-xl border border-line-strong bg-white px-3.5 text-base outline-none focus:border-ink"
        />
        {error && <p className="text-center text-sm text-tomato-dark">{error}</p>}
        <button onClick={remove} disabled={!ok || busy} className={primaryButton + " !bg-[#b3261e] disabled:opacity-40"}>
          {busy ? "Excluindo…" : "Excluir para sempre"}
        </button>
        <button onClick={onClose} className="h-10 text-sm font-semibold text-muted">
          Cancelar
        </button>
      </div>
    </div>
  );
}
