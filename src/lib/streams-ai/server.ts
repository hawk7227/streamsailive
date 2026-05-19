import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export type StreamsAIConfig = {
  supabaseUrl: string;
  supabaseAnonKey: string;
  supabaseServiceRoleKey: string;
};

export function getStreamsAIConfig(): StreamsAIConfig {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || "";
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

  const missing = [
    !supabaseUrl && "NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL",
    !supabaseAnonKey && "NEXT_PUBLIC_SUPABASE_ANON_KEY or SUPABASE_ANON_KEY",
    !supabaseServiceRoleKey && "SUPABASE_SERVICE_ROLE_KEY",
  ].filter(Boolean);

  if (missing.length) {
    throw new Error(`STREAMS AI Supabase configuration missing: ${missing.join(", ")}`);
  }

  return { supabaseUrl, supabaseAnonKey, supabaseServiceRoleKey };
}

export function createStreamsAIServiceClient(): SupabaseClient {
  const config = getStreamsAIConfig();
  return createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { "x-streams-ai-client": "service" } },
  });
}

export function createStreamsAIUserClient(accessToken: string): SupabaseClient {
  const config = getStreamsAIConfig();
  return createClient(config.supabaseUrl, config.supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${accessToken}`, "x-streams-ai-client": "user" } },
  });
}

export function streamsAISchema(client: SupabaseClient) {
  return client.schema("streams_ai");
}
