"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Avatar } from "@/components/ui";

type Row = { userId: string; name: string; total: number };

const reduceMotion = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Ranking ao vivo com animação: as linhas deslizam para a nova posição (FLIP),
 * quem subiu ganha uma setinha por alguns segundos e o número "pula" quando muda.
 */
export function RankList({
  scores,
  meId,
  onPick,
}: {
  scores: Row[];
  meId: string;
  onPick: (userId: string) => void;
}) {
  const max = Math.max(1, scores[0]?.total ?? 1);
  const rows = useRef(new Map<string, HTMLButtonElement>());
  const totals = useRef(new Map<string, HTMLSpanElement>());
  const prevTop = useRef(new Map<string, number>());
  const prevRank = useRef(new Map<string, number>());
  const prevTotal = useRef(new Map<string, number>());
  const [climbers, setClimbers] = useState<Set<string>>(new Set());
  const order = scores.map((s) => `${s.userId}:${s.total}`).join("|");

  useLayoutEffect(() => {
    const animate = !reduceMotion() && prevTop.current.size > 0;
    const up = new Set<string>();
    scores.forEach((s, i) => {
      const el = rows.current.get(s.userId);
      if (!el) return;
      const top = el.offsetTop;
      const before = prevTop.current.get(s.userId);
      if (animate && before !== undefined && before !== top) {
        el.style.transition = "none";
        el.style.transform = `translateY(${before - top}px)`;
        requestAnimationFrame(() => {
          el.style.transition = "transform 450ms cubic-bezier(.2,.8,.2,1)";
          el.style.transform = "";
        });
      }
      const oldRank = prevRank.current.get(s.userId);
      if (oldRank !== undefined && i < oldRank && s.total > 0) up.add(s.userId);
      const oldTotal = prevTotal.current.get(s.userId);
      const num = totals.current.get(s.userId);
      if (animate && num && oldTotal !== undefined && oldTotal !== s.total) {
        num.animate([{ transform: "scale(1)" }, { transform: "scale(1.35)", color: "#d33d15" }, { transform: "scale(1)" }], {
          duration: 420,
          easing: "ease-out",
        });
      }
      prevTop.current.set(s.userId, top);
      prevRank.current.set(s.userId, i);
      prevTotal.current.set(s.userId, s.total);
    });
    if (up.size === 0) return;
    const show = setTimeout(() => setClimbers(up), 0);
    const hide = setTimeout(() => setClimbers(new Set()), 2600);
    return () => {
      clearTimeout(show);
      clearTimeout(hide);
    };
    // `order` resume posição e total de todo mundo
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order]);

  return (
    <div className="rounded-2xl border border-line bg-white px-4 py-1" data-tour="ranking">
      {scores.map((s, i) => (
        <button
          key={s.userId}
          ref={(el) => {
            if (el) rows.current.set(s.userId, el);
            else rows.current.delete(s.userId);
          }}
          onClick={() => onPick(s.userId)}
          aria-label={`Ver registros de ${s.userId === meId ? "você" : s.name}`}
          className={`relative flex h-11 w-full items-center gap-2.5 bg-white text-left ${i < scores.length - 1 ? "border-b border-[#f0ece6]" : ""}`}
        >
          <span className="w-5 text-[13px] font-bold text-muted">{i + 1}</span>
          <span className="w-16 truncate text-sm font-semibold">{s.userId === meId ? "Você" : s.name}</span>
          <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-[#f0ece6]">
            <div
              className="h-2.5 rounded-full transition-[width] duration-500"
              style={{
                width: `${Math.round((s.total / max) * 100)}%`,
                background: i === 0 && s.total > 0 ? "#d33d15" : s.userId === meId ? "#1a1714" : "#c8bfb4",
              }}
            />
          </div>
          <span className="flex w-12 items-center justify-end gap-0.5">
            {climbers.has(s.userId) && (
              <span aria-label="subiu" className="rank-up text-[11px] font-bold text-[#1e7a3a]">
                ▲
              </span>
            )}
            <span
              ref={(el) => {
                if (el) totals.current.set(s.userId, el);
                else totals.current.delete(s.userId);
              }}
              className="inline-block text-[15px] font-bold"
            >
              {s.total}
            </span>
          </span>
        </button>
      ))}
    </div>
  );
}

/** Card do líder. Quando a liderança muda, pulsa e mostra "Nova liderança!" por alguns segundos. */
export function LeaderCard({
  leader,
  second,
  meId,
  unit,
  gapLabel,
}: {
  leader: Row;
  second?: Row;
  meId: string;
  unit: string;
  gapLabel: (n: number) => string;
}) {
  const card = useRef<HTMLDivElement>(null);
  const prev = useRef<string | null>(null);
  const [fresh, setFresh] = useState(false);

  useEffect(() => {
    const was = prev.current;
    prev.current = leader.userId;
    if (was === null || was === leader.userId) return;
    if (!reduceMotion())
      card.current?.animate(
        [
          { transform: "scale(1)", boxShadow: "0 0 0 0 rgba(245,181,41,0)" },
          { transform: "scale(1.03)", boxShadow: "0 0 0 8px rgba(245,181,41,0.45)" },
          { transform: "scale(1)", boxShadow: "0 0 0 0 rgba(245,181,41,0)" },
        ],
        { duration: 900, easing: "ease-out" },
      );
    const on = setTimeout(() => setFresh(true), 0);
    const off = setTimeout(() => setFresh(false), 3500);
    return () => {
      clearTimeout(on);
      clearTimeout(off);
    };
  }, [leader.userId]);

  const gap = second ? leader.total - second.total : 0;
  return (
    <div ref={card} className="flex items-center gap-4 rounded-[20px] bg-ink px-5 py-4 text-white">
      <Avatar id={leader.userId} name={leader.name} size={56} />
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="text-xs font-bold tracking-wider text-gold uppercase">{fresh ? "Nova liderança!" : "Liderando"}</span>
        <span className="truncate text-lg font-bold">{leader.userId === meId ? "Você" : leader.name}</span>
        {second && gap > 0 && <span className="text-[13px] text-[#d9d3cb]">{gapLabel(gap)} à frente</span>}
        {second && gap === 0 && <span className="text-[13px] text-[#d9d3cb]">Empatado!</span>}
      </div>
      <div className="flex flex-col items-end">
        <span className="font-display text-[40px] leading-none font-extrabold">{leader.total}</span>
        <span className="text-xs text-[#d9d3cb]">{unit}</span>
      </div>
    </div>
  );
}
