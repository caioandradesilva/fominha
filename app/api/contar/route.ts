import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { countPieces } from "@/lib/counting";
import { supabaseKey, supabaseUrl } from "@/lib/supabase/env";
import { createServerSupabase } from "@/lib/supabase/server";

export const maxDuration = 30;

/** Recebe o caminho da foto já enviada ao Storage e devolve a contagem da IA. */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { eventId?: string; path?: string } | null;
  if (!body?.eventId || !body.path) {
    return NextResponse.json({ error: "Pedido inválido" }, { status: 400 });
  }

  // Sessão pelos cookies (app) ou pelo cabeçalho Authorization (testes e futuros apps nativos)
  const bearer = request.headers.get("authorization");
  const supabase = bearer?.startsWith("Bearer ")
    ? createClient(supabaseUrl, supabaseKey, {
        global: { headers: { Authorization: bearer } },
        auth: { persistSession: false, autoRefreshToken: false },
      })
    : await createServerSupabase();
  const { data: auth } = bearer?.startsWith("Bearer ")
    ? await supabase.auth.getUser(bearer.slice(7))
    : await supabase.auth.getUser();
  const user = auth.user;
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  // Só fotos do próprio usuário, dentro da pasta do evento
  if (!body.path.startsWith(`${body.eventId}/${user.id}/`)) {
    return NextResponse.json({ error: "Foto inválida" }, { status: 403 });
  }

  // As regras do banco garantem que o usuário é do grupo e o evento está ao vivo
  const { data: event } = await supabase.from("events").select("status").eq("id", body.eventId).maybeSingle();
  if (!event) return NextResponse.json({ error: "Evento não encontrado" }, { status: 404 });
  if (event.status !== "live") return NextResponse.json({ error: "O evento não está ao vivo" }, { status: 409 });

  const { data: file, error: downloadError } = await supabase.storage.from("plates").download(body.path);
  if (downloadError || !file) return NextResponse.json({ error: "Foto não encontrada" }, { status: 404 });

  const type = file.type === "image/png" || file.type === "image/webp" ? file.type : "image/jpeg";
  try {
    const result = await countPieces(Buffer.from(await file.arrayBuffer()), type);
    return NextResponse.json(result);
  } catch (e) {
    console.error("contar: falha na IA", e);
    return NextResponse.json({ error: "Não consegui contar agora" }, { status: 502 });
  }
}
