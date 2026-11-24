"use client";

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { PlateMark, Wordmark } from "@/components/Logo";
import { getSupabase } from "@/lib/supabase/client";

const INSTAGRAM = "https://instagram.com/rodizium";
const RODIZIOS = ["Sushi", "Pizza", "Churrasco", "Hambúrguer"];

/* ---------- Prato interativo do topo ---------- */

type Piece = { kind: "uramaki" | "nigiri"; x: number; y: number; r?: number };
const PIECES: Piece[] = [
  { kind: "uramaki", x: 35, y: 31 },
  { kind: "uramaki", x: 52, y: 27 },
  { kind: "uramaki", x: 68, y: 33 },
  { kind: "uramaki", x: 29, y: 49 },
  { kind: "uramaki", x: 46, y: 46 },
  { kind: "uramaki", x: 26, y: 66 },
  { kind: "nigiri", x: 70, y: 53, r: -22 },
  { kind: "nigiri", x: 44, y: 66, r: 8 },
  { kind: "nigiri", x: 63, y: 73, r: -6 },
];

function PieceArt({ kind }: { kind: Piece["kind"] }) {
  if (kind === "uramaki") {
    return (
      <span className="block h-full w-full rounded-full border-[5px] border-[#2f3a2c] bg-[#f7f3ec] p-[22%] shadow-[0_3px_0_rgba(0,0,0,0.12)]">
        <span className="block h-full w-full rounded-full bg-[#f08a5d]" />
      </span>
    );
  }
  return (
    <span className="relative block h-full w-full rounded-full bg-[#f7f3ec] shadow-[0_3px_0_rgba(0,0,0,0.12)]">
      <span className="nigiri-fish absolute inset-x-[4%] -top-[14%] bottom-[30%] rounded-[45%] bg-[#f08a5d]" />
    </span>
  );
}

function PlateGame({ onFirstBite }: { onFirstBite: () => void }) {
  const [eaten, setEaten] = useState<Set<number>>(new Set());
  const [you, setYou] = useState(0);
  const [rival, setRival] = useState(0);
  const [started, setStarted] = useState(false);
  const [round, setRound] = useState(0);

  // O "Rafa" vai comendo sozinho depois da primeira mordida
  useEffect(() => {
    if (!started) return;
    const id = setInterval(() => setRival((r) => (r < 60 ? r + 1 : r)), 2300);
    return () => clearInterval(id);
  }, [started]);

  function bite(i: number) {
    if (eaten.has(i)) return;
    if (!started) {
      setStarted(true);
      onFirstBite();
    }
    setEaten((s) => new Set(s).add(i));
    setYou((n) => n + 1);
  }

  function refill() {
    setEaten(new Set());
    setRound((r) => r + 1);
  }

  const cleared = eaten.size === PIECES.length;
  const leading = you >= rival;

  return (
    <div className="relative flex flex-col gap-4">
      {/* Placar */}
      <div className="flex items-stretch gap-2" aria-live="polite">
        <div className={`flex flex-1 items-center justify-between rounded-2xl px-4 py-3 transition-colors ${leading ? "bg-ink text-white" : "bg-white text-ink"}`}>
          <span className="flex items-center gap-2 text-sm font-semibold">
            {leading && started && <Crown className="h-4 w-4" />}
            Você
          </span>
          <span key={you} className="font-display tabular text-3xl font-extrabold motion-safe:animate-[pop_220ms_ease-out]">
            {String(you).padStart(2, "0")}
          </span>
        </div>
        <div className={`flex flex-1 items-center justify-between rounded-2xl px-4 py-3 transition-colors ${!leading ? "bg-ink text-white" : "bg-white text-ink"}`}>
          <span className="flex items-center gap-2 text-sm font-semibold">
            {!leading && <Crown className="h-4 w-4" />}
            Rafa
          </span>
          <span className="font-display tabular text-3xl font-extrabold">{String(rival).padStart(2, "0")}</span>
        </div>
      </div>

      {/* Prato */}
      <div className="relative aspect-square w-full">
        <div className="absolute inset-[4%] rounded-full bg-[#ede7de] shadow-[inset_0_0_0_14px_#e2dace,0_18px_40px_-18px_rgba(26,23,20,0.45)]" />
        <div className="absolute inset-[17%] rounded-full border-2 border-[#e2dace]" />
        <span aria-hidden className="absolute top-[74%] left-[73%] h-[9%] w-[12%] rounded-[40%] bg-[#f3b8a3]" />
        <span aria-hidden className="absolute top-[18%] left-[22%] h-[6%] w-[8%] rounded-full bg-[#9bbf5a]" />
        {PIECES.map((p, i) => {
          const gone = eaten.has(i);
          const size = p.kind === "uramaki" ? { w: 15, h: 15 } : { w: 22, h: 11 };
          return (
            <button
              key={`${round}-${i}`}
              type="button"
              onClick={() => bite(i)}
              disabled={gone}
              aria-label={`Comer ${p.kind}`}
              className="absolute cursor-pointer transition-[transform,opacity] duration-300 ease-out hover:scale-110 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink disabled:cursor-default motion-safe:animate-[drop_420ms_ease-out_both]"
              style={{
                left: `${p.x - size.w / 2}%`,
                top: `${p.y - size.h / 2}%`,
                width: `${size.w}%`,
                height: `${size.h}%`,
                transform: `rotate(${p.r ?? 0}deg) scale(${gone ? 0 : 1})`,
                opacity: gone ? 0 : 1,
                animationDelay: `${i * 45}ms`,
              }}
            >
              <PieceArt kind={p.kind} />
            </button>
          );
        })}

        {!started && (
          <span className="pointer-events-none absolute bottom-[3%] left-1/2 -translate-x-1/2 rounded-full bg-ink px-4 py-2 text-sm font-semibold whitespace-nowrap text-white shadow-lg motion-safe:animate-bounce">
            Toca nas peças
          </span>
        )}

        {cleared && (
          <div className="absolute inset-[18%] flex flex-col items-center justify-center gap-3 rounded-full text-center">
            <span className="font-display text-2xl leading-tight font-extrabold">Limpou o prato.</span>
            <button type="button" onClick={refill} className="h-11 rounded-full bg-tomato px-5 text-sm font-semibold text-white">
              Pedir mais
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Crown({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 34 26" className={className} fill="#f5b529" stroke="#b9831a" strokeWidth="1.5" strokeLinejoin="round" aria-hidden>
      <path d="M3 22 1 6l9 7 7-11 7 11 9-7-2 16z" />
    </svg>
  );
}

/* ---------- Celular de "como funciona" ---------- */

const STEPS = [
  { n: "01", title: "Aponta. A IA conta.", text: "Tira foto do prato. Ela reconhece uramaki, nigiri, hot roll e soma peça por peça." },
  { n: "02", title: "Seu nome sobe", text: "Cada prato entra no placar do grupo. Passar o amigo no ranking tem outro gosto." },
  { n: "03", title: "Coroa e glória", text: "No fim sai o pódio. O campeão leva a coroa e o direito de lembrar todo mundo." },
];

function ScreenCount() {
  const dots = [
    [22, 30, "u"], [38, 26, "u"], [54, 30, "u"], [20, 50, "u"], [36, 48, "u"], [52, 52, "u"],
    [68, 40, "n"], [30, 68, "n"], [50, 70, "n"], [68, 62, "n"],
  ] as const;
  return (
    <div className="flex h-full flex-col">
      <div className="relative h-[52%] bg-[#2a2622]">
        <div className="absolute top-[12%] left-[10%] aspect-square w-[80%] rounded-full bg-[#ede7de] shadow-[inset_0_0_0_10px_#e2dace]" />
        {dots.map(([x, y, k], i) => (
          <span key={i} className="absolute" style={{ left: `${x}%`, top: `${y}%`, width: "13%", aspectRatio: "1" }}>
            <span className={`absolute inset-[12%] ${k === "u" ? "rounded-full border-[3px] border-[#2f3a2c] bg-[#f7f3ec]" : "rounded-[40%] bg-[#f08a5d]"}`} />
            <span className="absolute inset-0 rounded-md border-2 border-gold motion-safe:animate-[scan_600ms_ease-out_both]" style={{ animationDelay: `${150 + i * 70}ms` }} />
          </span>
        ))}
      </div>
      <div className="-mt-4 flex flex-1 flex-col items-center gap-2 rounded-t-3xl bg-cream px-4 pt-4 pb-4">
        <div className="flex w-full items-center justify-between">
          <span className="text-[11px] font-semibold text-muted">A IA contou</span>
          <span className="rounded-full bg-ok-soft px-2 py-0.5 text-[10px] font-bold text-ok">Confiança alta</span>
        </div>
        <span className="font-display text-5xl leading-none font-extrabold">10</span>
        <span className="text-[11px] text-muted">6 uramaki · 4 nigiri</span>
        <span className="mt-auto flex h-9 w-full items-center justify-center rounded-xl bg-tomato text-xs font-semibold text-white">Confirmar</span>
      </div>
    </div>
  );
}

function ScreenBoard() {
  const rows: [string, number][] = [["Você", 39], ["Rafa", 33], ["Bia", 30], ["Léo", 27], ["Duda", 24], ["Gui", 22]];
  return (
    <div className="flex h-full flex-col gap-3 px-4 pt-6">
      <div className="flex items-center justify-between">
        <span className="font-display text-base font-extrabold">Sushi da galera</span>
        <span className="flex items-center gap-1 rounded-full bg-tomato-soft px-2 py-0.5 text-[9px] font-bold text-tomato-dark">
          <span className="h-1.5 w-1.5 rounded-full bg-tomato motion-safe:animate-pulse" />
          AO VIVO
        </span>
      </div>
      <div className="flex items-center gap-3 rounded-2xl bg-ink p-3 text-white">
        <span className="h-9 w-9 rounded-full bg-gold" />
        <span className="flex flex-1 flex-col">
          <span className="text-[9px] font-bold tracking-wider text-gold">LIDERANDO</span>
          <span className="text-sm font-bold">Você</span>
        </span>
        <span className="font-display text-3xl font-extrabold">39</span>
      </div>
      <div className="rounded-xl border border-line bg-white px-3 py-1">
        {rows.map(([name, n], i) => (
          <div key={name} className={`flex h-8 items-center gap-2 ${i < rows.length - 1 ? "border-b border-[#f0ece6]" : ""}`}>
            <span className="w-3 text-[10px] font-bold text-muted">{i + 1}</span>
            <span className="w-9 text-[11px] font-semibold">{name}</span>
            <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#f0ece6]">
              <span
                className={`block h-full rounded-full motion-safe:animate-[grow_700ms_ease-out_both] ${i === 0 ? "bg-tomato" : "bg-[#c8bfb4]"}`}
                style={{ width: `${Math.round((n / 39) * 100)}%`, animationDelay: `${i * 80}ms` }}
              />
            </span>
            <span className="w-5 text-right text-[11px] font-bold">{n}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ScreenPodium() {
  const cols = [
    { h: "44%", n: 41, pos: "2º", bg: "bg-line", dot: "bg-[#c9ced6]" },
    { h: "60%", n: 47, pos: "1º", bg: "bg-tomato text-white", dot: "bg-gold" },
    { h: "34%", n: 38, pos: "3º", bg: "bg-line", dot: "bg-[#e0a77c]" },
  ];
  return (
    <div className="flex h-full flex-col items-center px-4 pt-8 pb-0 text-center">
      <span className="text-[10px] font-bold tracking-widest text-tomato-dark">CAMPEÃO DA NOITE</span>
      <span className="font-display mt-1 text-3xl leading-none font-extrabold">Você</span>
      <span className="mt-1 text-[11px] text-muted">47 peças · 6 a mais que o Rafa</span>
      <div className="mt-4 flex w-full flex-1 items-end justify-center gap-2">
        {cols.map((c, i) => (
          <div key={i} className="flex w-[30%] flex-col items-center gap-1.5" style={{ height: "100%" }}>
            <div className="mt-auto flex flex-col items-center gap-1">
              {i === 1 && <Crown className="h-4 w-5" />}
              <span className={`h-8 w-8 rounded-full ${c.dot}`} />
            </div>
            <div
              className={`flex w-full flex-col items-center justify-center rounded-t-xl motion-safe:animate-[rise_600ms_ease-out_both] ${c.bg}`}
              style={{ height: c.h, animationDelay: `${[150, 0, 300][i]}ms` }}
            >
              <span className="font-display text-xl font-extrabold">{c.n}</span>
              <span className="text-[9px] opacity-80">{c.pos}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Phone({ children }: { children: ReactNode }) {
  return (
    <div className="relative mx-auto aspect-[280/570] w-[260px] rounded-[44px] bg-ink p-2.5 shadow-[0_40px_80px_-30px_rgba(26,23,20,0.5)] sm:w-[280px]">
      <div className="absolute top-4 left-1/2 z-10 h-5 w-20 -translate-x-1/2 rounded-full bg-ink" />
      <div className="h-full w-full overflow-hidden rounded-[36px] bg-cream">{children}</div>
    </div>
  );
}

function HowItWorks() {
  const [step, setStep] = useState(0);
  const [auto, setAuto] = useState(true);

  useEffect(() => {
    if (!auto) return;
    const id = setInterval(() => setStep((s) => (s + 1) % STEPS.length), 4500);
    return () => clearInterval(id);
  }, [auto]);

  const screens = [<ScreenCount key="c" />, <ScreenBoard key="b" />, <ScreenPodium key="p" />];

  return (
    <section className="mx-auto grid w-full max-w-6xl items-center gap-12 px-6 py-20 md:grid-cols-[1fr_auto] md:gap-20 md:py-28">
      <div>
        <h2 className="font-display max-w-lg text-[44px] leading-[0.95] font-extrabold tracking-tight md:text-6xl">
          Do prato ao pódio em três toques.
        </h2>
        <div className="mt-10 flex flex-col" role="tablist" aria-label="Como funciona">
          {STEPS.map((s, i) => {
            const on = i === step;
            return (
              <button
                key={s.n}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => {
                  setStep(i);
                  setAuto(false);
                }}
                className="group relative flex gap-5 border-t border-line py-5 text-left last:border-b"
              >
                <span className={`font-display text-sm font-extrabold transition-colors ${on ? "text-tomato" : "text-line-strong"}`}>{s.n}</span>
                <span className="flex flex-col gap-1.5">
                  <span className={`font-display text-2xl leading-tight font-extrabold transition-colors md:text-[28px] ${on ? "text-ink" : "text-[#b3aaa0] group-hover:text-muted"}`}>
                    {s.title}
                  </span>
                  <span
                    className={`grid text-[15px] leading-relaxed text-muted transition-[grid-template-rows,opacity] duration-300 ${on ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}
                  >
                    <span className="overflow-hidden">{s.text}</span>
                  </span>
                </span>
                {on && auto && (
                  <span key={step} className="absolute -top-px left-0 h-0.5 bg-tomato motion-safe:animate-[progress_4500ms_linear_both]" />
                )}
              </button>
            );
          })}
        </div>
      </div>
      <Phone>
        <div key={step} className="h-full motion-safe:animate-[fade_350ms_ease-out_both]">
          {screens[step]}
        </div>
      </Phone>
    </section>
  );
}

/* ---------- Slider do recorde ---------- */

function personaFor(n: number) {
  if (n < 15) return { name: "O Estrategista", text: "Pouca peça, muita escolha. Só sashimi, arroz é para os fracos." };
  if (n < 30) return { name: "O Arranque", text: "Começa a mil no primeiro prato e pede a conta no segundo." };
  if (n < 45) return { name: "O Maratonista", text: "Devagar e sempre. Quando o grupo vê, você está no topo." };
  return { name: "O Saco sem Fundo", text: "Passa das 45 e ainda pergunta se tem sobremesa." };
}

/* ---------- Página ---------- */

type Status = "idle" | "sending" | "done" | "already" | "error";

function normalizeContact(raw: string): string | null {
  const value = raw.trim();
  if (value.includes("@")) return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? value.toLowerCase() : null;
  const digits = value.replace(/\D/g, "");
  return digits.length >= 10 && digits.length <= 13 ? digits : null;
}

export function Landing() {
  const [record, setRecord] = useState(30);
  const [recordTouched, setRecordTouched] = useState(false);
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [city, setCity] = useState("");
  const [picked, setPicked] = useState<string[]>(["Sushi"]);
  const [trap, setTrap] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [bitten, setBitten] = useState(false);
  const formRef = useRef<HTMLElement>(null);

  const persona = personaFor(record);

  function goToForm() {
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (trap) return setStatus("done");
    const cleanName = name.trim();
    const cleanContact = normalizeContact(contact);
    if (!cleanName) return setError("Como a gente te chama?");
    if (!cleanContact) return setError("Coloca um e-mail ou WhatsApp com DDD.");

    setStatus("sending");
    const params = new URLSearchParams(window.location.search);
    const source = (params.get("ref") || params.get("utm_source") || "direto").slice(0, 40);
    const { error: insertError } = await getSupabase()
      .from("waitlist")
      .insert({
        name: cleanName.slice(0, 60),
        contact: cleanContact,
        city: city.trim().slice(0, 60) || null,
        rodizios: picked,
        claimed_record: recordTouched ? record : null,
        source,
      });
    if (!insertError) setStatus("done");
    else if (insertError.code === "23505") setStatus("already");
    else {
      setStatus("error");
      setError("Não deu para salvar agora. Tenta de novo em instantes.");
    }
  }

  const finished = status === "done" || status === "already";
  const field =
    "h-13 w-full rounded-2xl border border-line-strong bg-white px-4 text-base text-ink outline-none placeholder:text-[#a39a8f] focus:border-ink";

  return (
    <div className="min-h-full bg-cream text-ink">
      {/* Topo */}
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <Wordmark className="text-[30px]" plate="#d33d15" rim="#faf8f5" />
        <button type="button" onClick={goToForm} className="h-11 rounded-full bg-ink px-5 text-sm font-semibold text-white">
          Entrar na lista
        </button>
      </header>

      <section className="mx-auto grid max-w-6xl items-center gap-12 px-6 pt-6 pb-20 md:grid-cols-[1.15fr_1fr] md:gap-16 md:pt-12 md:pb-28">
        <div className="flex flex-col gap-7">
          <span className="flex items-center gap-2 self-start rounded-full border border-line-strong bg-white px-3.5 py-1.5 text-xs font-bold tracking-wide">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full rounded-full bg-tomato opacity-75 motion-safe:animate-ping" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-tomato" />
            </span>
            LISTA DE ESPERA ABERTA
          </span>
          <h1 className="font-display text-[54px] leading-[0.92] font-extrabold tracking-[-0.03em] sm:text-7xl lg:text-[88px]">
            Quantas peças você{" "}
            <span className="relative inline-block text-tomato">
              realmente
              <svg viewBox="0 0 300 20" preserveAspectRatio="none" className="absolute -bottom-2 left-0 h-3 w-full" aria-hidden>
                <path d="M3 14c40-9 90-12 150-8s100 6 144-2" fill="none" stroke="#f5b529" strokeWidth="6" strokeLinecap="round" />
              </svg>
            </span>{" "}
            aguenta?
          </h1>
          <p className="max-w-md text-lg leading-relaxed text-[#4a443e]">
            Tira foto do prato, a IA conta as peças e o ranking do grupo decide quem manda no rodízio. Acabou o “comi uns 50”.
          </p>
          <div className="flex flex-wrap items-center gap-4">
            <button type="button" onClick={goToForm} className="h-14 rounded-2xl bg-tomato px-7 text-base font-semibold text-white transition-transform hover:-translate-y-0.5">
              Quero entrar na lista
            </button>
            <span className="text-sm text-muted">Grátis. A gente só avisa quando liberar.</span>
          </div>
        </div>

        <div className="mx-auto w-full max-w-[440px]">
          <PlateGame onFirstBite={() => setBitten(true)} />
          <p className="mt-3 text-center text-sm text-muted">
            {bitten ? "Viu? No Rodizium a câmera conta por você." : "Experimenta: come umas peças antes que o Rafa coma tudo."}
          </p>
        </div>
      </section>

      {/* Faixa */}
      <div className="overflow-hidden bg-ink py-5 text-white" aria-hidden>
        <div className="flex w-max motion-safe:animate-[marquee_28s_linear_infinite]">
          {[0, 1].map((k) => (
            <div key={k} className="flex shrink-0 items-center">
              {["Sushi", "Pizza", "Churrasco", "Hambúrguer", "Sushi", "Pizza", "Churrasco", "Hambúrguer"].map((t, i) => (
                <span key={i} className="font-display flex items-center gap-8 pr-8 text-3xl font-extrabold tracking-tight md:text-4xl">
                  {t}
                  <PlateMark size={26} plate="#f5b529" rim="#1a1714" />
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>

      <HowItWorks />

      {/* Recorde */}
      <section className="bg-tomato text-white">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-6 py-20 md:grid-cols-2 md:gap-16 md:py-28">
          <div className="flex flex-col gap-5">
            <h2 className="font-display text-[44px] leading-[0.95] font-extrabold tracking-tight md:text-6xl">Seja sincero. Qual é o seu recorde?</h2>
            <p className="max-w-md text-lg leading-relaxed text-tomato-soft">
              Arrasta e descobre que tipo de comedor de rodízio você é. Depois a gente confere na mesa.
            </p>
          </div>
          <div className="rounded-[32px] bg-[#b8340f] p-7 md:p-9">
            <div className="flex items-end justify-between gap-4">
              <span className="font-display tabular text-[112px] leading-[0.8] font-extrabold tracking-tight md:text-[140px]">{record}</span>
              <span className="pb-2 text-right text-sm font-semibold text-tomato-soft">peças numa noite{record >= 80 ? "+" : ""}</span>
            </div>
            <label htmlFor="record" className="sr-only">
              Seu recorde de peças num rodízio
            </label>
            <input
              id="record"
              type="range"
              min={0}
              max={80}
              value={record}
              onChange={(e) => {
                setRecord(Number(e.target.value));
                setRecordTouched(true);
              }}
              className="record-range mt-6 w-full"
              style={{ ["--fill" as string]: `${(record / 80) * 100}%` }}
            />
            <div className="mt-7 rounded-2xl bg-white p-5 text-ink">
              <span className="text-xs font-bold tracking-widest text-tomato-dark">VOCÊ É</span>
              <p key={persona.name} className="font-display mt-1 text-3xl font-extrabold motion-safe:animate-[fade_300ms_ease-out_both]">
                {persona.name}
              </p>
              <p className="mt-1 text-[15px] leading-relaxed text-muted">{persona.text}</p>
            </div>
            <button
              type="button"
              onClick={() => {
                setRecordTouched(true);
                goToForm();
              }}
              className="mt-5 flex h-13 w-full items-center justify-center rounded-2xl bg-ink text-base font-semibold text-white"
            >
              Guardar meu recorde na lista
            </button>
          </div>
        </div>
      </section>

      {/* Formulário */}
      <section ref={formRef} id="lista" className="scroll-mt-2 bg-ink text-white">
        <div className="mx-auto grid max-w-6xl gap-12 px-6 py-20 md:grid-cols-[1fr_1.1fr] md:gap-20 md:py-28">
          <div className="flex flex-col gap-5">
            <h2 className="font-display text-[44px] leading-[0.95] font-extrabold tracking-tight md:text-6xl">Quem entra primeiro, desafia primeiro.</h2>
            <p className="max-w-md text-lg leading-relaxed text-[#d8d1c8]">
              O Rodizium está em teste fechado com um grupo de amigos. Entra na lista e você é dos primeiros a usar no seu rodízio.
            </p>
          </div>

          {finished ? (
            <div className="flex flex-col items-start gap-4 rounded-[32px] bg-white p-8 text-ink motion-safe:animate-[fade_400ms_ease-out_both]">
              <PlateMark size={72} plate="#d33d15" rim="#ffffff" />
              <h3 className="font-display text-4xl leading-none font-extrabold">{status === "already" ? "Você já estava na lista." : "Tá na lista!"}</h3>
              <p className="text-base leading-relaxed text-muted">
                {recordTouched
                  ? `Anotamos seus ${record} peças. Quando liberar, você prova na mesa.`
                  : "Avisamos assim que o Rodizium liberar."}{" "}
                Manda o link pro grupo do rodízio: a disputa só tem graça com todo mundo.
              </p>
              <a href={INSTAGRAM} className="mt-2 flex h-13 w-full items-center justify-center rounded-2xl bg-tomato text-base font-semibold text-white">
                Seguir @rodizium
              </a>
            </div>
          ) : (
            <form onSubmit={submit} noValidate className="flex flex-col gap-4 rounded-[32px] bg-white p-6 text-ink md:p-8">
              <label className="flex flex-col gap-2">
                <span className="text-sm font-semibold">Seu nome</span>
                <input className={field} value={name} onChange={(e) => setName(e.target.value)} autoComplete="given-name" maxLength={60} placeholder="Como te chamam no grupo" />
              </label>
              <label className="flex flex-col gap-2">
                <span className="text-sm font-semibold">E-mail ou WhatsApp</span>
                <input className={field} value={contact} onChange={(e) => setContact(e.target.value)} autoComplete="email" maxLength={120} placeholder="e-mail ou (48) 99999-9999" />
              </label>
              <label className="flex flex-col gap-2">
                <span className="text-sm font-semibold">
                  Cidade <span className="font-normal text-muted">(opcional)</span>
                </span>
                <input className={field} value={city} onChange={(e) => setCity(e.target.value)} autoComplete="address-level2" maxLength={60} placeholder="Florianópolis" />
              </label>
              <fieldset>
                <legend className="mb-2 text-sm font-semibold">Seus rodízios</legend>
                <div className="flex flex-wrap gap-2">
                  {RODIZIOS.map((r) => {
                    const on = picked.includes(r);
                    return (
                      <button
                        key={r}
                        type="button"
                        aria-pressed={on}
                        onClick={() => setPicked((l) => (on ? l.filter((x) => x !== r) : [...l, r]))}
                        className={`h-11 rounded-full border px-4 text-[15px] font-semibold transition-colors ${on ? "border-ink bg-ink text-white" : "border-line-strong bg-white"}`}
                      >
                        {r}
                      </button>
                    );
                  })}
                </div>
              </fieldset>
              {recordTouched && (
                <p className="flex items-center justify-between rounded-2xl bg-gold-soft px-4 py-3 text-sm">
                  <span>
                    Seu recorde: <strong>{record} peças</strong> · {persona.name}
                  </span>
                  <button type="button" onClick={() => setRecordTouched(false)} className="text-sm font-semibold text-muted underline">
                    Tirar
                  </button>
                </p>
              )}
              <input type="text" tabIndex={-1} autoComplete="off" aria-hidden value={trap} onChange={(e) => setTrap(e.target.value)} className="absolute -left-[9999px] h-0 w-0 opacity-0" />
              {error && (
                <p role="alert" className="rounded-2xl bg-tomato-soft px-4 py-3 text-sm font-semibold text-tomato-dark">
                  {error}
                </p>
              )}
              <button type="submit" disabled={status === "sending"} className="mt-1 flex h-14 w-full items-center justify-center rounded-2xl bg-tomato text-base font-semibold text-white disabled:opacity-60">
                {status === "sending" ? "Salvando…" : "Entrar na lista de espera"}
              </button>
              <p className="text-center text-xs text-muted">Só usamos seu contato para avisar do lançamento.</p>
            </form>
          )}
        </div>
      </section>

      <footer className="bg-ink text-[#a39a8f]">
        <div className="mx-auto flex max-w-6xl items-center justify-between border-t border-white/10 px-6 py-6 text-sm">
          <span>© 2026 Rodizium</span>
          <a href={INSTAGRAM} className="font-semibold text-white">
            @rodizium
          </a>
        </div>
      </footer>
    </div>
  );
}
