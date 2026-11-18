import Anthropic from "@anthropic-ai/sdk";

export type CountResult = {
  total: number;
  por_tipo: Record<string, number>;
  confianca: "alta" | "media" | "baixa";
  observacao?: string;
};

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5";

const PROMPT = `Você recebe a foto de um prato num rodízio (normalmente sushi; pode ser pizza, churrasco ou hambúrguer).
Conte cada peça individual de comida que a pessoa vai comer.
- Sushi: cada nigiri, uramaki, hossomaki, hot roll, gunkan, temaki e fatia de sashimi conta 1. Peças sobrepostas contam separadamente.
- Pizza: cada fatia conta 1. Churrasco: cada pedaço de carne conta 1. Hambúrguer: cada mini-hambúrguer conta 1.
- NÃO conte gengibre, wasabi, molho, folhas, decoração, hashi ou o próprio prato.
- Se parte do prato estiver fora da foto, borrada ou com peças empilhadas que você não consegue separar, use confiança "baixa".
Responda APENAS com um JSON, sem texto antes ou depois, neste formato:
{"total": 0, "por_tipo": {"uramaki": 0}, "confianca": "alta", "observacao": "frase curta opcional"}
Em "por_tipo", use nomes simples em português e inclua só os tipos que aparecem.`;

/** Manda a foto para a API de visão e devolve a contagem sugerida. */
export async function countPieces(image: Buffer, mediaType: "image/jpeg" | "image/png" | "image/webp"): Promise<CountResult> {
  const client = new Anthropic(); // usa ANTHROPIC_API_KEY do ambiente
  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 400,
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

  const text = message.content
    .map((block) => (block.type === "text" ? block.text : ""))
    .join("");
  const json = text.match(/\{[\s\S]*\}/)?.[0];
  if (!json) throw new Error("Resposta da IA sem JSON");
  const raw = JSON.parse(json) as Partial<CountResult>;

  const total = Math.max(0, Math.min(200, Math.round(Number(raw.total) || 0)));
  const por_tipo: Record<string, number> = {};
  for (const [k, v] of Object.entries(raw.por_tipo ?? {})) {
    const n = Math.round(Number(v) || 0);
    if (n > 0) por_tipo[k] = n;
  }
  const confianca = raw.confianca === "alta" || raw.confianca === "media" || raw.confianca === "baixa" ? raw.confianca : "baixa";
  return { total, por_tipo, confianca, observacao: raw.observacao?.slice(0, 160) };
}
