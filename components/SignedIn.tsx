"use client";

import type { ReactNode } from "react";
import { PlateMark } from "@/components/Logo";
import { Welcome } from "@/components/Welcome";
import { useAuth, type Profile } from "@/lib/auth";
import { hasSupabaseEnv } from "@/lib/supabase/env";

/** Mostra o conteúdo só para quem já entrou; senão, a tela de entrada. */
export function SignedIn({ children }: { children: (profile: Profile) => ReactNode }) {
  const { loading, user, profile } = useAuth();
  if (!hasSupabaseEnv) return <MissingEnv />;
  if (loading) return <Splash />;
  if (!user || !profile) return <Welcome />;
  return <>{children(profile)}</>;
}

export function Splash() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-tomato">
      <PlateMark size={88} plate="#ffffff" rim="#d33d15" title="Carregando" />
    </main>
  );
}

function MissingEnv() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-3 px-6">
      <h1 className="font-display text-2xl font-extrabold">Falta configurar o Supabase</h1>
      <p className="text-muted">
        Defina <code>NEXT_PUBLIC_SUPABASE_URL</code> e{" "}
        <code>NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</code> nas variáveis de ambiente.
      </p>
    </main>
  );
}
