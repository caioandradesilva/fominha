import Anthropic from "@anthropic-ai/sdk";

export type CountResult = {
  total: number;
  por_tipo: Record<string, number>;
  confianca: "alta" | "media" | "baixa";
  observacao?: string;
  /** Só no modo "auto": a IA sugere se a foto é de um prato individual ("meu") ou de uma barca da mesa ("mesa") */
  destino?: "meu" | "mesa";
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

/** Tipos do registro rápido (mesmos nomes dos botões do app). A barca é contada só nesses tipos. */
export const BOAT_TYPES = ["Uramaki", "Hot roll", "Niguiri", "Sashimi", "Hossomaki", "Joe", "Temaki", "Outra"] as const;

const BOAT_PROMPT = `Esta é a foto de uma barca (ou travessa) de rodízio de sushi em modo festival, que vai ser dividida pela mesa.
Conte TODAS as peças de comida da barca e classifique cada uma em exatamente um destes tipos:
- Uramaki: enrolado com o arroz por fora (pode ter gergelim, cream cheese, cobertura).
- Hot roll: enrolado empanado e frito (casca dourada/marrom).
- Niguiri: bolinho de arroz com uma fatia de peixe ou outro ingrediente por cima.
- Sashimi: fatia de peixe crua sem arroz (cada fatia conta 1).
- Hossomaki: enrolado fino com a alga por fora.
- Joe: bolinho de arroz envolto por uma fatia de salmão, geralmente com algo por cima.
- Temaki: cone de alga.
- Outra: qualquer outra peça de comida (gunkan, harumaki, ceviche em colher, etc.).
Regras:
- Cada peça conta 1. Peças sobrepostas ou em fileira contam separadamente; conte com cuidado fileira por fileira.
- NÃO conte gengibre, wasabi, molho, folhas, flores, decoração, rabanete ralado, hashi ou a própria barca.
- Se parte da barca estiver fora da foto, borrada, ou houver peças escondidas/empilhadas, use confiança "baixa" e diga onde em observacao.
- Se a foto não mostrar comida, responda total 0, confiança "baixa" e explique em observacao.
- total deve ser a soma de por_tipo. Inclua em por_tipo só os tipos que aparecem.
Em observacao, escreva uma frase curta em português (pode ser vazia).`;

const BOAT_SCHEMA = {
  type: "object",
  properties: {
    total: { type: "integer" },
    por_tipo: {
      type: "array",
      items: {
        type: "object",
        properties: { tipo: { type: "string", enum: [...BOAT_TYPES] }, quantidade: { type: "integer" } },
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

/** Modo automático (botão único de foto): conta nos 8 tipos do painel e sugere o destino. */
const AUTO_PROMPT = `Esta é uma foto tirada à mesa num rodízio (normalmente sushi). Pode ser:
- o PRATO de uma pessoa (prato individual, geralmente com poucas peças, misturadas), ou
- uma BARCA/TRAVESSA que veio para a mesa ser dividida (barca de madeira, travessa grande, peças em fileiras, muitas vezes várias peças do mesmo tipo).
1) Conte TODAS as peças de comida e classifique cada uma em exatamente um destes tipos:
- Uramaki: enrolado com o arroz por fora.
- Hot roll: enrolado empanado e frito.
- Niguiri: bolinho de arroz com uma fatia por cima.
- Sashimi: fatia de peixe crua sem arroz, cortada grossa (cada fatia conta 1). Carpaccio (lâminas bem finas, espalhadas no prato, com molho) NÃO é sashimi: classifique como Outra.
- Hossomaki: enrolado fino com a alga por fora.
- Joe: bolinho de arroz envolto por uma fatia de salmão.
- Temaki: cone de alga.
- Outra: qualquer outra comida (carpaccio, gunkan, harumaki, pratos quentes, sobremesa etc.).
Regras de contagem: cada peça conta 1; peças sobrepostas ou em fileira contam separadamente; NÃO conte gengibre, wasabi, molho, folhas, decoração, hashi ou o recipiente. Uma porção servida numa tigela ou um prato quente conta 1.
2) Em destino, responda "mesa" se for barca/travessa para dividir, ou "meu" se for o prato de uma pessoa.
Se a foto estiver cortada, borrada ou com peças escondidas, use confiança "baixa" e diga onde em observacao. Se não houver comida, total 0, confiança "baixa".
total deve ser a soma de por_tipo. Em observacao, uma frase curta em português (pode ser vazia).`;

const AUTO_SCHEMA = {
  ...BOAT_SCHEMA,
  properties: { ...BOAT_SCHEMA.properties, destino: { type: "string", enum: ["meu", "mesa"] } },
  required: [...BOAT_SCHEMA.required, "destino"],
};

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
  destino?: string;
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

async function askOnce(
  client: Anthropic,
  image: string,
  mediaType: "image/jpeg" | "image/png" | "image/webp",
  maxTokens: number,
  mode: CountMode,
  usage: Usage,
) {
  let message;
  try {
    message = await client.messages.create({
      model: MODEL,
      max_tokens: maxTokens,
      output_config: { format: { type: "json_schema", schema: mode === "auto" ? AUTO_SCHEMA : mode === "barca" ? BOAT_SCHEMA : SCHEMA } },
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mediaType, data: image } },
            { type: "text", text: mode === "auto" ? AUTO_PROMPT : mode === "barca" ? BOAT_PROMPT : PROMPT },
          ],
        },
      ],
    });
  } catch (e) {
    throw new CountError("ai_api", (e as Error).message);
  }
  usage.model = message.model;
  usage.input += message.usage?.input_tokens ?? 0;
  usage.output += message.usage?.output_tokens ?? 0;
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

export type CountMode = "prato" | "barca" | "auto";

/** Tokens gastos numa contagem (somando a 2ª tentativa, se houver). */
export type Usage = { input: number; output: number; model: string };

/** Manda a foto para a API de visão e devolve a contagem sugerida. */
export async function countPieces(
  image: Buffer,
  mediaType: "image/jpeg" | "image/png" | "image/webp",
  mode: CountMode = "prato",
  usage: Usage = { input: 0, output: 0, model: MODEL },
): Promise<CountResult> {
  const client = new Anthropic({ maxRetries: 2 }); // usa ANTHROPIC_API_KEY do ambiente
  const data = image.toString("base64");
  let raw: RawAnswer;
  try {
    raw = await askOnce(client, data, mediaType, mode === "prato" ? 2000 : 3000, mode, usage);
  } catch (e) {
    // Resposta fora do formato: tenta mais uma vez com mais espaço antes de desistir
    if (!(e instanceof CountError) || e.code !== "ai_format") throw e;
    console.warn("contar: 1ª resposta fora do formato, tentando de novo", e.message);
    raw = await askOnce(client, data, mediaType, 6000, mode, usage);
  }

  const por_tipo: Record<string, number> = {};
  for (const item of raw.por_tipo ?? []) {
    const n = Math.round(Number(item.quantidade) || 0);
    if (item.tipo && n > 0) por_tipo[item.tipo] = (por_tipo[item.tipo] ?? 0) + n;
  }
  const cap = mode === "prato" ? 200 : 500;
  // Na barca e no modo automático o total é sempre a soma dos tipos (é o que o app usa como saldo)
  const rawTotal = mode === "prato" ? Number(raw.total) || 0 : Object.values(por_tipo).reduce((a, b) => a + b, 0);
  const total = Math.max(0, Math.min(cap, Math.round(rawTotal)));
  const confianca = raw.confianca === "alta" || raw.confianca === "media" || raw.confianca === "baixa" ? raw.confianca : "baixa";
  const observacao = typeof raw.observacao === "string" && raw.observacao.trim() ? raw.observacao.slice(0, 280) : undefined;
  const destino = mode === "auto" ? (raw.destino === "mesa" ? "mesa" : "meu") : undefined;
  return { total, por_tipo, confianca, observacao, ...(destino ? { destino } : {}) };
}
