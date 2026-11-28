"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { SignedIn, Splash } from "@/components/SignedIn";
import { RestaurantPicker } from "@/components/RestaurantPicker";
import { BackLink, Screen, inputClass, primaryButton } from "@/components/ui";
import type { Profile } from "@/lib/auth";
import { defaultEventLocal, monthName } from "@/lib/format";
import type { Restaurant } from "@/lib/restaurants";
import { getSupabase } from "@/lib/supabase/client";

export function NewEventScreen() {
  return <SignedIn>{(profile) => <NewEvent profile={profile} />}</SignedIn>;
}

function NewEvent({ profile }: { profile: Profile }) {
  const { id: groupId } = useParams<{ id: string }>();
  const router = useRouter();
  const [groupName, setGroupName] = useState<string | null>(null);
  const [name, setName] = useState(`Rodízio de ${monthName()}`);
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [when, setWhen] = useState(defaultEventLocal);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getSupabase()
      .from("groups")
      .select("name")
      .eq("id", groupId)
      .maybeSingle()
      .then(({ data }) => setGroupName(data?.name ?? ""));
  }, [groupId]);

  async function create(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    setError(null);
    const { data, error } = await getSupabase()
      .from("events")
      .insert({
        group_id: groupId,
        name: name.trim(),
        restaurant_name: restaurant?.name ?? null,
        restaurant_id: restaurant?.id ?? null,
        starts_at: when ? new Date(when).toISOString() : null,
        created_by: profile.id,
      })
      .select("id")
      .single();
    if (error || !data) {
      setError("Não deu para criar o evento. Tente de novo.");
      setBusy(false);
      return;
    }
    router.replace(`/e/${data.id}`);
  }

  if (groupName === null) return <Splash />;

  return (
    <Screen>
      <div className="flex items-center gap-2">
        <BackLink href={`/g/${groupId}`} />
        <div className="flex flex-col">
          <h1 className="font-display text-[26px] leading-tight font-extrabold">Novo evento</h1>
          {groupName && <span className="text-[13px] text-muted">{groupName}</span>}
        </div>
      </div>

      <form onSubmit={create} className="flex flex-1 flex-col gap-5">
        <div className="flex flex-col gap-2">
          <label htmlFor="ev-name" className="text-sm font-semibold text-muted">
            Nome do evento
          </label>
          <input id="ev-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} className={inputClass} />
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor="ev-rest" className="text-sm font-semibold text-muted">
            Restaurante
          </label>
          <RestaurantPicker userId={profile.id} value={restaurant} onChange={setRestaurant} />
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor="ev-when" className="text-sm font-semibold text-muted">
            Data e hora
          </label>
          <input id="ev-when" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} className={inputClass} />
        </div>
        <div className="flex-1" />
        {error && (
          <p role="alert" className="text-center text-sm text-tomato-dark">
            {error}
          </p>
        )}
        <button type="submit" disabled={busy || !name.trim()} className={primaryButton}>
          {busy ? "Criando…" : "Criar evento"}
        </button>
      </form>
    </Screen>
  );
}
