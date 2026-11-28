"use client";

/**
 * Botão do Google no próprio app (backlog A1), com Google Identity Services.
 * O Google entrega um id token direto para app.rodizium.com.br, e o Supabase confere esse token
 * (signInWithIdToken / linkIdentity). Assim a tela do Google mostra o nosso domínio, não o do Supabase.
 * O Client ID é público. Se o script do Google não carregar, o app volta ao login por redirecionamento.
 */

export const GOOGLE_CLIENT_ID =
  process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "964181727501-f58dugetk1tkqrqq7bj9ifbieuun01pv.apps.googleusercontent.com";

type CredentialResponse = { credential?: string };
type GoogleId = {
  initialize: (o: Record<string, unknown>) => void;
  renderButton: (el: HTMLElement, o: Record<string, unknown>) => void;
  cancel: () => void;
};
declare global {
  interface Window {
    google?: { accounts?: { id?: GoogleId } };
  }
}

let scriptPromise: Promise<GoogleId | null> | null = null;

export function loadGoogleId(): Promise<GoogleId | null> {
  if (typeof window === "undefined") return Promise.resolve(null);
  if (window.google?.accounts?.id) return Promise.resolve(window.google.accounts.id);
  scriptPromise ??= new Promise((resolve) => {
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true;
    const timer = setTimeout(() => resolve(null), 8000);
    s.onload = () => {
      clearTimeout(timer);
      resolve(window.google?.accounts?.id ?? null);
    };
    s.onerror = () => {
      clearTimeout(timer);
      scriptPromise = null;
      resolve(null);
    };
    document.head.appendChild(s);
  });
  return scriptPromise;
}

/** Nonce: o Google recebe o hash (SHA-256 em hex); o Supabase recebe o valor puro e confere. */
export async function makeNonce() {
  const raw = Array.from(crypto.getRandomValues(new Uint8Array(24)), (b) => b.toString(16).padStart(2, "0")).join("");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw));
  const hashed = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
  return { raw, hashed };
}

/** Desenha o botão oficial do Google dentro de `el`. `onToken` recebe o id token e o nonce puro. */
export async function renderGoogleButton(
  el: HTMLElement,
  onToken: (idToken: string, rawNonce: string) => void,
): Promise<boolean> {
  const gid = await loadGoogleId();
  if (!gid) return false;
  const nonce = await makeNonce();
  gid.initialize({
    client_id: GOOGLE_CLIENT_ID,
    nonce: nonce.hashed,
    callback: (r: CredentialResponse) => r.credential && onToken(r.credential, nonce.raw),
    auto_select: false,
    cancel_on_tap_outside: true,
    itp_support: true,
    use_fedcm_for_button: true,
  });
  el.innerHTML = "";
  gid.renderButton(el, {
    type: "standard",
    theme: "outline",
    size: "large",
    text: "continue_with",
    shape: "pill",
    logo_alignment: "center",
    locale: "pt-BR",
    width: Math.min(400, Math.max(200, Math.floor(el.getBoundingClientRect().width) || 320)),
  });
  return true;
}
