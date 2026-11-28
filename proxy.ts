import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { hasSupabaseEnv, supabaseKey, supabaseUrl } from "@/lib/supabase/env";

// Dois ambientes no mesmo projeto:
// - rodizium.com.br: só a landing de lista de espera (qualquer outra rota volta para a raiz;
//   nenhuma rota do app, nem a API de contagem, responde nesse domínio).
// - app.rodizium.com.br (e qualquer outro host): o MVP, sem a landing.
// - fominha-umber.vercel.app: endereço antigo do MVP; redireciona para app.rodizium.com.br
//   mantendo o caminho (links de convite antigos continuam funcionando).
const LANDING_HOSTS = new Set(["rodizium.com.br", "www.rodizium.com.br"]);
const LANDING_ROUTE = "/lista";
/** Páginas públicas que abrem nos dois domínios (exigidas pelo Google para o login). */
const PUBLIC_PAGES = new Set(["/privacidade", "/termos"]);
const OLD_APP_HOST = "fominha-umber.vercel.app";
const APP_ORIGIN = "https://app.rodizium.com.br";

export async function proxy(request: NextRequest) {
  const host = request.headers.get("host")?.split(":")[0] ?? "";
  const { pathname, search } = request.nextUrl;

  if (host === OLD_APP_HOST) return NextResponse.redirect(`${APP_ORIGIN}${pathname}${search}`, 308);

  if (PUBLIC_PAGES.has(pathname)) return NextResponse.next();

  if (LANDING_HOSTS.has(host)) {
    if (pathname === "/") return NextResponse.rewrite(new URL(LANDING_ROUTE, request.url));
    return NextResponse.redirect(new URL("/", request.url));
  }
  if (pathname === LANDING_ROUTE || pathname.startsWith(`${LANDING_ROUTE}/`)) {
    return new NextResponse("Not found", { status: 404 });
  }

  // App: renova a sessão do Supabase a cada navegação, antes da página renderizar.
  let response = NextResponse.next({ request });
  if (!hasSupabaseEnv) return response;

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
        Object.entries(headers ?? {}).forEach(([key, value]) =>
          response.headers.set(key, value),
        );
      },
    },
  });

  await supabase.auth.getClaims();
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icons/|manifest.webmanifest|.*\\.(?:png|jpg|jpeg|svg|webp|ico)$).*)",
  ],
};
