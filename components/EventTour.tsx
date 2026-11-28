"use client";

import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { track } from "@/lib/telemetry";

const KEY = "rodizium:tutorial:v1";

const STEPS = [
  {
    target: "pecas",
    title: "Comeu? Toque na peça",
    text: "Cada toque soma +1 para você, na hora. Tocou errado? Use o Desfazer que aparece logo em cima.",
  },
  {
    target: "foto",
    title: "Chegou barca ou prato? Fotografe",
    text: "A IA conta as peças por tipo. Depois é só escolher: \"Só meu\" ou \"Da mesa\".",
  },
  {
    target: "ranking",
    title: "O placar é ao vivo",
    text: "Atualiza para todo mundo enquanto a galera come. Toque num nome para ver os registros de cada um.",
  },
] as const;

type Rect = { top: number; left: number; width: number; height: number };

function seen() {
  try {
    return Boolean(window.localStorage.getItem(KEY));
  } catch {
    return true;
  }
}

/**
 * Tutorial do primeiro evento (backlog A2): 3 dicas sobre a própria tela, que dá para pular.
 * Aparece uma vez por aparelho, no primeiro evento ao vivo em que a pessoa ainda não registrou nada.
 * Os alvos são marcados com data-tour="pecas" | "foto" | "ranking".
 */
export function EventTour({ eventId, enabled }: { eventId: string; enabled: boolean }) {
  const [step, setStep] = useState<number | null>(null);
  const [rect, setRect] = useState<Rect | null>(null);

  useEffect(() => {
    if (!enabled || seen()) return;
    const t = setTimeout(() => {
      setStep(0);
      track("tutorial_start", {}, { eventId });
    }, 700);
    return () => clearTimeout(t);
  }, [enabled, eventId]);

  const measure = useCallback(() => {
    if (step === null) return;
    const el = document.querySelector<HTMLElement>(`[data-tour="${STEPS[step].target}"]`);
    if (!el) return setRect(null);
    const r = el.getBoundingClientRect();
    setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
  }, [step]);

  useLayoutEffect(() => {
    if (step === null) return;
    const el = document.querySelector<HTMLElement>(`[data-tour="${STEPS[step].target}"]`);
    el?.scrollIntoView({ block: "center", behavior: "smooth" });
    const t = setTimeout(measure, 380);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      clearTimeout(t);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [step, measure]);

  function finish(skipped: boolean) {
    try {
      window.localStorage.setItem(KEY, String(Date.now()));
    } catch {
      /* ignora */
    }
    track(skipped ? "tutorial_skip" : "tutorial_done", { step: (step ?? 0) + 1 }, { eventId });
    setStep(null);
  }

  if (step === null) return null;
  const s = STEPS[step];
  const last = step === STEPS.length - 1;
  const pad = 6;
  const vh = typeof window !== "undefined" ? window.innerHeight : 800;
  const below = rect ? rect.top + rect.height / 2 < vh / 2 : false;

  return (
    <div className="fixed inset-0 z-[60]" role="dialog" aria-label="Como funciona o evento">
      {rect ? (
        <div
          aria-hidden
          className="pointer-events-none absolute rounded-2xl transition-all duration-300"
          style={{
            top: rect.top - pad,
            left: rect.left - pad,
            width: rect.width + pad * 2,
            height: rect.height + pad * 2,
            boxShadow: "0 0 0 9999px rgba(26,23,20,0.62)",
            outline: "2px solid #f5b529",
          }}
        />
      ) : (
        <div aria-hidden className="absolute inset-0 bg-[rgba(26,23,20,0.62)]" />
      )}
      <div
        className="absolute inset-x-4 mx-auto flex max-w-sm flex-col gap-2 rounded-2xl bg-ink px-4 pt-3.5 pb-3 text-white shadow-xl"
        style={
          rect
            ? below
              ? { top: Math.min(rect.top + rect.height + pad + 12, vh - 200) }
              : { bottom: Math.max(vh - rect.top + pad + 12, 16) }
            : { top: "35%" }
        }
      >
        <span className="text-xs font-bold tracking-wider text-gold uppercase">
          {step + 1} de {STEPS.length}
        </span>
        <span className="font-display text-xl leading-tight font-extrabold">{s.title}</span>
        <span className="text-sm leading-snug text-[#d9d3cb]">{s.text}</span>
        <div className="mt-1 flex items-center justify-between">
          <button onClick={() => finish(true)} className="h-10 px-1 text-sm font-semibold text-[#d9d3cb]">
            Pular
          </button>
          <button
            onClick={() => (last ? finish(false) : setStep(step + 1))}
            className="h-10 rounded-xl bg-tomato px-5 text-sm font-semibold text-white"
          >
            {last ? "Bora!" : "Próximo"}
          </button>
        </div>
      </div>
    </div>
  );
}
