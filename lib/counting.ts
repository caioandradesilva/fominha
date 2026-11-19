import Anthropic from "@anthropic-ai/sdk";

export type CountResult = {
  total: number;
  por_tipo: Record<string, number>;
  confianca: "alta" | "media" | "baixa";
  observacao?: string;
};

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5";

const PROMPT = `Esta é a foto de um prato num rodízio (normalmente sushi; pode ser pizza, churrasco ou hambúrguer).
Conte cada peça individual de comida que a pessoa vai comer.
- Sushi: cada nigiri, uramaki, hossomaki, hot roll, gunkan, temaki e fatia de sashimi conta 1. Peças sobrepostas contam separadamente.
- Pizza: cada fatia conta 1. Churrasco: cada pedaço de carne conta 1. Hambúrguer: cada mini-hambúrguer conta 1.
- NÃO conte gengibre, wasabi, molho, folhas, decoração, hashi ou o próprio prato.
- Se parte do prato estiver fora da foto, borrada ou com peças empilhadas que não dá para separar, use confiança "baixa".
- Se a foto não mostrar comida, responda total 0, confiança "baixa" e explique em observacao.
Em por_tipo, use nomes simples em português (ex.: uramaki, nigiri, hot roll) e inclua só os tipos que aparecem.
Em observacao, escreva uma frase curta em português (pode ser vazia).`;

// Saída estruturada: a API garante que a resposta segue exatamente este esquema.
const SCHEMA = {
  type: "object",
  properties: {
    total: { type: "integer" },
    por_tipo: {
      type: "array",
      items: {
        type: "object",
        properties: { tipo: { type: "string" }, quantidade: { type: "integer" } },
        required: ["tipo", "quantidade"],
        additionalProperties: false,
      },
    },
    confianca: { type: "string", enum: ["alta", "media", "baixa"] },
    observacao: { type: "string" },
  },
  required: ["total", "por_tipo", "confianca", "observacao"],
  additionalProperties: false,
};

type RawAnswer = {
  total?: number;
  por_tipo?: { tipo?: string; quantidade?: number }[];
  confianca?: string;
  observacao?: string;
};

export class CountError extends Error {
  constructor(public code: "ai_api" | "ai_format", message: string) {
    super(message);
  }
}

/** Tenta ler o JSON da resposta, mesmo se vier com texto ou cercas de código em volta. */
function parseAnswer(text: string): RawAnswer | null {
  try {
    return JSON.parse(text) as RawAnswer;
  } catch {
    const first = text.indexOf("{");
    const last = text.lastIndexOf("}");
    if (first === -1 || last <= first) return null;
    try {
      return JSON.parse(text.slice(first, last + 1)) as RawAnswer;
    } catch {
      return null;
    }
  }
}

async function askOnce(client: Anthropic, image: string, mediaType: "image/jpeg" | "image/png" | "image/webp", maxTokens: number) {
  let message;
  try {
    message = await client.messages.create({
      model: MODEL,
      max_tokens: maxTokens,
      output_config: { format: { type: "json_schema", schema: SCHEMA } },
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mediaType, data: image } },
            { type: "text", text: PROMPT },
          ],
        },
      ],
    });
  } catch (e) {
    throw new CountError("ai_api", (e as Error).message);
  }
  const text = message.content.map((block) => (block.type === "text" ? block.text : "")).join("");
  const raw = parseAnswer(text);
  if (!raw) {
    // stop_reason diz o porquê: max_tokens (cortou), refusal (recusou) etc.
    throw new CountError(
      "ai_format",
      `stop=${message.stop_reason} blocks=${message.content.map((b) => b.type).join(",")} text=${text.slice(0, 100)}`,
    );
  }
  return raw;
}

/** Manda a foto para a API de visão e devolve a contagem sugerida. */
export async function countPieces(image: Buffer, mediaType: "image/jpeg" | "image/png" | "image/webp"): Promise<CountResult> {
  const client = new Anthropic({ maxRetries: 2 }); // usa ANTHROPIC_API_KEY do ambiente
  const data = image.toString("base64");
  let raw: RawAnswer;
  try {
    raw = await askOnce(client, data, mediaType, 2000);
  } catch (e) {
    // Resposta fora do formato: tenta mais uma vez com mais espaço antes de desistir
    if (!(e instanceof CountError) || e.code !== "ai_format") throw e;
    console.warn("contar: 1ª resposta fora do formato, tentando de novo", e.message);
    raw = await askOnce(client, data, mediaType, 4000);
  }

  const total = Math.max(0, Math.min(200, Math.round(Number(raw.total) || 0)));
  const por_tipo: Record<string, number> = {};
  for (const item of raw.por_tipo ?? []) {
    const n = Math.round(Number(item.quantidade) || 0);
    if (item.tipo && n > 0) por_tipo[item.tipo] = (por_tipo[item.tipo] ?? 0) + n;
  }
  const confianca = raw.confianca === "alta" || raw.confianca === "media" || raw.confianca === "baixa" ? raw.confianca : "baixa";
  const observacao = typeof raw.observacao === "string" && raw.observacao.trim() ? raw.observacao.slice(0, 160) : undefined;
  return { total, por_tipo, confianca, observacao };
}
