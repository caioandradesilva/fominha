import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseKey, supabaseUrl } from "./env";

let client: SupabaseClient | undefined;

/** Cliente do Supabase para componentes que rodam no navegador. */
export function getSupabase(): SupabaseClient {
  if (!client) client = createBrowserClient(supabaseUrl, supabaseKey);
  return client;
}
