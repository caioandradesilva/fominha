"use client";

import { useEffect, useState } from "react";
import { track } from "@/lib/telemetry";

const KEY = "rodizium:dica-instalar";

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

function initial(): "ios" | "none" {
  if (typeof window === "undefined") return "none";
  try {
    if (window.localStorage.getItem(KEY)) return "none";
  } catch {
    /* ignora */
  }
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
  if (standalone) return "none";
  const ua = navigator.userAgent;
  const iOS = /iPhone|iPad|iPod/.test(ua) || (ua.includes("Macintosh") && navigator.maxTouchPoints > 1);
  // No iPhone só o Safari instala; Chrome e outros no iOS também mostram "Compartilhar → Tela de Início" a partir do iOS 16.4
  return iOS ? "ios" : "none";
}

/**
 * Dica para instalar o app na tela de início (backlog A4).
 * iPhone: passo a passo do botão Compartilhar. Android/Chrome: botão "Instalar" do próprio navegador.
 * Some para sempre depois de "Agora não" ou de instalar.
 */
export function InstallHint() {
  const [mode, setMode] = useState<"ios" | "android" | "none">(initial);
  const [prompt, setPrompt] = useState<InstallEvent | null>(null);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      try {
        if (window.localStorage.getItem(KEY)) return;
      } catch {
        /* ignora */
      }
      setPrompt(e as InstallEvent);
      setMode("android");
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  useEffect(() => {
    if (mode !== "none") track("install_shown", { mode });
  }, [mode]);

  function dismiss() {
    try {
      window.localStorage.setItem(KEY, String(Date.now()));
    } catch {
      /* ignora */
    }
    setMode("none");
  }

  async function install() {
    if (!prompt) return;
    await prompt.prompt();
    const choice = await prompt.userChoice.catch(() => undefined);
    track("install_answer", { outcome: choice?.outcome ?? "?" });
    dismiss();
  }

  if (mode === "none") return null;

  return (
    <div className="flex flex-col gap-2.5 rounded-2xl border border-line bg-white px-4 py-3">
      <div className="flex items-start gap-3">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="mt-0.5 shrink-0 text-tomato">
          <rect x="6" y="2" width="12" height="20" rx="3" />
          <path d="M11 18h2" />
        </svg>
        <span className="flex flex-col gap-0.5">
          <span className="text-[15px] font-bold">Instale o Rodizium no celular</span>
          {mode === "ios" ? (
            <span className="text-[13px] leading-snug text-muted">
              Toque em <strong className="text-ink">Compartilhar</strong>{" "}
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-label="ícone de compartilhar" className="inline -translate-y-px">
                <path d="M12 3v12M8 7l4-4 4 4" />
                <path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" />
              </svg>{" "}
              na barra do navegador e depois em <strong className="text-ink">Adicionar à Tela de Início</strong>. O app abre em tela cheia, como um app normal.
            </span>
          ) : (
            <span className="text-[13px] leading-snug text-muted">Abre em tela cheia, direto da tela de início, sem baixar nada da loja.</span>
          )}
        </span>
      </div>
      <div className="flex gap-2 pl-[34px]">
        {mode === "android" && (
          <button onClick={install} className="h-10 flex-1 rounded-xl bg-ink text-sm font-semibold text-white">
            Instalar
          </button>
        )}
        <button onClick={() => { track("install_dismiss", { mode }); dismiss(); }} className={`h-10 rounded-xl text-sm font-semibold ${mode === "ios" ? "bg-chip px-4 text-ink" : "px-4 text-muted"}`}>
          {mode === "ios" ? "Entendi" : "Agora não"}
        </button>
      </div>
    </div>
  );
}
