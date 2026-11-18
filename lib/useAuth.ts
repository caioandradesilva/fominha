"use client";

import type { User } from "@supabase/supabase-js";
import { useCallback, useEffect, useRef, useState } from "react";
import { getSupabase } from "@/lib/supabase/client";

export type Profile = {
  id: string;
  nickname: string;
  avatar_url: string | null;
  public_ranking: boolean;
};

type AuthState = {
  loading: boolean;
  user: User | null;
  profile: Profile | null;
};

/** Sessão atual + perfil do usuário. Atualiza sozinho quando a pessoa entra ou sai. */
export function useAuth() {
  const [state, setState] = useState<AuthState>({ loading: true, user: null, profile: null });
  // Só a carga mais recente pode atualizar a tela (evita uma resposta antiga sobrescrever a nova).
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

  /** Recarrega sessão e perfil (ex.: logo depois de salvar o apelido). */
  const reload = useCallback(async () => {
    const { data } = await getSupabase().auth.getUser();
    await load(data.user);
  }, [load]);

  useEffect(() => {
    const supabase = getSupabase();
    supabase.auth.getUser().then(({ data }) => load(data.user));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      load(session?.user ?? null);
    });
    return () => {
      seq.current++;
      sub.subscription.unsubscribe();
    };
  }, [load]);

  return { ...state, reload };
}
