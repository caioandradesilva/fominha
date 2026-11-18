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

/** Manda a foto para a API de visão e devolve a contagem sugerida. */
export async function countPieces(image: Buffer, mediaType: "image/jpeg" | "image/png" | "image/webp"): Promise<CountResult> {
  const client = new Anthropic(); // usa ANTHROPIC_API_KEY do ambiente
  let message;
  try {
    message = await client.messages.create({
      model: MODEL,
      max_tokens: 600,
      output_config: { format: { type: "json_schema", schema: SCHEMA } },
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mediaType, data: image.toString("base64") } },
            { type: "text", text: PROMPT },
          ],
        },
      ],
    });
  } catch (e) {
    throw new CountError("ai_api", (e as Error).message);
  }

  const text = message.content.map((block) => (block.type === "text" ? block.text : "")).join("");
  let raw: RawAnswer;
  try {
    raw = JSON.parse(text) as RawAnswer;
  } catch {
    throw new CountError("ai_format", `Resposta fora do formato: ${text.slice(0, 120)}`);
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
