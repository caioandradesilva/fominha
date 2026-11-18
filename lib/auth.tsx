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
import { hasSupabaseEnv } from "@/lib/supabase/env";

export type Profile = {
  id: string;
  nickname: string;
  avatar_url: string | null;
  public_ranking: boolean;
};

type AuthValue = {
  loading: boolean;
  user: User | null;
  profile: Profile | null;
  /** Entra com apelido: cria a sessão anônima (se preciso) e salva o perfil. */
  signInWithNickname: (nickname: string) => Promise<{ ok: true; profile: Profile } | { ok: false; error: string }>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
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
  }, []);

  useEffect(() => {
    if (!hasSupabaseEnv) return;
    const supabase = getSupabase();
    // getSession lê do armazenamento local: abre o app sem esperar a rede.
    supabase.auth.getSession().then(({ data }) => load(data.session?.user ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") load(null);
      else if (event === "SIGNED_IN" && session?.user) load(session.user);
    });
    return () => sub.subscription.unsubscribe();
  }, [load]);

  const signInWithNickname = useCallback<AuthValue["signInWithNickname"]>(async (nickname) => {
    const supabase = getSupabase();
    const current = (await supabase.auth.getSession()).data.session?.user ?? null;
    let user = current;
    if (!user) {
      const { data, error } = await supabase.auth.signInAnonymously();
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
    return { ok: true, profile };
  }, []);

  const signOut = useCallback(async () => {
    await getSupabase().auth.signOut();
  }, []);

  const value = useMemo(
    () => ({ ...state, signInWithNickname, signOut }),
    [state, signInWithNickname, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth precisa estar dentro de <AuthProvider>");
  return ctx;
}
