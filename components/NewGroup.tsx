"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { BackLink, Screen, inputClass, primaryButton } from "@/components/ui";
import { getSupabase } from "@/lib/supabase/client";
import type { Profile } from "@/lib/auth";

export function NewGroup({ profile }: { profile: Profile }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create(e: FormEvent) {
    e.preventDefault();
    const clean = name.trim();
    if (!clean) return;
    setBusy(true);
    setError(null);
    const { data, error } = await getSupabase()
      .from("groups")
      .insert({ name: clean, created_by: profile.id })
      .select("id")
      .single();
    if (error || !data) {
      setError("Não deu para criar o grupo. Tente de novo.");
      setBusy(false);
      return;
    }
    router.replace(`/g/${data.id}?novo=1`);
  }

  return (
    <Screen>
      <div className="flex items-center gap-2">
        <BackLink href="/" />
        <h1 className="font-display text-[26px] font-extrabold">Novo grupo</h1>
      </div>
      <form onSubmit={create} className="flex flex-1 flex-col gap-5">
        <div className="flex flex-col gap-2">
          <label htmlFor="group-name" className="text-sm font-semibold text-muted">
            Nome do grupo
          </label>
          <input
            id="group-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={40}
            placeholder="Ex.: Sushi dos Brothers"
            className={inputClass}
            autoFocus
          />
          <p className="text-[13px] text-muted">
            Você vira o admin: é quem começa e encerra os eventos. Depois é só mandar o link de convite.
          </p>
        </div>
        <div className="flex-1" />
        {error && (
          <p role="alert" className="text-center text-sm text-tomato-dark">
            {error}
          </p>
        )}
        <button type="submit" disabled={busy || !name.trim()} className={primaryButton}>
          {busy ? "Criando…" : "Criar grupo"}
        </button>
      </form>
    </Screen>
  );
}
