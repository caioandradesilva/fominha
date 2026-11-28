import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { CountError, countPieces, type CountMode, type Usage } from "@/lib/counting";
import { quotaBlock, type QuotaCounts } from "@/lib/limits";
import { supabaseKey, supabaseUrl } from "@/lib/supabase/env";
import { createServerSupabase } from "@/lib/supabase/server";

export const maxDuration = 60;

const MAX_BYTES = 4 * 1024 * 1024;

/**
 * Conta as peças de uma foto.
 * Formato novo (multipart): campos `photo` (arquivo), `eventId` e `mode`. O app manda a foto direto para cá
 * enquanto ela sobe para o Storage em paralelo (backlog C1).
 * Formato antigo (JSON): `{ eventId, path, mode }`, com a foto já no Storage.
 */
export async function POST(request: Request) {
  const t0 = Date.now();
  let eventId: string | undefined;
  let mode: CountMode = "prato";
  let image: Buffer | null = null;
  let mediaType: "image/jpeg" | "image/png" | "image/webp" = "image/jpeg";
  let path: string | undefined;

  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData().catch(() => null);
    const photo = form?.get("photo");
    eventId = (form?.get("eventId") as string | null) ?? undefined;
    mode = parseMode(form?.get("mode"));
    if (!(photo instanceof Blob) || photo.size === 0) return NextResponse.json({ error: "Foto ausente", code: "photo" }, { status: 400 });
    if (photo.size > MAX_BYTES) return NextResponse.json({ error: "Foto grande demais", code: "photo_size" }, { status: 413 });
    image = Buffer.from(await photo.arrayBuffer());
    mediaType = toMediaType(photo.type);
  } else {
    const body = (await request.json().catch(() => null)) as { eventId?: string; path?: string; mode?: string } | null;
    eventId = body?.eventId;
    path = body?.path;
    mode = parseMode(body?.mode);
    if (!path) return NextResponse.json({ error: "Pedido inválido" }, { status: 400 });
  }
  if (!eventId) return NextResponse.json({ error: "Pedido inválido" }, { status: 400 });

  // Sessão pelos cookies (app) ou pelo cabeçalho Authorization (testes e futuros apps nativos)
  const bearer = request.headers.get("authorization");
  const supabase = bearer?.startsWith("Bearer ")
    ? createClient(supabaseUrl, supabaseKey, {
        global: { headers: { Authorization: bearer } },
        auth: { persistSession: false, autoRefreshToken: false },
      })
    : await createServerSupabase();
  const { data: auth } = bearer?.startsWith("Bearer ") ? await supabase.auth.getUser(bearer.slice(7)) : await supabase.auth.getUser();
  const user = auth.user;
  if (!user) return NextResponse.json({ error: "Não autenticado", code: "auth" }, { status: 401 });

  if (path && !path.startsWith(`${eventId}/${user.id}/`)) {
    return NextResponse.json({ error: "Foto inválida", code: "path" }, { status: 403 });
  }

  // Evento ao vivo (as regras do banco garantem que a pessoa é do grupo) + cotas, em paralelo
  const [{ data: event }, { data: quota }] = await Promise.all([
    supabase.from("events").select("status").eq("id", eventId).maybeSingle(),
    supabase.rpc("ai_quota", { p_event: eventId }),
  ]);
  if (!event) return NextResponse.json({ error: "Evento não encontrado", code: "event" }, { status: 404 });
  if (event.status !== "live") return NextResponse.json({ error: "O evento não está ao vivo", code: "not_live" }, { status: 409 });
  const blocked = quota ? quotaBlock(quota as QuotaCounts) : null;
  if (blocked) return NextResponse.json({ error: blocked.message, code: blocked.code }, { status: 429 });

  if (!image && path) {
    const { data: file, error: downloadError } = await supabase.storage.from("plates").download(path);
    if (downloadError || !file) {
      console.error("contar: foto não encontrada", path, downloadError);
      return NextResponse.json({ error: "Foto não encontrada", code: "download" }, { status: 404 });
    }
    image = Buffer.from(await file.arrayBuffer());
    mediaType = toMediaType(file.type);
  }

  const usage: Usage = { input: 0, output: 0, model: "" };
  const tAi = Date.now();
  const log = (ok: boolean, errorCode: string | null) =>
    supabase.from("ai_usage").insert({
      user_id: user.id,
      event_id: eventId,
      mode,
      model: usage.model || null,
      ok,
      error_code: errorCode,
      input_tokens: usage.input || null,
      output_tokens: usage.output || null,
      ms_ai: Date.now() - tAi,
      ms_total: Date.now() - t0,
    });

  try {
    const result = await countPieces(image!, mediaType, mode, usage);
    const msAi = Date.now() - tAi;
    await log(true, null);
    return NextResponse.json({ ...result, tempos: { ia_ms: msAi, servidor_ms: Date.now() - t0 } });
  } catch (e) {
    const code = e instanceof CountError ? e.code : "unknown";
    console.error("contar: falha na IA", code, e);
    await log(false, code);
    return NextResponse.json({ error: "Não consegui contar agora", code, detail: (e as Error).message.slice(0, 200) }, { status: 502 });
  }
}

function parseMode(v: unknown): CountMode {
  return v === "barca" || v === "auto" ? v : "prato";
}

function toMediaType(t: string): "image/jpeg" | "image/png" | "image/webp" {
  return t === "image/png" || t === "image/webp" ? t : "image/jpeg";
}
