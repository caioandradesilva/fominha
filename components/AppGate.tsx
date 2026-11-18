"use client";

import { Home } from "@/components/Home";
import { PlateMark } from "@/components/Logo";
import { Welcome } from "@/components/Welcome";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { useAuth } from "@/lib/useAuth";

/** Decide o que mostrar: tela de entrada, carregando ou o Início. */
export function AppGate() {
  if (!hasSupabaseEnv) return <MissingEnv />;
  return <Gate />;
}

function Gate() {
  const { loading, user, profile, reload } = useAuth();

  if (loading) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-tomato">
        <PlateMark size={88} plate="#ffffff" rim="#d33d15" title="Carregando" />
      </main>
    );
  }

  if (!user || !profile) return <Welcome onSignedIn={reload} />;
  return <Home profile={profile} />;
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
