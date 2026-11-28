import { getSupabase } from "@/lib/supabase/client";

export type RestaurantKind = "sushi" | "pizza" | "churrasco" | "hamburguer" | "outro";
export type Restaurant = {
  id: string;
  name: string;
  city: string | null;
  kind: RestaurantKind;
  status: "nao_verificado" | "verificado";
};

export const KINDS: { id: RestaurantKind; label: string }[] = [
  { id: "sushi", label: "Sushi" },
  { id: "pizza", label: "Pizza" },
  { id: "churrasco", label: "Churrasco" },
  { id: "hamburguer", label: "Hambúrguer" },
  { id: "outro", label: "Outro" },
];

/** Mesmo critério do banco (private.norm): minúsculas, sem acento, espaços simples. */
export function norm(t: string) {
  return t.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim().toLowerCase();
}

const COLS = "id, name, city, kind, status";

/** Busca por pedaço do nome ou da cidade ("sushi art", "floripa" não; "florianopolis" sim). */
export async function searchRestaurants(q: string): Promise<Restaurant[]> {
  const words = norm(q).split(" ").filter((w) => w.length > 0).slice(0, 4);
  let query = getSupabase().from("restaurants").select(COLS).order("name").limit(8);
  for (const w of words) query = query.ilike("search", `%${w.replace(/[%_\\]/g, "")}%`);
  const { data } = await query;
  return (data as Restaurant[] | null) ?? [];
}

/** Cadastra como "não verificado". Se já existe (mesmo nome e cidade), devolve o existente. */
export async function addRestaurant(
  userId: string,
  r: { name: string; city: string; kind: RestaurantKind },
): Promise<Restaurant | null> {
  const supabase = getSupabase();
  const name = r.name.trim().replace(/\s+/g, " ").slice(0, 80);
  const city = r.city.trim().replace(/\s+/g, " ").slice(0, 60) || null;
  const { data, error } = await supabase
    .from("restaurants")
    .insert({ name, city, kind: r.kind, created_by: userId })
    .select(COLS)
    .single();
  if (data) return data as Restaurant;
  if (error?.code === "23505") {
    const found = await searchRestaurants(`${name} ${city ?? ""}`);
    return found.find((f) => norm(f.name) === norm(name) && norm(f.city ?? "") === norm(city ?? "")) ?? null;
  }
  return null;
}

export type HouseRanking = {
  restaurant: { id: string; name: string; city: string | null; status: Restaurant["status"] } | null;
  record: { nickname: string; pieces: number; at: string } | null;
  month: { nickname: string; pieces: number; at: string }[];
  events: number;
  groups: number;
};

export async function fetchHouseRanking(id: string): Promise<HouseRanking | null> {
  const { data, error } = await getSupabase().rpc("restaurant_rankings", { p_restaurant: id });
  if (error || !data) return null;
  return data as HouseRanking;
}
