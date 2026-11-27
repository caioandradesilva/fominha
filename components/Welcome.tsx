"use client";

import { useState, type FormEvent } from "react";
import { AccountPanel } from "@/components/AccountPanel";
import { PlateMark, Wordmark } from "@/components/Logo";
import { useAuth } from "@/lib/auth";

/**
 * Entrar: Google ou e-mail (conta que vale em qualquer aparelho) ou só apelido (fica neste celular).
 * Quem acabou de entrar com Google/e-mail e ainda não tem perfil escolhe o apelido aqui.
 */
export function Welcome() {
  const { signInWithNickname, user } = useAuth();
  const needsNickname = Boolean(user && !user.is_anonymous);
  const meta = (user?.user_metadata ?? {}) as { full_name?: string; name?: string };
  const [nickname, setNickname] = useState(() => (meta.full_name ?? meta.name ?? "").trim().split(/\s+/)[0]?.slice(0, 24) ?? "");
  const [quick, setQuick] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function enter(e: FormEvent) {
    e.preventDefault();
    const name = nickname.trim();
    if (!name) return;
    setBusy(true);
    setError(null);
    const result = await signInWithNickname(name);
    if (!result.ok) {
      setError(result.error);
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-full flex-col bg-tomato text-white">
      <section className="flex flex-1 flex-col justify-center gap-7 px-7 pt-10 pb-14">
        <div className="relative h-[140px] w-[140px]">
          <PlateMark size={140} plate="#ffffff" rim="#d33d15" />
          <span className="absolute -right-5 bottom-1 -rotate-6 rounded-full bg-gold px-3.5 py-2 font-display text-lg font-extrabold text-ink">
            +1 peça
          </span>
        </div>
        <div className="flex flex-col gap-2.5">
          <h1>
            <Wordmark className="text-[64px]" plate="#ffffff" rim="#d33d15" />
          </h1>
          <p className="text-xl leading-snug text-tomato-soft">
            Quem come mais no rodízio? Agora tem placar.
          </p>
        </div>
      </section>

      <div className="flex flex-col gap-3 rounded-t-[28px] bg-cream px-6 pt-7 pb-[max(2rem,env(safe-area-inset-bottom))] text-ink">
        {needsNickname || quick ? (
          <form onSubmit={enter} className="flex flex-col gap-3">
            <label htmlFor="nickname" className="text-sm font-semibold text-muted">
              Como a galera vai te chamar?
            </label>
            <input
              id="nickname"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              maxLength={24}
              autoComplete="nickname"
              autoFocus
              placeholder="Seu apelido"
              className="h-14 rounded-2xl border border-line-strong bg-white px-4 text-base outline-none focus:border-ink"
            />
            <button
              type="submit"
              disabled={busy || !nickname.trim()}
              className="h-14 rounded-2xl bg-tomato text-base font-semibold text-white disabled:opacity-50"
            >
              {busy ? "Entrando…" : needsNickname ? "Continuar" : "Entrar"}
            </button>
            {error && (
              <p role="alert" className="text-center text-sm text-tomato-dark">
                {error}
              </p>
            )}
            {quick && !needsNickname && (
              <>
                <p className="text-center text-[13px] leading-relaxed text-muted">
                  Sem conta, seu acesso fica só neste celular. Dá para salvar com Google ou e-mail depois.
                </p>
                <button type="button" onClick={() => setQuick(false)} className="h-9 text-sm font-semibold text-muted">
                  Voltar
                </button>
              </>
            )}
          </form>
        ) : (
          <>
            <AccountPanel />
            <div className="flex items-center gap-3 py-1 text-xs text-muted">
              <span className="h-px flex-1 bg-line" />
              ou
              <span className="h-px flex-1 bg-line" />
            </div>
            <button onClick={() => setQuick(true)} className="h-11 text-[15px] font-semibold text-ink underline decoration-line-strong underline-offset-4">
              Entrar só com apelido
            </button>
            <p className="text-center text-[12px] leading-relaxed text-muted">Com conta, seu placar te acompanha em qualquer celular.</p>
          </>
        )}
      </div>
    </main>
  );
}
