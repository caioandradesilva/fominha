"use client";

import Link from "next/link";
import type { ReactNode } from "react";

const AVATAR_COLORS = ["#C9CED6", "#F5B529", "#E0A77C", "#FBE3DA", "#E3F1E6", "#EFEAE3", "#DCE6F5", "#F3E1EC"];

/** Cor estável para o avatar de cada pessoa, a partir do id. */
export function avatarColor(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

export function Avatar({ id, name, size = 40 }: { id: string; name: string; size?: number }) {
  return (
    <div
      aria-hidden
      className="flex shrink-0 items-center justify-center rounded-full font-bold text-ink"
      style={{ width: size, height: size, background: avatarColor(id), fontSize: size * 0.4 }}
    >
      {name.trim().charAt(0).toUpperCase()}
    </div>
  );
}

/** Coluna central com largura de celular, usada por todas as telas. */
export function Screen({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <main className={`mx-auto flex min-h-full w-full max-w-md flex-col gap-5 px-5 pt-5 pb-10 ${className}`}>
      {children}
    </main>
  );
}

export function BackLink({ href, label = "Voltar" }: { href: string; label?: string }) {
  return (
    <Link
      href={href}
      aria-label={label}
      className="-ml-2.5 flex h-11 w-11 items-center justify-center text-ink"
    >
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="m15 18-6-6 6-6" />
      </svg>
    </Link>
  );
}

export const primaryButton =
  "flex h-13 w-full items-center justify-center rounded-2xl bg-tomato text-base font-semibold text-white disabled:opacity-50";
export const secondaryButton =
  "flex h-12 w-full items-center justify-center rounded-2xl border border-line-strong bg-white text-[15px] font-semibold text-ink disabled:opacity-50";
export const inputClass =
  "h-13 w-full rounded-2xl border border-line-strong bg-white px-4 text-base outline-none focus:border-ink";

/** Compartilha um link: menu nativo do celular quando existe, senão copia. */
export async function shareLink(url: string, text: string): Promise<"shared" | "copied" | "failed"> {
  try {
    if (navigator.share) {
      await navigator.share({ title: "Rodizium", text, url });
      return "shared";
    }
  } catch (e) {
    if ((e as Error).name === "AbortError") return "failed";
  }
  try {
    await navigator.clipboard.writeText(`${text} ${url}`);
    return "copied";
  } catch {
    return "failed";
  }
}

export function StatusPill({ status }: { status: "scheduled" | "live" | "closed" }) {
  if (status === "live")
    return (
      <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-tomato-soft px-2.5 py-1 text-[11px] font-bold text-tomato-dark">
        <span className="h-2 w-2 rounded-full bg-tomato" />
        AO VIVO
      </span>
    );
  return (
    <span className="shrink-0 rounded-full bg-chip px-2.5 py-1 text-[11px] font-bold text-[#4a443e]">
      {status === "closed" ? "ENCERRADO" : "MARCADO"}
    </span>
  );
}
