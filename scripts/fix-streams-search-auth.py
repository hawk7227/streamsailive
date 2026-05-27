from pathlib import Path

def read(path):
    return Path(path).read_text(encoding="utf-8")

def write(path, text):
    Path(path).write_text(text, encoding="utf-8")

# 1. Patch search route to accept Supabase cookie OR bearer token.
route = "src/app/api/streams-ai/search/route.ts"
s = read(route)

if 'import { createClient as createSupabaseClient } from "@supabase/supabase-js";' not in s:
    s = s.replace(
        'import { createClient as createServerClient } from "@/lib/supabase/server";',
        'import { createClient as createServerClient } from "@/lib/supabase/server";\nimport { createClient as createSupabaseClient } from "@supabase/supabase-js";'
    )

helper = '''async function getAuthenticatedUser(request: Request) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) return user;

  const authorization = request.headers.get("authorization") || "";
  const token = authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length).trim()
    : "";

  if (!token) return null;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) return null;

  const bearerClient = createSupabaseClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  });

  const {
    data: { user: bearerUser },
  } = await bearerClient.auth.getUser(token);

  return bearerUser || null;
}

'''

if "async function getAuthenticatedUser" not in s:
    s = s.replace("type SearchRequestBody = {\n  query?: string;\n};\n\n", "type SearchRequestBody = {\n  query?: string;\n};\n\n" + helper)

old_auth = '''  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized: sign in before using web search." },
      { status: 401 }
    );
  }'''

new_auth = '''  const user = await getAuthenticatedUser(request);

  if (!user) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Unauthorized: sign in before using web search. Server did not receive a Supabase cookie or bearer session.",
      },
      { status: 401 }
    );
  }'''

if old_auth in s:
    s = s.replace(old_auth, new_auth, 1)

write(route, s)


# 2. Patch runtime to send Supabase bearer token to search endpoint.
runtime = "src/components/streams-ai/current-chat/new-face/hooks/useStreamsChatRuntime.js"
s = read(runtime)

if 'import { useAuth } from "@/contexts/AuthContext";' not in s:
    s = s.replace(
        'import { usePathname } from "next/navigation";',
        'import { usePathname } from "next/navigation";\nimport { useAuth } from "@/contexts/AuthContext";'
    )

if "const { session } = useAuth();" not in s:
    s = s.replace(
        "export function useStreamsChatRuntime() {",
        "export function useStreamsChatRuntime() {\n  const { session } = useAuth();"
    )

s = s.replace(
'''headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query }),''',
'''headers: {
            "Content-Type": "application/json",
            ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
          },
          body: JSON.stringify({ query }),'''
)

write(runtime, s)

print("patched search auth bearer fallback")
