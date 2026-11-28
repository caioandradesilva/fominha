"use client";

import type { User } from "@supabase/supabase-js";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { getSupabase } from "@/lib/supabase/client";
import { installTelemetry, track } from "@/lib/telemetry";
import { getCaptchaToken } from "@/lib/captcha";
import { hasSupabaseEnv } from "@/lib/supabase/env";

export type Profile = {
  id: string;
  nickname: string;
  avatar_url: string | null;
  public_ranking: boolean;
};

/** Resultado de pedir o código por e-mail. */
export type EmailCodeResult =
  | { ok: true; mode: "link" | "signin" }
  | { ok: false; error: string; exists?: boolean };

type AuthValue = {
  loading: boolean;
  user: User | null;
  profile: Profile | null;
  /** Conta só deste aparelho (entrou só com apelido). */
  isAnonymous: boolean;
  /** Erro que voltou do Google na URL (ex.: essa conta Google já pertence a outro perfil). */
  authError: string | null;
  clearAuthError: () => void;
  /** Google: liga à conta atual se ela for anônima; senão, entra. `forceSignIn` troca para a conta do Google. */
  continueWithGoogle: (forceSignIn?: boolean) => Promise<string | null>;
  /** Botão do Google no próprio app (A1): liga à conta só-apelido ou entra, com o id token do Google.
   * Devolve null (deu certo), "exists" (essa conta Google é de outro perfil) ou a mensagem de erro. */
  googleIdToken: (idToken: string, rawNonce: string, forceSignIn?: boolean) => Promise<string | null>;
  /** Manda um código por e-mail: liga o e-mail à conta anônima, ou entra (cria a conta se não existir). */
  sendEmailCode: (email: string, forceSignIn?: boolean) => Promise<EmailCodeResult>;
  verifyEmailCode: (email: string, code: string, mode: "link" | "signin") => Promise<string | null>;
  /** Relê o perfil (depois de trocar o apelido, por exemplo). */
  reloadProfile: () => Promise<void>;
  /** Entra com apelido: cria a sessão anônima (se preciso) e salva o perfil. */
  signInWithNickname: (nickname: string) => Promise<{ ok: true; profile: Profile } | { ok: false; error: string }>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [authError, setAuthError] = useState<string | null>(null);
  const [state, setState] = useState<{ loading: boolean; user: User | null; profile: Profile | null }>({
    loading: hasSupabaseEnv,
    user: null,
    profile: null,
  });
  // Só a carga mais recente pode atualizar a tela.
  const seq = useRef(0);

  const load = useCallback(async (user: User | null) => {
    const mine = ++seq.current;
    if (!user) {
      setState({ loading: false, user: null, profile: null });
      return;
    }
    const { data } = await getSupabase()
      .from("profiles")
      .select("id, nickname, avatar_url, public_ranking")
      .eq("id", user.id)
      .maybeSingle();
    if (mine === seq.current) setState({ loading: false, user, profile: data ?? null });
    // Volta do Google: registra se ligou à conta só-apelido ou entrou (flag gravada antes de sair para o Google)
    try {
      const flag = window.sessionStorage.getItem("rodizium:google");
      if (flag && !user.is_anonymous) {
        window.sessionStorage.removeItem("rodizium:google");
        track(flag === "link" ? "account_saved" : "signed_in", { method: "google", new_profile: !data });
      }
    } catch {
      /* ignora */
    }
  }, []);

  useEffect(() => (hasSupabaseEnv ? installTelemetry() : undefined), []);

  useEffect(() => {
    if (!hasSupabaseEnv) return;
    const supabase = getSupabase();
    // Volta do Google: lê um eventual erro e limpa os parâmetros da URL.
    const url = new URL(window.location.href);
    const code = url.searchParams.get("error_code") ?? new URLSearchParams(url.hash.slice(1)).get("error_code");
    if (code) {
      const t = setTimeout(() => setAuthError(code), 0);
      url.searchParams.delete("error");
      url.searchParams.delete("error_code");
      url.searchParams.delete("error_description");
      window.history.replaceState(null, "", url.pathname + (url.search === "?" ? "" : url.search));
      void t;
    }
    // getSession lê do armazenamento local: abre o app sem esperar a rede.
    supabase.auth.getSession().then(({ data }) => {
      load(data.session?.user ?? null);
      const clean = new URL(window.location.href);
      if (clean.searchParams.has("code")) {
        clean.searchParams.delete("code");
        window.history.replaceState(null, "", clean.pathname + (clean.search === "?" ? "" : clean.search));
      }
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") load(null);
      else if ((event === "SIGNED_IN" || event === "USER_UPDATED") && session?.user) load(session.user);
    });
    return () => sub.subscription.unsubscribe();
  }, [load]);

  const signInWithNickname = useCallback<AuthValue["signInWithNickname"]>(async (nickname) => {
    const supabase = getSupabase();
    const current = (await supabase.auth.getSession()).data.session?.user ?? null;
    let user = current;
    if (!user) {
      const captchaToken = await getCaptchaToken();
      const { data, error } = await supabase.auth.signInAnonymously(captchaToken ? { options: { captchaToken } } : undefined);
      if (error || !data.user) return { ok: false, error: "Não deu para entrar agora. Tente de novo em instantes." };
      user = data.user;
    }
    const { data: profile, error } = await supabase
      .from("profiles")
      .upsert({ id: user.id, nickname })
      .select("id, nickname, avatar_url, public_ranking")
      .single();
    if (error || !profile) return { ok: false, error: "Entrou, mas não salvou o apelido. Tente de novo." };
    seq.current++; // descarta qualquer leitura antiga em andamento
    setState({ loading: false, user, profile });
    if (!current) track("signed_in", { method: "apelido" });
    return { ok: true, profile };
  }, []);

  const signOut = useCallback(async () => {
    await getSupabase().auth.signOut();
  }, []);

  const continueWithGoogle = useCallback<AuthValue["continueWithGoogle"]>(async (forceSignIn = false) => {
    const supabase = getSupabase();
    const current = (await supabase.auth.getSession()).data.session?.user ?? null;
    const redirectTo = window.location.origin + window.location.pathname;
    try {
      window.sessionStorage.setItem("rodizium:google", current?.is_anonymous && !forceSignIn ? "link" : "signin");
    } catch {
      /* ignora */
    }
    const { error } =
      current?.is_anonymous && !forceSignIn
        ? await supabase.auth.linkIdentity({ provider: "google", options: { redirectTo } })
        : await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo } });
    if (!error) return null;
    if (error.code === "manual_linking_disabled") return "O login com Google ainda não foi ativado. Tente mais tarde.";
    if (error.code === "provider_disabled" || error.code === "oauth_provider_not_supported") return "O login com Google ainda não foi ativado.";
    return "Não deu para abrir o Google agora. Tente de novo.";
  }, []);

  const googleIdToken = useCallback<AuthValue["googleIdToken"]>(async (token, nonce, forceSignIn = false) => {
    const supabase = getSupabase();
    const current = (await supabase.auth.getSession()).data.session?.user ?? null;
    const link = Boolean(current?.is_anonymous) && !forceSignIn;
    const { data, error } = link
      ? await supabase.auth.linkIdentity({ provider: "google", token, nonce })
      : await supabase.auth.signInWithIdToken({ provider: "google", token, nonce });
    if (error) {
      if (error.code === "identity_already_exists") {
        setAuthError("identity_already_exists");
        return "exists";
      }
      if (error.code === "provider_disabled") return "O login com Google ainda não foi ativado.";
      return "O Google não confirmou o login. Tente de novo.";
    }
    setAuthError(null);
    if (data.user) await load(data.user);
    track(link ? "account_saved" : "signed_in", { method: "google", via: "botao" });
    return null;
  }, [load]);

  const sendEmailCode = useCallback<AuthValue["sendEmailCode"]>(async (raw, forceSignIn = false) => {
    const email = raw.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { ok: false, error: "Confira o e-mail." };
    const supabase = getSupabase();
    const current = (await supabase.auth.getSession()).data.session?.user ?? null;
    if (current?.is_anonymous && !forceSignIn) {
      const { error } = await supabase.auth.updateUser({ email });
      if (!error) return { ok: true, mode: "link" };
      if (error.code === "email_exists" || error.code === "user_already_exists" || /already/i.test(error.message))
        return { ok: false, exists: true, error: "Esse e-mail já tem uma conta no Rodizium." };
      return { ok: false, error: emailError(error.code) };
    }
    const captchaToken = await getCaptchaToken();
    const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true, ...(captchaToken ? { captchaToken } : {}) } });
    if (error) return { ok: false, error: emailError(error.code) };
    return { ok: true, mode: "signin" };
  }, []);

  const verifyEmailCode = useCallback<AuthValue["verifyEmailCode"]>(async (raw, code, mode) => {
    const email = raw.trim().toLowerCase();
    const token = code.replace(/\D/g, "");
    const { data, error } = await getSupabase().auth.verifyOtp({ email, token, type: mode === "link" ? "email_change" : "email" });
    if (error) return error.code === "otp_expired" ? "Código errado ou vencido. Confira ou peça outro." : "Não deu certo. Confira o código.";
    if (data.user) await load(data.user);
    track(mode === "link" ? "account_saved" : "signed_in", { method: "email" });
    return null;
  }, [load]);

  const value = useMemo(
    () => ({
      ...state,
      isAnonymous: Boolean(state.user?.is_anonymous),
      authError,
      clearAuthError: () => setAuthError(null),
      signInWithNickname,
      signOut,
      continueWithGoogle,
      googleIdToken,
      sendEmailCode,
      verifyEmailCode,
      reloadProfile: () => load(state.user),
    }),
    [state, authError, signInWithNickname, signOut, continueWithGoogle, googleIdToken, sendEmailCode, verifyEmailCode, load],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth precisa estar dentro de <AuthProvider>");
  return ctx;
}

function emailError(code: string | undefined) {
  if (code === "over_email_send_rate_limit" || code === "over_request_rate_limit") return "Muitos pedidos seguidos. Espere um minuto e tente de novo.";
  if (code === "email_address_invalid") return "Esse e-mail não parece válido.";
  if (code === "email_provider_disabled" || code === "signup_disabled") return "O login por e-mail ainda não foi ativado.";
  if (code === "captcha_failed") return "Não conseguimos confirmar que você é humano. Tente de novo.";
  return "Não deu para mandar o código agora. Tente de novo.";
}
