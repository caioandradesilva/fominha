import Anthropic from "@anthropic-ai/sdk";

export type CountResult = {
  total: number;
  por_tipo: Record<string, number>;
  confianca: "alta" | "media" | "baixa";
  observacao?: string;
};

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5";

const PROMPT = `Esta é a foto de um prato num rodízio (normalmente sushi; pode ser pizza, churrasco ou hambúrguer).
Conte cada peça individual de comida que a pessoa vai comer e registre com a ferramenta registrar_contagem.
- Sushi: cada nigiri, uramaki, hossomaki, hot roll, gunkan, temaki e fatia de sashimi conta 1. Peças sobrepostas contam separadamente.
- Pizza: cada fatia conta 1. Churrasco: cada pedaço de carne conta 1. Hambúrguer: cada mini-hambúrguer conta 1.
- NÃO conte gengibre, wasabi, molho, folhas, decoração, hashi ou o próprio prato.
- Se parte do prato estiver fora da foto, borrada ou com peças empilhadas que não dá para separar, use confiança "baixa".
- Se a foto não mostrar comida, registre total 0, confiança "baixa" e explique em observacao.`;

const TOOL = {
  name: "registrar_contagem",
  description: "Registra quantas peças de comida há no prato da foto.",
  input_schema: {
    type: "object" as const,
    properties: {
      total: { type: "integer", description: "Número total de peças de comida" },
      por_tipo: {
        type: "object",
        description: "Quantidade por tipo, com nomes simples em português (ex.: uramaki, nigiri, hot roll)",
        additionalProperties: { type: "integer" },
      },
      confianca: { type: "string", enum: ["alta", "media", "baixa"] },
      observacao: { type: "string", description: "Frase curta opcional, em português" },
    },
    required: ["total", "por_tipo", "confianca"],
  },
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
      tools: [TOOL],
      tool_choice: { type: "tool", name: TOOL.name },
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

  const toolUse = message.content.find((block) => block.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") throw new CountError("ai_format", "Resposta sem a ferramenta de contagem");
  const raw = toolUse.input as Partial<CountResult>;

  const total = Math.max(0, Math.min(200, Math.round(Number(raw.total) || 0)));
  const por_tipo: Record<string, number> = {};
  for (const [k, v] of Object.entries(raw.por_tipo ?? {})) {
    const n = Math.round(Number(v) || 0);
    if (n > 0) por_tipo[k] = n;
  }
  const confianca = raw.confianca === "alta" || raw.confianca === "media" || raw.confianca === "baixa" ? raw.confianca : "baixa";
  return { total, por_tipo, confianca, observacao: typeof raw.observacao === "string" ? raw.observacao.slice(0, 160) : undefined };
}
