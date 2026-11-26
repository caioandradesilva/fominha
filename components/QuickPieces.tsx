"use client";

import type { ReactNode } from "react";

/** Peças do registro rápido (modo festival: a pessoa come direto da barca). */
export const QUICK_PIECES: { id: string; label: string; art: ReactNode }[] = [
  {
    id: "Uramaki",
    label: "Uramaki",
    art: (
      <>
        <circle cx="16" cy="16" r="13" fill="#f7f3ec" stroke="#d8d1c8" strokeWidth="1" />
        <circle cx="16" cy="16" r="8" fill="none" stroke="#2f3a2c" strokeWidth="2" />
        <circle cx="16" cy="16" r="4.5" fill="#f08a5d" />
        <circle cx="8" cy="11" r="0.9" fill="#c8bfb4" />
        <circle cx="23" cy="9" r="0.9" fill="#c8bfb4" />
        <circle cx="24" cy="21" r="0.9" fill="#c8bfb4" />
      </>
    ),
  },
  {
    id: "Hot roll",
    label: "Hot roll",
    art: (
      <>
        <circle cx="16" cy="16" r="13" fill="#d99a3d" />
        <circle cx="16" cy="16" r="9" fill="#f7f3ec" />
        <circle cx="16" cy="16" r="4.5" fill="#f08a5d" />
        <path d="M6 9l2 1M25 8l-1 2M26 22l-2-1M7 23l2-1" stroke="#a86a1c" strokeWidth="1.4" strokeLinecap="round" />
      </>
    ),
  },
  {
    id: "Niguiri",
    label: "Niguiri",
    art: (
      <>
        <ellipse cx="16" cy="20" rx="12" ry="6" fill="#f7f3ec" stroke="#d8d1c8" strokeWidth="1" />
        <path d="M4 16c0-5 5-8 12-8s12 3 12 8c0 2-5 3-12 3S4 18 4 16z" fill="#f08a5d" />
        <path d="M10 10l-2 6M15 9l-2 8M20 9l-2 8M25 11l-2 6" stroke="#fbe3da" strokeWidth="1.2" strokeLinecap="round" />
      </>
    ),
  },
  {
    id: "Sashimi",
    label: "Sashimi",
    art: (
      <>
        <rect x="5" y="10" width="22" height="12" rx="4" fill="#f08a5d" />
        <path d="M10 10l-3 12M15 10l-3 12M20 10l-3 12M25 10l-3 12" stroke="#fbe3da" strokeWidth="1.3" strokeLinecap="round" />
      </>
    ),
  },
  {
    id: "Hossomaki",
    label: "Hossomaki",
    art: (
      <>
        <circle cx="16" cy="16" r="12" fill="#2f3a2c" />
        <circle cx="16" cy="16" r="9.5" fill="#f7f3ec" />
        <circle cx="16" cy="16" r="4" fill="#f08a5d" />
      </>
    ),
  },
  {
    id: "Joe",
    label: "Joe",
    art: (
      <>
        <circle cx="16" cy="17" r="12" fill="#f08a5d" />
        <path d="M6 13c3 2 4-1 7 1s4-1 7 1 4-1 6 1" stroke="#fbe3da" strokeWidth="1.3" fill="none" strokeLinecap="round" />
        <path d="M10 12c2-3 10-3 12 0-2 2-10 2-12 0z" fill="#f7f3ec" />
        <circle cx="13" cy="11.5" r="0.8" fill="#f5b529" />
        <circle cx="17" cy="11" r="0.8" fill="#f5b529" />
        <circle cx="20" cy="11.8" r="0.8" fill="#f5b529" />
      </>
    ),
  },
  {
    id: "Temaki",
    label: "Temaki",
    art: (
      <>
        <path d="M6 7h20L16 29z" fill="#2f3a2c" />
        <ellipse cx="16" cy="8" rx="10" ry="4" fill="#f7f3ec" />
        <ellipse cx="16" cy="7" rx="5" ry="2.5" fill="#f08a5d" />
        <path d="M9 6l2 2M22 5l-2 3" stroke="#9bbf5a" strokeWidth="1.6" strokeLinecap="round" />
      </>
    ),
  },
  {
    id: "Outra",
    label: "Outra",
    art: (
      <>
        <circle cx="16" cy="16" r="12" fill="#efeae3" />
        <path d="M16 10v12M10 16h12" stroke="#1a1714" strokeWidth="2.4" strokeLinecap="round" />
      </>
    ),
  },
];

export function PieceArt({ id, size = 32 }: { id: string; size?: number }) {
  const piece = QUICK_PIECES.find((p) => p.id === id) ?? QUICK_PIECES[QUICK_PIECES.length - 1];
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      {piece.art}
    </svg>
  );
}

export function QuickPanel({
  myCounts,
  remaining,
  boatCounts,
  boatTotal,
  onTap,
  onBoat,
  toast,
  onUndoToast,
}: {
  myCounts: Record<string, number>;
  /** Saldo da barca por tipo (null = nenhuma barca registrada) */
  remaining: Record<string, number> | null;
  /** Peças que as barcas trouxeram, somadas por tipo (null = nenhuma barca) */
  boatCounts: Record<string, number> | null;
  boatTotal: number;
  onTap: (id: string) => void;
  onBoat: () => void;
  toast: { label: string; failed?: boolean } | null;
  onUndoToast: () => void;
}) {
  // Com barca registrada, só aparecem as peças que vieram nela (e "Outra", para o que a IA não previu)
  const visible = boatCounts ? QUICK_PIECES.filter((p) => p.id === "Outra" || (boatCounts[p.id] ?? 0) > 0) : QUICK_PIECES;
  const left = remaining ? Object.values(remaining).reduce((a, b) => a + Math.max(0, b), 0) : 0;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex h-7 items-center justify-between gap-2" aria-live="polite">
        {!toast && (
          <span className="truncate text-[13px] font-semibold text-muted">
            {remaining ? (
              <>
                Barca: <strong className="text-ink">{left}</strong> de {boatTotal} restando
              </>
            ) : (
              "Comeu da barca? Toque na peça"
            )}
          </span>
        )}
        {!toast && (
          <button onClick={onBoat} className="flex h-7 shrink-0 items-center gap-1.5 rounded-full bg-ink px-3 text-xs font-semibold text-white">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" />
              <circle cx="12" cy="13.5" r="3.5" />
            </svg>
            {remaining ? "Nova barca" : "Foto da barca"}
          </button>
        )}
        {toast && (
          <span className={`flex w-full items-center justify-between gap-2 text-[13px] font-semibold ${toast.failed ? "text-tomato-dark" : "text-ok"}`}>
            <span className="truncate">{toast.label}</span>
            {!toast.failed && (
              <button onClick={onUndoToast} className="rounded-md border border-line px-2 py-0.5 text-xs text-ink">
                Desfazer
              </button>
            )}
          </span>
        )}
      </div>
      <div className="grid grid-cols-4 gap-2">
        {visible.map((p) => {
          const mine = myCounts[p.id] ?? 0;
          const rest = remaining && p.id !== "Outra" ? Math.max(0, remaining[p.id] ?? 0) : null;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => onTap(p.id)}
              aria-label={`Comi 1 ${p.label}`}
              className={`relative flex h-[70px] flex-col items-center justify-center gap-1 rounded-2xl border transition-transform select-none active:scale-90 active:bg-tomato-soft ${rest === 0 ? "border-line bg-[#f3efe9] opacity-55" : "border-line bg-cream"}`}
            >
              <PieceArt id={p.id} size={30} />
              <span className="text-[11px] leading-none font-semibold">{p.label}</span>
              {rest !== null && <span className="text-[10px] leading-none font-semibold text-muted">{rest === 0 ? "acabou" : `restam ${rest}`}</span>}
              {mine > 0 && (
                <span className="absolute -top-1.5 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-ink px-1 text-[11px] font-bold text-white">
                  {mine}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
