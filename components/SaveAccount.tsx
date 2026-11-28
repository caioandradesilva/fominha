"use client";

import { useEffect, useState } from "react";
import { AccountPanel } from "@/components/AccountPanel";
import { useAuth } from "@/lib/auth";
import { track } from "@/lib/telemetry";

/** Janela "Salve sua conta" (Google ou e-mail), ligando à conta só-apelido. */
export function SaveAccountSheet({ onClose, title = "Salve sua conta", text }: { onClose: () => void; title?: string; text?: string }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end bg-[rgba(26,23,20,0.55)]" onClick={onClose}>
      <div
        role="dialog"
        aria-label={title}
        className="mx-auto flex w-full max-w-md flex-col gap-4 rounded-t-3xl bg-cream px-5 pt-3 pb-[max(1.5rem,env(safe-area-inset-bottom))]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto h-1.5 w-10 shrink-0 rounded-full bg-line-strong" />
        <div className="flex flex-col gap-1">
          <h2 className="font-display text-2xl font-extrabold">{title}</h2>
          <p className="text-sm text-muted">
            {text ?? "Seu apelido, grupos e registros continuam os mesmos. Depois é só entrar com a mesma conta em qualquer celular."}
          </p>
        </div>
        <AccountPanel onDone={onClose} />
      </div>
    </div>
  );
}

const SHIELD = (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="shrink-0">
    <path d="M12 3 4 6v6c0 4.4 3.4 8.4 8 9 4.6-.6 8-4.6 8-9V6z" />
    <path d="m9 12 2 2 4-4" />
  </svg>
);

/** Regras do convite durante o evento (só para quem entrou só com apelido). */
const FIRST_AT = 3; // aparece a partir do 3º registro da pessoa
const AGAIN_AFTER_REGS = 15; // depois de "Agora não", volta após mais 15 registros…
const AGAIN_AFTER_MS = 25 * 60 * 1000; // …ou 25 minutos
const MAX_SHOWS = 3; // no máximo 3 vezes por evento

type Snooze = { count: number; at: number; regs: number };

function readSnooze(key: string): Snooze {
  try {
    const raw = window.localStorage.getItem(key);
    if (raw) return JSON.parse(raw) as Snooze;
  } catch {
    /* armazenamento indisponível */
  }
  return { count: 0, at: 0, regs: 0 };
}

/**
 * Convite para salvar a conta ao longo do evento e no pódio.
 * - "live": aparece a partir do 3º registro; "Agora não" adia por 15 registros ou 25 min; até 3 vezes.
 * - "podium": sempre aparece para quem ainda não salvou (some só nesta visita).
 */
export function SaveAccountNudge({
  eventId,
  variant,
  myRegs,
  myScore,
  unit,
}: {
  eventId: string;
  variant: "live" | "podium";
  myRegs: number;
  myScore: number;
  unit: string;
}) {
  const { isAnonymous, authError, clearAuthError } = useAuth();
  const key = `rodizium:salvar-conta:${eventId}`;
  const [snooze, setSnooze] = useState<Snooze>(() => (typeof window === "undefined" ? { count: 0, at: 0, regs: 0 } : readSnooze(key)));
  const [now, setNow] = useState(0);
  const [hidden, setHidden] = useState(false);
  const [open, setOpen] = useState(false);

  // relógio para reabrir o convite depois de 25 min, sem depender de novos registros
  useEffect(() => {
    if (variant !== "live") return;
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    const id = setInterval(tick, 60_000);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [variant]);

  let show: boolean;
  if (!isAnonymous) show = false;
  else if (variant === "podium") show = !hidden;
  else if (snooze.count === 0) show = myRegs >= FIRST_AT;
  else show = snooze.count < MAX_SHOWS && (myRegs - snooze.regs >= AGAIN_AFTER_REGS || (now > 0 && now - snooze.at >= AGAIN_AFTER_MS));

  // conta cada vez que o convite aparece (uma vez por exibição)
  useEffect(() => {
    if (show) track("nudge_shown", { variant, vez: snooze.count + 1 }, { eventId });
  }, [show, variant, snooze.count, eventId]);

  if (!isAnonymous) return null;

  function later() {
    track("nudge_later", { variant, vez: snooze.count + 1 }, { eventId });
    if (variant === "podium") return setHidden(true);
    const next = { count: snooze.count + 1, at: Date.now(), regs: myRegs };
    setSnooze(next);
    try {
      window.localStorage.setItem(key, JSON.stringify(next));
    } catch {
      /* ignora */
    }
  }

  const title = variant === "podium" ? "Guarde esse resultado" : myScore > 0 ? `${unit === "peças" ? "Suas" : "Seus"} ${myScore} ${unit} estão só neste celular` : "Não perca seu placar";
  const text =
    variant === "podium"
      ? "Salve sua conta para rever este rodízio, seus recordes e os próximos em qualquer celular."
      : "Se o navegador limpar os dados ou você trocar de celular, perde tudo. Salve com Google ou e-mail: leva 1 toque e nada muda no evento.";

  return (
    <>
      {show && (
        <div className="flex flex-col gap-2.5 rounded-2xl border border-gold bg-gold-soft px-4 py-3 text-[#5c3e00]">
          <div className="flex items-start gap-3">
            {SHIELD}
            <span className="flex flex-1 flex-col gap-0.5">
              <span className="text-[15px] font-bold text-ink">{title}</span>
              <span className="text-[13px] leading-snug">{text}</span>
            </span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => {
                track("nudge_click", { variant, vez: snooze.count + 1 }, { eventId });
                setOpen(true);
              }}
              className="h-10 flex-1 rounded-xl bg-ink text-sm font-semibold text-white"
            >
              Salvar conta
            </button>
            <button onClick={later} className="h-10 rounded-xl px-4 text-sm font-semibold text-[#5c3e00]">
              Agora não
            </button>
          </div>
        </div>
      )}
      {(open || authError !== null) && (
        <SaveAccountSheet
          onClose={() => {
            setOpen(false);
            clearAuthError();
          }}
          title={variant === "podium" ? "Guarde esse resultado" : "Salve sua conta"}
        />
      )}
    </>
  );
}
