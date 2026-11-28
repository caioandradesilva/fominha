"use client";

/**
 * CAPTCHA invisível (Cloudflare Turnstile) para criar conta e pedir código por e-mail (backlog B1).
 * Fica desligado enquanto TURNSTILE_SITE_KEY estiver vazio: getCaptchaToken() devolve undefined
 * e o login segue como hoje. Ordem para ligar:
 *   1) colocar a site key (pública) aqui e publicar;
 *   2) só depois ativar o CAPTCHA no Supabase (Authentication → Attack Protection) com a secret key.
 * Ao contrário, ninguém consegue entrar.
 */
// Chave pública do widget "Rodizium" (Cloudflare Turnstile). A secret fica só no Supabase.
import { track } from "@/lib/telemetry";

export const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "0x4AAAAAAGXPBh_b_2AKwqCe";

type Turnstile = {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string;
  execute: (id: string) => void;
  reset: (id: string) => void;
  remove: (id: string) => void;
};

declare global {
  interface Window {
    turnstile?: Turnstile;
  }
}

let loading: Promise<Turnstile> | null = null;

/** Se a Cloudflare não responder neste tempo, segue sem token (o Supabase decide se aceita). */
const TIMEOUT_MS = 15000;

function loadScript(): Promise<Turnstile> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  loading ??= new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    s.async = true;
    s.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error("turnstile")));
    s.onerror = () => reject(new Error("turnstile"));
    document.head.appendChild(s);
  });
  return loading;
}

/** Pede um token novo (uso único). Só mostra algo na tela se a Cloudflare desconfiar. */
export async function getCaptchaToken(): Promise<string | undefined> {
  if (!TURNSTILE_SITE_KEY || typeof window === "undefined") return undefined;
  const t0 = performance.now();
  let ts: Turnstile;
  try {
    ts = await loadScript();
  } catch {
    track("captcha", { ok: false, motivo: "script" });
    return undefined;
  }
  const host = document.createElement("div");
  host.style.cssText = "position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:80";
  document.body.appendChild(host);
  return new Promise<string | undefined>((resolve) => {
    let id = "";
    let finished = false;
    const timer = setTimeout(() => done(undefined, "sem resposta"), TIMEOUT_MS);
    const done = (token?: string, motivo?: string) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      track("captcha", { ok: Boolean(token), motivo: motivo ?? null, ms: Math.round(performance.now() - t0) });
      try {
        ts.remove(id);
      } catch {
        /* ignora */
      }
      host.remove();
      resolve(token);
    };
    id = ts.render(host, {
      sitekey: TURNSTILE_SITE_KEY,
      appearance: "interaction-only",
      execution: "execute",
      language: "pt-br",
      callback: (token: string) => done(token),
      "error-callback": (code: string) => done(undefined, `erro ${code}`),
      "timeout-callback": () => done(undefined, "expirou"),
    });
    ts.execute(id);
  });
}
