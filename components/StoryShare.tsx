"use client";

import { useEffect, useState } from "react";
import { QUICK_PIECES } from "@/components/QuickPieces";
import { avatarColor, primaryButton, secondaryButton } from "@/components/ui";
import { isPoints, unitLabel, type Scoring } from "@/lib/scoring";

type StoryScore = { userId: string; name: string; total: number; pieces: number };
type StoryEvent = { name: string; restaurant_name: string | null; starts_at?: string | null };
type StoryEntry = { count_final: number; ai_result?: { por_tipo?: Record<string, number> } | null };
type Variant = "final" | "parcial";

const W = 1080;
const H = 1920;
const TOMATO = "#D33D15";
const CREAM = "#FAF8F5";
const INK = "#1A1714";
const GOLD = "#F5B529";
const BLUSH = "#FBE3DA";
const DISPLAY = '"Bricolage Grotesque Variable", "Inter Variable", sans-serif';
const SANS = '"Inter Variable", system-ui, sans-serif';
const PIECE_IDS = new Set(QUICK_PIECES.map((p) => p.id));

function font(weight: number, size: number, family = SANS) {
  return `${weight} ${size}px ${family}`;
}

/** Escreve o texto no maior tamanho que cabe em maxW (até minSize); se não couber, corta com "…". */
function fitText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, size: number, minSize: number, weight: number, family: string) {
  let s = size;
  ctx.font = font(weight, s, family);
  while (s > minSize && ctx.measureText(text).width > maxW) {
    s -= 2;
    ctx.font = font(weight, s, family);
  }
  let t = text;
  while (t.length > 1 && ctx.measureText(t).width > maxW) t = t.slice(0, -2) + "…";
  ctx.fillText(t, x, y);
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
}

function shortDate(iso?: string | null) {
  const d = iso ? new Date(iso) : new Date();
  return d.toLocaleDateString("pt-BR", { day: "numeric", month: "short" }).replace(".", "");
}

/** Desenha o card vertical (1080×1920) com o pódio e devolve um PNG. */
export async function drawStory(variant: Variant, event: StoryEvent, scores: StoryScore[], scoring: Scoring, entries: StoryEntry[]): Promise<Blob> {
  await Promise.all([
    document.fonts.load(font(800, 100, DISPLAY)),
    document.fonts.load(font(700, 40)),
    document.fonts.load(font(500, 40)),
  ]).catch(() => undefined);

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  ctx.textBaseline = "alphabetic";

  // Fundo
  ctx.fillStyle = TOMATO;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "rgba(255,255,255,0.07)";
  ctx.beginPath();
  ctx.arc(W - 40, 250, 330, 0, Math.PI * 2);
  ctx.fill();

  // Marca: prato + "rodizium"
  ctx.fillStyle = "#FFFFFF";
  ctx.beginPath();
  ctx.arc(126, 140, 36, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = TOMATO;
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.arc(126, 140, 20, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = "#FFFFFF";
  ctx.font = font(800, 76, DISPLAY);
  ctx.fillText("rodizium", 180, 166);

  // Selo
  const tag = variant === "final" ? "RESULTADO DO RODÍZIO" : "PLACAR AO VIVO";
  ctx.font = font(700, 30);
  const tagW = ctx.measureText(tag).width + 56;
  ctx.fillStyle = GOLD;
  roundRect(ctx, 90, 238, tagW, 58, 29);
  ctx.fillStyle = INK;
  ctx.fillText(tag, 118, 278);

  // Evento
  ctx.fillStyle = "#FFFFFF";
  fitText(ctx, event.name, 90, 400, W - 180, 74, 48, 800, DISPLAY);
  ctx.fillStyle = BLUSH;
  ctx.font = font(500, 40);
  const where = [event.restaurant_name, shortDate(event.starts_at)].filter(Boolean).join(" · ");
  fitText(ctx, where, 90, 462, W - 180, 40, 30, 500, SANS);

  // Destaque: campeão (final) ou líder (parcial)
  const ranked = scores.filter((s) => s.total > 0);
  const first = ranked[0];
  const unit = (n: number) => unitLabel(scoring, n);
  if (first) {
    ctx.fillStyle = GOLD;
    ctx.font = font(700, 34);
    ctx.fillText(variant === "final" ? "CAMPEÃO DA NOITE" : "LIDERANDO AGORA", 90, 610);
    ctx.fillStyle = "#FFFFFF";
    fitText(ctx, first.name, 90, 760, W - 180, 150, 80, 800, DISPLAY);
    ctx.fillStyle = BLUSH;
    ctx.font = font(600, 52);
    const extra = isPoints(scoring) ? ` · ${first.pieces} peças` : "";
    ctx.fillText(`${first.total} ${unit(first.total)}${extra}`, 90, 840);
  }

  // Pódio (2º, 1º, 3º)
  const base = 1500;
  const colW = 280;
  const slots: { s?: StoryScore; place: number; x: number; h: number }[] = [
    { s: ranked[1], place: 2, x: W / 2 - colW - 30, h: 290 },
    { s: ranked[0], place: 1, x: W / 2, h: 390 },
    { s: ranked[2], place: 3, x: W / 2 + colW + 30, h: 220 },
  ];
  ctx.textAlign = "center";
  for (const { s, place, x, h } of slots) {
    if (!s) continue;
    const top = base - h;
    // avatar
    const r = place === 1 ? 70 : 58;
    const cy = top - 120;
    ctx.fillStyle = avatarColor(s.userId);
    ctx.beginPath();
    ctx.arc(x, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = INK;
    ctx.font = font(800, r, DISPLAY);
    ctx.fillText(s.name.charAt(0).toUpperCase(), x, cy + r * 0.36);
    // nome
    ctx.fillStyle = "#FFFFFF";
    fitText(ctx, s.name, x, top - 22, colW - 10, 40, 26, 700, SANS);
    // barra
    ctx.fillStyle = place === 1 ? CREAM : "rgba(255,255,255,0.22)";
    roundRect(ctx, x - colW / 2, top, colW, h + 40, 32);
    ctx.fillStyle = place === 1 ? TOMATO : "#FFFFFF";
    ctx.font = font(800, place === 1 ? 104 : 84, DISPLAY);
    ctx.fillText(String(s.total), x, top + (place === 1 ? 140 : 112));
    ctx.font = font(700, 32);
    ctx.fillText(`${place}º lugar`, x, top + (place === 1 ? 196 : 162));
  }
  ctx.textAlign = "left";

  // Números do grupo
  const pieces = entries.reduce((a, e) => a + e.count_final, 0);
  const byType: Record<string, number> = {};
  for (const e of entries)
    for (const [k, v] of Object.entries(e.ai_result?.por_tipo ?? {})) if (PIECE_IDS.has(k) && k !== "Outra") byType[k] = (byType[k] ?? 0) + v;
  const topType = Object.entries(byType).sort((a, b) => b[1] - a[1])[0]?.[0];
  const stats = [
    [String(pieces), "peças no grupo"],
    [String(ranked.length), ranked.length === 1 ? "jogador" : "jogadores"],
    [topType ?? "—", "peça mais comida"],
  ];
  ctx.fillStyle = CREAM;
  roundRect(ctx, 60, 1570, W - 120, 200, 36);
  const colStat = (W - 120) / 3;
  ctx.textAlign = "center";
  stats.forEach(([v, l], i) => {
    const cx = 60 + colStat * i + colStat / 2;
    ctx.fillStyle = INK;
    fitText(ctx, v, cx, 1675, colStat - 40, 60, 34, 800, DISPLAY);
    ctx.fillStyle = "#6B645C";
    ctx.font = font(500, 28);
    ctx.fillText(l, cx, 1725);
  });

  // Rodapé
  ctx.textAlign = "left";
  ctx.fillStyle = "#FFFFFF";
  ctx.font = font(700, 38);
  ctx.fillText("@rodizium.app", 90, 1860);
  ctx.textAlign = "right";
  ctx.fillStyle = BLUSH;
  ctx.font = font(500, 32);
  ctx.fillText("Quem come mais no rodízio?", W - 90, 1858);

  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("png"))), "image/png"));
}

/** Botão "Postar no Stories": gera a imagem, mostra a prévia e abre o compartilhamento do celular. */
export function StoryButton({
  variant,
  event,
  scores,
  scoring,
  entries,
}: {
  variant: Variant;
  event: StoryEvent;
  scores: StoryScore[];
  scoring: Scoring;
  entries: StoryEntry[];
}) {
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(
    () => () => {
      if (url) URL.revokeObjectURL(url);
    },
    [url],
  );

  async function open() {
    setBusy(true);
    setMsg(null);
    try {
      const blob = await drawStory(variant, event, scores, scoring, entries);
      setFile(new File([blob], "rodizium-placar.png", { type: "image/png" }));
      setUrl(URL.createObjectURL(blob));
    } catch {
      setMsg("Não deu para gerar a imagem.");
    }
    setBusy(false);
  }

  async function share() {
    if (!file) return;
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: "Rodizium" });
      } catch {
        /* a pessoa fechou o compartilhamento */
      }
      return;
    }
    download();
    setMsg("Seu navegador não abre o compartilhamento. A imagem foi baixada: poste pelo Instagram.");
  }

  function download() {
    if (!url) return;
    const a = document.createElement("a");
    a.href = url;
    a.download = "rodizium-placar.png";
    a.click();
  }

  function close() {
    setFile(null);
    setUrl(null);
  }

  const igIcon = (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  );

  return (
    <>
      {variant === "final" ? (
        <button onClick={open} disabled={busy} className={primaryButton + " gap-2"}>
          {igIcon}
          {busy ? "Gerando…" : "Postar no Stories"}
        </button>
      ) : (
        <button onClick={open} disabled={busy} className="-mt-1 flex h-10 items-center justify-center gap-2 self-center text-sm font-semibold text-tomato-dark">
          {igIcon}
          {busy ? "Gerando…" : "Postar placar parcial no Stories"}
        </button>
      )}

      {url && (
        <div className="fixed inset-0 z-50 flex items-end bg-[rgba(26,23,20,0.7)]" onClick={close}>
          <div
            role="dialog"
            aria-label="Postar no Stories"
            className="mx-auto flex max-h-[96dvh] w-full max-w-md flex-col items-center gap-3 overflow-y-auto rounded-t-3xl bg-cream px-5 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="h-1.5 w-10 shrink-0 rounded-full bg-line-strong" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt="Imagem do placar para o Stories" className="h-[52dvh] max-h-[520px] w-auto rounded-2xl shadow-lg" />
            <p className="text-center text-[13px] leading-relaxed text-muted">
              Toque em Compartilhar e escolha <strong className="text-ink">Instagram → Stories</strong>. Marque{" "}
              <strong className="text-ink">@rodizium.app</strong>
              {event.restaurant_name ? " e o restaurante" : ""} para a gente repostar!
            </p>
            <button onClick={share} className={primaryButton + " gap-2"}>
              {igIcon}
              Compartilhar
            </button>
            <button onClick={download} className={secondaryButton + " w-full"}>
              Baixar imagem
            </button>
            {msg && <p className="text-center text-sm text-tomato-dark">{msg}</p>}
          </div>
        </div>
      )}
      {!url && msg && <p className="text-center text-sm text-tomato-dark">{msg}</p>}
    </>
  );
}
