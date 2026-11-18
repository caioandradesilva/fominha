"use client";

import type { User } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
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

  useEffect(() => {
    const supabase = getSupabase();
    let active = true;

    async function load(user: User | null) {
      if (!user) {
        if (active) setState({ loading: false, user: null, profile: null });
        return;
      }
      const { data } = await supabase
        .from("profiles")
        .select("id, nickname, avatar_url, public_ranking")
        .eq("id", user.id)
        .maybeSingle();
      if (active) setState({ loading: false, user, profile: data ?? null });
    }

    supabase.auth.getUser().then(({ data }) => load(data.user));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      load(session?.user ?? null);
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return state;
}
