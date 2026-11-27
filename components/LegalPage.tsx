import Link from "next/link";
import type { ReactNode } from "react";
import { Wordmark } from "@/components/Logo";

export const CONTACT_INSTAGRAM = "https://instagram.com/rodizium.app";
export const CONTACT_EMAIL = "contato@rodizium.com.br";

/** Moldura simples para as páginas públicas de Privacidade e Termos. */
export function LegalPage({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return (
    <main className="min-h-full bg-cream text-ink">
      <div className="mx-auto flex max-w-2xl flex-col gap-6 px-6 pt-10 pb-16">
        <Link href="/" aria-label="Rodizium">
          <Wordmark className="text-[32px]" />
        </Link>
        <div className="flex flex-col gap-1">
          <h1 className="font-display text-[34px] leading-tight font-extrabold">{title}</h1>
          <span className="text-sm text-muted">Atualizada em {updated}</span>
        </div>
        <div className="flex flex-col gap-5 text-[15px] leading-relaxed [&_a]:font-semibold [&_a]:text-tomato-dark [&_h2]:mt-2 [&_h2]:text-lg [&_h2]:font-bold [&_li]:ml-5 [&_li]:list-disc [&_ul]:flex [&_ul]:flex-col [&_ul]:gap-1.5">
          {children}
        </div>
        <footer className="mt-6 flex gap-4 border-t border-line pt-5 text-sm text-muted">
          <Link href="/privacidade">Privacidade</Link>
          <Link href="/termos">Termos</Link>
          <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
          <a href={CONTACT_INSTAGRAM}>@rodizium.app</a>
        </footer>
      </div>
    </main>
  );
}
