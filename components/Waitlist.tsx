"use client";

import { useState, type FormEvent } from "react";
import { PlateMark, Wordmark } from "@/components/Logo";
import { inputClass } from "@/components/ui";
import { getSupabase } from "@/lib/supabase/client";

const RODIZIOS = ["Sushi", "Pizza", "Churrasco", "Hambúrguer"];
const INSTAGRAM = "https://instagram.com/rodizium";

const STEPS = [
  {
    title: "Aponta. A IA conta.",
    text: "Tira foto do prato e ela reconhece uramaki, nigiri, hot roll e conta peça por peça.",
    icon: (
      <>
        <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
        <circle cx="12" cy="13" r="3" />
      </>
    ),
  },
  {
    title: "Seu nome no topo",
    text: "Cada prato soma no placar do grupo. Passar o amigo no ranking tem outro gosto.",
    icon: <path d="M3 3v18h18M7 16v-4M12 16V8M17 16v-7" />,
  },
  {
    title: "Coroa e glória",
    text: "No fim sai o pódio. O campeão leva a coroa e o direito de lembrar todo mundo disso.",
    icon: <path d="M2 18 4 7l5 4 3-6 3 6 5-4 2 11z" />,
  },
];

const PERSONAS = [
  { name: "O Saco sem Fundo", text: "Passa das 40 peças e ainda pergunta se tem sobremesa." },
  { name: "O Estrategista", text: "Só sashimi. Arroz é para os fracos." },
  { name: "O Arranque", text: "Come 25 no primeiro prato e pede a conta no segundo." },
  { name: "O Maratonista", text: "Devagar e sempre. Quando você vê, ele está no topo." },
];

type Status = "idle" | "sending" | "done" | "already" | "error";

/** Aceita e-mail ou celular brasileiro (com DDD). Devolve o contato normalizado ou null. */
function normalizeContact(raw: string): string | null {
  const value = raw.trim();
  if (value.includes("@")) return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? value.toLowerCase() : null;
  const digits = value.replace(/\D/g, "");
  if (digits.length >= 10 && digits.length <= 13) return digits;
  return null;
}

export function Waitlist() {
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [city, setCity] = useState("");
  const [picked, setPicked] = useState<string[]>(["Sushi"]);
  const [trap, setTrap] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  function toggle(r: string) {
    setPicked((list) => (list.includes(r) ? list.filter((x) => x !== r) : [...list, r]));
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (trap) {
      setStatus("done"); // robô preencheu o campo escondido
      return;
    }
    const cleanName = name.trim();
    const cleanContact = normalizeContact(contact);
    if (!cleanName) return setError("Como a gente te chama?");
    if (!cleanContact) return setError("Coloca um e-mail ou WhatsApp com DDD.");

    setStatus("sending");
    const params = new URLSearchParams(window.location.search);
    const source = (params.get("ref") || params.get("utm_source") || "direto").slice(0, 40);
    const { error: insertError } = await getSupabase()
      .from("waitlist")
      .insert({ name: cleanName.slice(0, 60), contact: cleanContact, city: city.trim().slice(0, 60) || null, rodizios: picked, source });

    if (!insertError) setStatus("done");
    else if (insertError.code === "23505") setStatus("already");
    else {
      setStatus("error");
      setError("Não deu para salvar agora. Tenta de novo em instantes.");
    }
  }

  const finished = status === "done" || status === "already";

  return (
    <div className="flex min-h-full flex-col bg-cream text-ink">
      {/* Topo */}
      <section className="relative overflow-hidden bg-tomato text-white">
        <div aria-hidden className="pointer-events-none absolute -right-28 -bottom-24 opacity-15 sm:-right-16">
          <PlateMark size={420} plate="#ffffff" rim="#d33d15" />
        </div>
        <div className="relative mx-auto flex max-w-5xl flex-col gap-7 px-6 pt-8 pb-16 sm:pt-10 sm:pb-24">
          <Wordmark className="text-[34px]" plate="#ffffff" rim="#d33d15" />
          <span className="mt-6 self-start rounded-full bg-gold px-4 py-2 text-xs font-bold tracking-wider text-ink">
            LISTA DE ESPERA ABERTA
          </span>
          <h1 className="font-display max-w-3xl text-[52px] leading-[0.95] font-extrabold tracking-tight sm:text-[84px]">
            Rodízio agora tem placar.
          </h1>
          <p className="max-w-xl text-lg leading-relaxed text-tomato-soft sm:text-xl">
            Chega de “comi uns 50”. Tira foto do prato, a IA conta as peças e o ranking mostra quem mandou melhor. Agora dá para provar.
          </p>
          <a
            href="#lista"
            className="flex h-14 items-center justify-center gap-2 self-stretch rounded-2xl bg-ink px-8 text-base font-semibold text-white sm:self-start"
          >
            Quero entrar na lista
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M12 5v14M6 13l6 6 6-6" />
            </svg>
          </a>
        </div>
      </section>

      {/* Como funciona */}
      <section className="mx-auto w-full max-w-5xl px-6 py-14 sm:py-20">
        <span className="text-xs font-bold tracking-widest text-tomato-dark">COMO FUNCIONA</span>
        <h2 className="font-display mt-3 text-4xl leading-none font-extrabold tracking-tight sm:text-5xl">
          Três passos e a discussão acaba.
        </h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {STEPS.map((s, i) => (
            <div key={s.title} className="flex flex-col gap-3 rounded-3xl border border-line bg-white p-6">
              <div className="flex items-center justify-between">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-gold">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#1a1714" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    {s.icon}
                  </svg>
                </span>
                <span className="font-display text-3xl font-extrabold text-line-strong">{i + 1}</span>
              </div>
              <h3 className="font-display text-2xl leading-tight font-extrabold">{s.title}</h3>
              <p className="text-[15px] leading-relaxed text-muted">{s.text}</p>
            </div>
          ))}
        </div>
        <div className="mt-6 flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-muted">Funciona em qualquer rodízio:</span>
          {RODIZIOS.map((r) => (
            <span key={r} className="rounded-full bg-chip px-3 py-1.5 text-sm font-semibold">
              {r}
            </span>
          ))}
        </div>
      </section>

      {/* Personas */}
      <section className="bg-ink text-white">
        <div className="mx-auto w-full max-w-5xl px-6 py-14 sm:py-20">
          <h2 className="font-display text-4xl leading-none font-extrabold tracking-tight sm:text-5xl">
            Qual desses é você no rodízio?
          </h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {PERSONAS.map((p) => (
              <div key={p.name} className="rounded-3xl bg-white/[0.07] p-6">
                <h3 className="font-display text-2xl font-extrabold text-gold">{p.name}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-white/80">{p.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Formulário */}
      <section id="lista" className="mx-auto w-full max-w-xl scroll-mt-4 px-6 py-14 sm:py-20">
        {finished ? (
          <div className="flex flex-col items-center gap-4 rounded-3xl bg-white p-8 text-center shadow-[0_1px_0_#e7e2db]">
            <PlateMark size={88} plate="#d33d15" rim="#faf8f5" />
            <h2 className="font-display text-4xl leading-none font-extrabold">
              {status === "already" ? "Você já está na lista!" : "Você está na lista!"}
            </h2>
            <p className="text-base leading-relaxed text-muted">
              Avisamos assim que o Rodizium liberar. Enquanto isso, chama o grupo do rodízio: quanto mais gente, mais cedo vocês entram.
            </p>
            <a href={INSTAGRAM} className="flex h-13 w-full items-center justify-center rounded-2xl bg-tomato text-base font-semibold text-white">
              Seguir @rodizium
            </a>
          </div>
        ) : (
          <form onSubmit={submit} noValidate className="flex flex-col gap-5">
            <div>
              <span className="text-xs font-bold tracking-widest text-tomato-dark">LISTA DE ESPERA</span>
              <h2 className="font-display mt-3 text-4xl leading-none font-extrabold tracking-tight sm:text-5xl">
                Seja dos primeiros a desafiar seus amigos.
              </h2>
            </div>

            <label className="flex flex-col gap-2">
              <span className="text-sm font-semibold">Seu nome</span>
              <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} autoComplete="given-name" maxLength={60} placeholder="Como te chamam no grupo" />
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-sm font-semibold">E-mail ou WhatsApp</span>
              <input className={inputClass} value={contact} onChange={(e) => setContact(e.target.value)} autoComplete="email" maxLength={120} placeholder="voce@email.com ou (48) 99999-9999" />
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-sm font-semibold">
                Cidade <span className="font-normal text-muted">(opcional)</span>
              </span>
              <input className={inputClass} value={city} onChange={(e) => setCity(e.target.value)} autoComplete="address-level2" maxLength={60} placeholder="Florianópolis" />
            </label>

            <fieldset className="flex flex-col gap-2">
              <legend className="mb-2 text-sm font-semibold">Seus rodízios</legend>
              <div className="flex flex-wrap gap-2">
                {RODIZIOS.map((r) => {
                  const on = picked.includes(r);
                  return (
                    <button
                      key={r}
                      type="button"
                      onClick={() => toggle(r)}
                      aria-pressed={on}
                      className={`h-11 rounded-full border px-4 text-[15px] font-semibold ${on ? "border-ink bg-ink text-white" : "border-line-strong bg-white text-ink"}`}
                    >
                      {r}
                    </button>
                  );
                })}
              </div>
            </fieldset>

            {/* Campo escondido contra robôs */}
            <input type="text" tabIndex={-1} autoComplete="off" aria-hidden value={trap} onChange={(e) => setTrap(e.target.value)} className="absolute -left-[9999px] h-0 w-0 opacity-0" />

            {error && (
              <p role="alert" className="rounded-2xl bg-tomato-soft px-4 py-3 text-sm font-semibold text-tomato-dark">
                {error}
              </p>
            )}

            <button type="submit" disabled={status === "sending"} className="flex h-14 w-full items-center justify-center rounded-2xl bg-tomato text-base font-semibold text-white disabled:opacity-60">
              {status === "sending" ? "Salvando…" : "Entrar na lista de espera"}
            </button>
            <p className="text-center text-xs leading-relaxed text-muted">Só usamos seu contato para avisar do lançamento. Nada de spam.</p>
          </form>
        )}
      </section>

      <footer className="mt-auto border-t border-line">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-6 text-sm text-muted">
          <span>© 2026 Rodizium</span>
          <a href={INSTAGRAM} className="font-semibold text-ink">
            @rodizium
          </a>
        </div>
      </footer>
    </div>
  );
}
