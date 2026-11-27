"use client";

import { useEffect, useState, type FormEvent } from "react";
import { primaryButton, secondaryButton } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { supabaseKey, supabaseUrl } from "@/lib/supabase/env";

/** Quais logins estão ligados no Supabase (o botão do Google só aparece quando o provedor está ativo). */
let providersCache: Promise<{ google: boolean; email: boolean }> | null = null;
function fetchProviders() {
  providersCache ??= fetch(`${supabaseUrl}/auth/v1/settings`, { headers: { apikey: supabaseKey } })
    .then((r) => r.json())
    .then((j: { external?: { google?: boolean; email?: boolean } }) => ({ google: Boolean(j.external?.google), email: j.external?.email !== false }))
    .catch(() => ({ google: false, email: true }));
  return providersCache;
}

function GoogleMark() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

const googleButton =
  "flex h-14 w-full items-center justify-center gap-2.5 rounded-2xl border border-line-strong bg-white text-base font-semibold text-ink disabled:opacity-50";

/**
 * Entrar ou salvar a conta com Google ou e-mail (código de 6 dígitos).
 * Se a pessoa entrou só com apelido, liga o Google/e-mail à mesma conta: nada se perde.
 */
export function AccountPanel({ onDone }: { onDone?: () => void }) {
  const { isAnonymous, authError, clearAuthError, continueWithGoogle, sendEmailCode, verifyEmailCode } = useAuth();
  const [step, setStep] = useState<"choose" | "email" | "code" | "exists">("choose");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [mode, setMode] = useState<"link" | "signin">("signin");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [providers, setProviders] = useState<{ google: boolean; email: boolean } | null>(null);

  useEffect(() => {
    let active = true;
    fetchProviders().then((p) => active && setProviders(p));
    return () => {
      active = false;
    };
  }, []);

  async function google(force = false) {
    setBusy(true);
    setError(null);
    clearAuthError();
    const err = await continueWithGoogle(force);
    if (err) {
      setError(err);
      setBusy(false);
    }
    // sem erro: o navegador vai para o Google
  }

  async function send(e?: FormEvent, force = false) {
    e?.preventDefault();
    setBusy(true);
    setError(null);
    const r = await sendEmailCode(email, force);
    setBusy(false);
    if (r.ok) {
      setMode(r.mode);
      setCode("");
      setStep("code");
    } else if (r.exists) setStep("exists");
    else setError(r.error);
  }

  async function verify(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const err = await verifyEmailCode(email, code, mode);
    setBusy(false);
    if (err) return setError(err);
    onDone?.();
  }

  const lostWarning = isAnonymous
    ? " O que você registrou neste celular com o apelido atual fica no perfil antigo."
    : "";

  return (
    <div className="flex flex-col gap-3">
      {authError === "identity_already_exists" && step === "choose" && (
        <div className="flex flex-col gap-2 rounded-2xl bg-gold-soft px-4 py-3 text-[#5c3e00]">
          <span className="text-sm font-semibold">Essa conta Google já está ligada a outro perfil do Rodizium.</span>
          <span className="text-[13px]">Quer entrar nela?{lostWarning}</span>
          <button onClick={() => google(true)} disabled={busy} className="h-11 rounded-xl bg-ink text-sm font-semibold text-white">
            Entrar com essa conta Google
          </button>
        </div>
      )}
      {authError && authError !== "identity_already_exists" && step === "choose" && (
        <p className="rounded-xl bg-gold-soft px-3 py-2 text-[13px] text-[#5c3e00]">O Google não confirmou o login. Tente de novo.</p>
      )}

      {step === "choose" && (
        <>
          {providers?.google && (
            <button onClick={() => google()} disabled={busy} className={googleButton}>
              <GoogleMark />
              Continuar com Google
            </button>
          )}
          {providers?.email !== false && (
            <button onClick={() => setStep("email")} disabled={busy || !providers} className={secondaryButton + " !h-14"}>
              Continuar com e-mail
            </button>
          )}
        </>
      )}

      {step === "email" && (
        <form onSubmit={send} className="flex flex-col gap-3">
          <label htmlFor="acc-email" className="text-sm font-semibold text-muted">
            Seu e-mail (mandamos um código para entrar, sem senha)
          </label>
          <input
            id="acc-email"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="voce@email.com"
            className="h-14 rounded-2xl border border-line-strong bg-white px-4 text-base outline-none focus:border-ink"
          />
          <button type="submit" disabled={busy || !email.trim()} className={primaryButton}>
            {busy ? "Mandando…" : "Mandar código"}
          </button>
          <button type="button" onClick={() => setStep("choose")} className="h-10 text-sm font-semibold text-muted">
            Voltar
          </button>
        </form>
      )}

      {step === "code" && (
        <form onSubmit={verify} className="flex flex-col gap-3">
          <label htmlFor="acc-code" className="text-sm font-semibold text-muted">
            Digite o código que chegou em <span className="text-ink">{email.trim().toLowerCase()}</span>
          </label>
          <input
            id="acc-code"
            inputMode="numeric"
            autoComplete="one-time-code"
            autoFocus
            maxLength={10}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            placeholder="000000"
            className="h-16 rounded-2xl border border-line-strong bg-white px-4 text-center font-display text-3xl font-extrabold tracking-[0.3em] outline-none focus:border-ink"
          />
          <button type="submit" disabled={busy || code.length < 6} className={primaryButton}>
            {busy ? "Conferindo…" : mode === "link" ? "Salvar minha conta" : "Entrar"}
          </button>
          <p className="text-center text-xs text-muted">Não chegou? Olhe o spam ou</p>
          <button type="button" onClick={() => send(undefined, mode === "signin")} disabled={busy} className="-mt-2 h-9 text-sm font-semibold text-tomato-dark">
            mande de novo
          </button>
        </form>
      )}

      {step === "exists" && (
        <div className="flex flex-col gap-3">
          <p className="rounded-2xl bg-gold-soft px-4 py-3 text-sm text-[#5c3e00]">
            <span className="font-semibold">{email.trim().toLowerCase()} já tem uma conta no Rodizium.</span>
            {" "}Quer entrar nela?{lostWarning}
          </p>
          <button onClick={() => send(undefined, true)} disabled={busy} className={primaryButton}>
            {busy ? "Mandando…" : "Entrar nessa conta"}
          </button>
          <button onClick={() => setStep("email")} className="h-10 text-sm font-semibold text-muted">
            Usar outro e-mail
          </button>
        </div>
      )}

      {error && (
        <p role="alert" className="text-center text-sm text-tomato-dark">
          {error}
        </p>
      )}
    </div>
  );
}
