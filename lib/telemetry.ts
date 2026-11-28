"use client";

import { getSupabase } from "@/lib/supabase/client";
import { hasSupabaseEnv } from "@/lib/supabase/env";

/**
 * Telemetria mínima, no nosso próprio banco (backlog B7 e B8).
 * - track(): eventos de produto que não dá para tirar das tabelas (ex.: abriu o Stories, pulou o tutorial).
 * - reportError(): erros do app, com onde aconteceu. Nunca derruba nada: falhas aqui são ignoradas.
 * Não manda conteúdo de fotos, e-mails nem textos digitados.
 */

const VERSION = (process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ?? "local").slice(0, 7);
const sentErrors = new Map<string, number>();

async function currentUserId(): Promise<string | null> {
  try {
    const { data } = await getSupabase().auth.getSession();
    return data.session?.user.id ?? null;
  } catch {
    return null;
  }
}

export type TrackIds = { groupId?: string | null; eventId?: string | null };

export function track(name: string, props: Record<string, unknown> = {}, ids: TrackIds = {}) {
  if (!hasSupabaseEnv || typeof window === "undefined") return;
  void (async () => {
    try {
      const user_id = await currentUserId();
      await getSupabase()
        .from("product_events")
        .insert({ name, props, user_id, group_id: ids.groupId ?? null, event_id: ids.eventId ?? null });
    } catch {
      /* telemetria nunca atrapalha */
    }
  })();
}

export function reportError(source: string, error: unknown, detail?: Record<string, unknown>) {
  if (!hasSupabaseEnv || typeof window === "undefined") return;
  const err = error instanceof Error ? error : new Error(typeof error === "string" ? error : JSON.stringify(error));
  const key = `${source}:${err.message}`;
  const n = sentErrors.get(key) ?? 0;
  if (n >= 3) return; // o mesmo erro no máximo 3 vezes por sessão
  sentErrors.set(key, n + 1);
  void (async () => {
    try {
      const user_id = await currentUserId();
      await getSupabase()
        .from("client_errors")
        .insert({
          user_id,
          source: source.slice(0, 60),
          message: err.message.slice(0, 500) || "erro",
          detail: JSON.stringify({ ...(detail ?? {}), stack: err.stack?.split("\n").slice(0, 8).join("\n") }).slice(0, 4000),
          url: (window.location.pathname + window.location.search).slice(0, 300),
          user_agent: navigator.userAgent.slice(0, 300),
          app_version: VERSION,
        });
    } catch {
      /* ignora */
    }
  })();
}

/** Liga a captura de erros não tratados e conta a abertura do app (uma vez por aba). */
export function installTelemetry() {
  if (typeof window === "undefined") return () => {};
  const onError = (e: ErrorEvent) => reportError("window", e.error ?? e.message, { file: e.filename, line: e.lineno });
  const onRejection = (e: PromiseRejectionEvent) => reportError("promise", e.reason);
  window.addEventListener("error", onError);
  window.addEventListener("unhandledrejection", onRejection);
  try {
    if (!window.sessionStorage.getItem("rodizium:aberto")) {
      window.sessionStorage.setItem("rodizium:aberto", "1");
      const standalone = window.matchMedia("(display-mode: standalone)").matches;
      track("app_open", { standalone, path: window.location.pathname.split("/")[1] || "inicio" });
    }
  } catch {
    /* ignora */
  }
  return () => {
    window.removeEventListener("error", onError);
    window.removeEventListener("unhandledrejection", onRejection);
  };
}
