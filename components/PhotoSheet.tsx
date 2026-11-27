"use client";

import { useEffect, useMemo, useState } from "react";
import { PieceArt, QUICK_PIECES } from "@/components/QuickPieces";
import { primaryButton, secondaryButton } from "@/components/ui";
import { agoLabel, findDuplicate, type Candidate } from "@/lib/duplicates";
import { compressPhoto } from "@/lib/photo";
import { getSupabase } from "@/lib/supabase/client";

type AiResult = {
  total: number;
  por_tipo: Record<string, number>;
  confianca: "alta" | "media" | "baixa";
  observacao?: string;
  destino?: "meu" | "mesa";
};

type Step = "choose" | "counting" | "review";
type Dest = "meu" | "mesa";

const confidence = {
  alta: ["Confiança alta", "#e3f1e6", "#1e5b2e"],
  media: ["Confiança média", "#fdf0d2", "#5c3e00"],
  baixa: ["Confiança baixa", "#fbe3da", "#a82e0e"],
} as const;

/** A partir deste total, "Só meu" pede uma confirmação visual (provavelmente é barca). */
const BIG_PLATE = 10;

/**
 * Botão único de foto: a pessoa fotografa o que chegou, a IA conta por tipo e sugere
 * se é o prato dela ("Só meu") ou uma barca para a mesa ("Da mesa"). A pessoa confere e confirma.
 */
export function PhotoSheet({
  eventId,
  userId,
  candidates,
  nameOf,
  onClose,
  onSaved,
}: {
  eventId: string;
  userId: string;
  /** Barcas do evento e pratos com foto da própria pessoa, para o aviso de duplicata. */
  candidates: Candidate[];
  nameOf: (uid: string) => string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [step, setStep] = useState<Step>("choose");
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [dest, setDest] = useState<Dest>("meu");
  const [preview, setPreview] = useState<string | null>(null);
  const [photoPath, setPhotoPath] = useState<string | null>(null);
  const [ai, setAi] = useState<AiResult | undefined>();
  const [aiFailed, setAiFailed] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Id do registro parecido que a pessoa já disse ser outra barca/prato. */
  const [dupOk, setDupOk] = useState<string | null>(null);
  const [signed, setSigned] = useState<{ path: string; url: string } | null>(null);

  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  /** Apaga a foto enviada que não virou registro (a política do bucket só deixa apagar fotos sem uso). */
  function dropUpload() {
    if (photoPath) getSupabase().storage.from("plates").remove([photoPath]).catch(() => {});
  }

  async function onPhoto(file: File | undefined) {
    if (!file) return;
    dropUpload();
    setPhotoPath(null);
    setDupOk(null);
    setError(null);
    setAi(undefined);
    setAiFailed(null);
    setStep("counting");
    try {
      const blob = await compressPhoto(file, 1600, 0.82);
      setPreview(URL.createObjectURL(blob));
      const path = `${eventId}/${userId}/foto-${crypto.randomUUID()}.jpg`;
      const supabase = getSupabase();
      const { error: upErr } = await supabase.storage.from("plates").upload(path, blob, { contentType: "image/jpeg" });
      if (upErr) throw new Error("upload");
      await supabase.auth.getSession();
      setPhotoPath(path);
      const res = await fetch("/api/contar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId, path, mode: "auto" }),
      });
      if (!res.ok) {
        const info = (await res.json().catch(() => ({}))) as { code?: string; detail?: string };
        const stop = info.detail?.match(/stop=(\w+)/)?.[1];
        throw new Error(`ai:${res.status}:${info.code ?? "?"}${stop ? `:${stop}` : ""}`);
      }
      const result = (await res.json()) as AiResult;
      setAi(result);
      setCounts(result.por_tipo);
      setDest(result.destino === "mesa" ? "mesa" : "meu");
    } catch (e) {
      const msg = (e as Error).message || "erro";
      setAiFailed(msg);
      if (msg === "upload") setPhotoPath(null);
    }
    setStep("review");
  }

  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const bump = (id: string, d: number) =>
    setCounts((c) => {
      const n = Math.max(0, Math.min(200, (c[id] ?? 0) + d));
      const next = { ...c, [id]: n };
      if (n === 0) delete next[id];
      return next;
    });

  const dup = useMemo(
    () => (step === "review" && total > 0 ? findDuplicate(counts, candidates) : null),
    [step, total, counts, candidates],
  );
  const dupPending = dup !== null && dup.id !== dupOk;
  const dupPhoto = dup?.photoPath ?? null;

  const dupUrl = signed && signed.path === dupPhoto ? signed.url : null;

  useEffect(() => {
    if (!dupPhoto) return;
    let active = true;
    getSupabase()
      .storage.from("plates")
      .createSignedUrl(dupPhoto, 600)
      .then(({ data }) => {
        if (active && data?.signedUrl) setSigned({ path: dupPhoto, url: data.signedUrl });
      });
    return () => {
      active = false;
    };
  }, [dupPhoto]);

  function discardAsSame() {
    dropUpload();
    onClose();
  }

  async function save() {
    if (total === 0) return setError("Nenhuma peça marcada. Ajuste antes de confirmar.");
    if (dupPending) return;
    setBusy(true);
    setError(null);
    const supabase = getSupabase();
    let err;
    if (dest === "meu") {
      ({ error: err } = await supabase.from("entries").insert({
        event_id: eventId,
        user_id: userId,
        count_final: total,
        count_ai: ai?.total ?? null,
        photo_path: photoPath,
        ai_result: { fonte: "foto", por_tipo: counts, ia: ai ?? null },
      }));
    } else {
      ({ error: err } = await supabase.from("boats").insert({
        event_id: eventId,
        counts,
        total,
        photo_path: photoPath,
        ai_result: ai ?? null,
        updated_at: new Date().toISOString(),
      }));
    }
    if (err) {
      setBusy(false);
      return setError("Não salvou. Confira a internet e tente de novo.");
    }
    onSaved();
    onClose();
  }

  const camera = (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" />
      <circle cx="12" cy="13.5" r="3.5" />
    </svg>
  );
  const photoInput = (label: string, primary: boolean) => (
    <label className={primary ? primaryButton + " cursor-pointer gap-2" : secondaryButton + " flex cursor-pointer items-center justify-center"}>
      {primary && camera}
      {label}
      <input
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          onPhoto(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
    </label>
  );

  const destButton = (value: Dest, title: string, sub: string) => {
    const on = dest === value;
    return (
      <button
        type="button"
        aria-pressed={on}
        onClick={() => setDest(value)}
        className={`flex flex-1 flex-col items-start gap-0.5 rounded-2xl border-2 px-3.5 py-2.5 text-left transition-colors ${on ? "border-ink bg-ink text-white" : "border-line bg-white text-ink"}`}
      >
        <span className="text-[15px] font-bold">{title}</span>
        <span className={`text-xs ${on ? "text-[#d8d1c8]" : "text-muted"}`}>{sub}</span>
      </button>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-[rgba(26,23,20,0.55)]" onClick={step === "counting" ? undefined : onClose}>
      <div
        role="dialog"
        aria-label="Registrar foto"
        className="mx-auto flex max-h-[92dvh] w-full max-w-md flex-col gap-4 overflow-y-auto rounded-t-3xl bg-cream px-5 pt-3 pb-[max(1.5rem,env(safe-area-inset-bottom))]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto h-1.5 w-10 shrink-0 rounded-full bg-line-strong" />

        {step === "choose" && (
          <>
            <h2 className="font-display text-2xl font-extrabold">O que chegou?</h2>
            <p className="-mt-2 text-sm text-muted">
              Fotografe o seu prato ou a barca da mesa, de cima e antes de pegar. A IA conta as peças e você escolhe se é só seu ou da mesa.
            </p>
            {photoInput("Tirar foto", true)}
            <button onClick={() => setStep("review")} className={secondaryButton}>
              Registrar sem foto
            </button>
            <button onClick={onClose} className="h-10 text-sm font-semibold text-muted">
              Cancelar
            </button>
          </>
        )}

        {step === "counting" && (
          <div className="flex flex-col items-center gap-4 py-6">
            {preview && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt="Foto tirada" className="h-56 w-full rounded-2xl object-cover" />
            )}
            <div className="flex items-center gap-3">
              <span className="h-5 w-5 animate-spin rounded-full border-2 border-tomato border-t-transparent" />
              <span className="font-semibold">Contando as peças…</span>
            </div>
          </div>
        )}

        {step === "review" && (
          <>
            {preview && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt="Foto tirada" className="h-36 w-full shrink-0 rounded-2xl object-cover" />
            )}

            {dupPending && dup && (
              <div role="alert" className="flex flex-col gap-3 rounded-2xl border-2 border-gold bg-gold-soft p-3.5">
                <div className="flex flex-col gap-0.5">
                  <span className="text-[15px] font-bold text-ink">Já não registraram isso?</span>
                  <span className="text-[13px] text-[#5c3e00]">
                    {dup.userId === userId ? "Você" : nameOf(dup.userId)} registrou {dup.kind === "barca" ? "uma barca parecida" : "um prato parecido"}{" "}
                    {agoLabel(dup.createdAt)}: {describe(dup.counts)}.
                  </span>
                </div>
                {(preview || dupUrl) && (
                  <div className="flex gap-2">
                    {[
                      { src: preview, label: "Sua foto" },
                      { src: dupUrl, label: `Foto de ${dup.userId === userId ? "você" : nameOf(dup.userId)}` },
                    ].map((p) => (
                      <figure key={p.label} className="m-0 flex flex-1 flex-col gap-1">
                        {p.src ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={p.src} alt={p.label} className="h-24 w-full rounded-xl object-cover" />
                        ) : (
                          <div className="h-24 w-full rounded-xl bg-[#efe4c4]" />
                        )}
                        <figcaption className="text-[11px] font-semibold text-[#5c3e00]">{p.label}</figcaption>
                      </figure>
                    ))}
                  </div>
                )}
                <div className="flex gap-2">
                  <button onClick={discardAsSame} className="h-11 flex-1 rounded-xl bg-ink text-sm font-semibold text-white">
                    É a mesma
                  </button>
                  <button onClick={() => setDupOk(dup.id)} className="h-11 flex-1 rounded-xl border border-[#d9c48f] bg-white text-sm font-semibold text-ink">
                    Chegou outra
                  </button>
                </div>
              </div>
            )}

            <div className="flex flex-col gap-2">
              <span className="text-sm font-semibold">De quem são essas peças?</span>
              <div className="flex gap-2">
                {destButton("meu", "Só meu", "Soma para você")}
                {destButton("mesa", "Da mesa", "Barca: cada um marca o que comer")}
              </div>
              {ai?.destino && (
                <span className="text-xs text-muted">
                  A IA acha que é {ai.destino === "mesa" ? "uma barca para a mesa" : "um prato seu"}. Confira antes de confirmar.
                </span>
              )}
            </div>

            <div className="flex items-end justify-between">
              <div className="flex flex-col">
                <span className="text-sm font-semibold text-muted">{ai ? "A IA contou" : "Peças"}</span>
                <span className="font-display text-5xl leading-none font-extrabold">{total}</span>
              </div>
              {ai && (
                <span className="rounded-full px-2.5 py-1 text-xs font-bold" style={{ background: confidence[ai.confianca][1], color: confidence[ai.confianca][2] }}>
                  {confidence[ai.confianca][0]}
                </span>
              )}
            </div>

            {dest === "meu" && total >= BIG_PLATE && (
              <p className="rounded-xl bg-tomato-soft px-3 py-2 text-[13px] font-semibold text-tomato-dark">
                São {total} peças só para você. Se isso é uma barca para dividir, escolha &quot;Da mesa&quot;.
              </p>
            )}
            {ai?.confianca !== "alta" && ai?.observacao && (
              <p className="rounded-xl bg-gold-soft px-3 py-2 text-[13px] text-[#5c3e00]">{ai.observacao}</p>
            )}
            {aiFailed && (
              <p className="rounded-xl bg-gold-soft px-3 py-2 text-[13px] text-[#5c3e00]">
                Não consegui contar agora. Marque as peças manualmente.
                <span className="mt-1 block text-[11px] opacity-70">Código: {aiFailed}</span>
              </p>
            )}

            <div className="rounded-2xl border border-line bg-white px-3">
              {QUICK_PIECES.map((p, i) => {
                const n = counts[p.id] ?? 0;
                return (
                  <div key={p.id} className={`flex h-13 items-center gap-3 ${i < QUICK_PIECES.length - 1 ? "border-b border-[#f0ece6]" : ""}`}>
                    <PieceArt id={p.id} size={28} />
                    <span className={`flex-1 text-[15px] font-semibold ${n ? "" : "text-muted"}`}>{p.label}</span>
                    <button onClick={() => bump(p.id, -1)} aria-label={`Menos um ${p.label}`} className="flex h-9 w-9 items-center justify-center rounded-full border border-line text-lg">
                      −
                    </button>
                    <span className="w-7 text-center text-lg font-bold">{n}</span>
                    <button onClick={() => bump(p.id, 1)} aria-label={`Mais um ${p.label}`} className="flex h-9 w-9 items-center justify-center rounded-full border border-line text-lg">
                      +
                    </button>
                  </div>
                );
              })}
            </div>

            {error && <p className="text-center text-sm text-tomato-dark">{error}</p>}
            <button onClick={save} disabled={busy || dupPending} className={primaryButton + (dupPending ? " opacity-50" : "")}>
              {busy ? "Salvando…" : dupPending ? "Responda a pergunta acima" : dest === "meu" ? `Somar ${total} ${total === 1 ? "peça" : "peças"} para mim` : `Registrar barca da mesa · ${total} peças`}
            </button>
            {photoInput("Tirar outra foto", false)}
          </>
        )}
      </div>
    </div>
  );
}

/** "20 Uramaki", "6 Joe e 6 Uramaki", "12 Sashimi, 4 Joe e mais". */
function describe(counts: Record<string, number>) {
  const parts = Object.entries(counts)
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([k, n]) => `${n} ${k}`);
  if (parts.length <= 2) return parts.join(" e ");
  return `${parts.slice(0, 2).join(", ")} e mais`;
}
