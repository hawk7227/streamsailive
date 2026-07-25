import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";

type AuthenticatedUser = {
  id: string;
  email?: string | null;
};

function bearerToken(request: NextRequest): string | null {
  const authorization = request.headers.get("authorization")?.trim();

  if (!authorization?.toLowerCase().startsWith("bearer ")) {
    return null;
  }

  const token = authorization.slice(7).trim();
  return token || null;
}

/**
 * Authenticate an API request using either:
 * 1. Authorization: Bearer <Supabase access token>; or
 * 2. the Supabase SSR cookies already attached to the request.
 *
 * Use this in POST /api/v1/projects instead of requiring a bearer header only.
 */
export async function authenticateStreamsAIRequest(
  request: NextRequest,
): Promise<
  | { ok: true; user: AuthenticatedUser }
  | { ok: false; response: NextResponse }
> {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
    process.env.SUPABASE_URL?.trim();
  const supabaseAnonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
    process.env.SUPABASE_ANON_KEY?.trim();

  if (!supabaseUrl || !supabaseAnonKey) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          ok: false,
          apiVersion: "v1",
          error: "Supabase authentication configuration is unavailable.",
        },
        { status: 500 },
      ),
    };
  }

  const token = bearerToken(request);

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      // API authentication only needs to read cookies. Session refresh should
      // be handled in middleware/callback code where response cookies can be set.
      setAll(
        _cookiesToSet: Array<{
          name: string;
          value: string;
          options: CookieOptions;
        }>,
      ) {},
    },
    global: token
      ? {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      : undefined,
  });

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token ?? undefined);

  if (error || !user) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          ok: false,
          apiVersion: "v1",
          error:
            "STREAMS AI requires an authenticated streamsailive session.",
        },
        { status: 401 },
      ),
    };
  }

  return {
    ok: true,
    user: {
      id: user.id,
      email: user.email,
    },
  };
}

/*
Route integration:

export async function POST(request: NextRequest) {
  const authentication = await authenticateStreamsAIRequest(request);
  if (!authentication.ok) return authentication.response;

  const user = authentication.user;
  // Continue existing project creation using user.id.
}
*/
