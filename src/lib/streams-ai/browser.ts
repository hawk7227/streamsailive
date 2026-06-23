import { createClient } from "@supabase/supabase-js";

async function streamsAIBrowserLock<T>(_name: string, _acquireTimeout: number, fn: () => Promise<T>): Promise<T> {
  return fn();
}

export function createStreamsAIBrowserClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("STREAMS AI browser client requires NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.");
  }

  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      lock: streamsAIBrowserLock,
    },
    global: { headers: { "x-streams-ai-client": "browser" } },
  });
}

export async function getStreamsAIAccessToken() {
  const client = createStreamsAIBrowserClient();
  const { data, error } = await client.auth.getSession();
  if (error) throw new Error(error.message);
  return data.session?.access_token || null;
}
