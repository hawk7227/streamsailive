import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

function safeNextPath(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/streams-ai";
  return value;
}

function clientCallbackUrl(requestUrl: URL, code: string, next: string) {
  const callbackUrl = new URL("/auth/client-callback", requestUrl.origin);
  callbackUrl.searchParams.set("code", code);
  callbackUrl.searchParams.set("next", next);
  return callbackUrl;
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = safeNextPath(requestUrl.searchParams.get("next"));
  const errorDescription = requestUrl.searchParams.get("error_description");

  if (errorDescription || !code) {
    const loginUrl = new URL("/login", requestUrl.origin);
    loginUrl.searchParams.set(
      "error",
      errorDescription || "Authentication callback did not include an authorization code.",
    );
    return NextResponse.redirect(loginUrl);
  }

  const redirectResponse = NextResponse.redirect(new URL(next, requestUrl.origin));
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value, options } of cookiesToSet) {
            redirectResponse.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    if (/pkce|code verifier|storage/i.test(error.message)) {
      return NextResponse.redirect(clientCallbackUrl(requestUrl, code, next));
    }

    const loginUrl = new URL("/login", requestUrl.origin);
    loginUrl.searchParams.set("error", error.message);
    return NextResponse.redirect(loginUrl);
  }

  return redirectResponse;
}
