import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export type StreamsAIConfig = {
  supabaseUrl: string;
  supabaseAnonKey: string;
  supabaseServiceRoleKey: string;
};

function firstEnv(...names: string[]) {
  for (const name of names) {
    const value = process.env[name];
    if (value && value.trim()) return value.trim();
  }
  return "";
}

function supabaseUrl() {
  return firstEnv(
    "NEXT_PUBLIC_SUPABASE_URL",
    "SUPABASE_URL",
    "DATABASE_SUPABASE_URL",
  );
}

function supabaseAnonKey() {
  return firstEnv(
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    "SUPABASE_ANON_KEY",
    "SUPABASE_PUBLIC_ANON_KEY",
    "SUPABASE_PUBLISHABLE_KEY",
  );
}

function supabaseServiceRoleKey() {
  return firstEnv(
    "SUPABASE_SERVICE_ROLE_KEY",
    "SUPABASE_SERVICE_KEY",
    "SUPABASE_SERVICE_ROLE",
    "SUPABASE_SECRET_KEY",
    "SUPABASE_SECRET",
    "SERVICE_ROLE_KEY",
  );
}

export function getStreamsAIConfig(): StreamsAIConfig {
  const url = supabaseUrl();
  const serviceRoleKey = supabaseServiceRoleKey();
  const anonKey = supabaseAnonKey() || serviceRoleKey;

  const missing = [
    !url && "NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL",
    !serviceRoleKey && "SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SERVICE_KEY",
  ].filter(Boolean);

  if (missing.length) {
    throw new Error(`STREAMS AI Supabase configuration missing: ${missing.join(", ")}`);
  }

  return {
    supabaseUrl: url,
    supabaseAnonKey: anonKey,
    supabaseServiceRoleKey: serviceRoleKey,
  };
}

export function createStreamsAIServiceClient(): SupabaseClient {
  const url = supabaseUrl();
  const serviceRoleKey = supabaseServiceRoleKey();

  const missing = [
    !url && "NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL",
    !serviceRoleKey && "SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SERVICE_KEY",
  ].filter(Boolean);

  if (missing.length) {
    throw new Error(`STREAMS AI Supabase service configuration missing: ${missing.join(", ")}`);
  }

  return createClient(url, serviceRoleKey, {
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
  return client.schema("streams");
}

export const streamsAITables = {
  tenants: "streams_ai_tenants",
  memberships: "streams_ai_memberships",
  accounts: "streams_ai_accounts",
  projects: "streams_ai_projects",
  subscriptions: "streams_ai_subscriptions",
  productEntitlements: "streams_ai_product_entitlements",
  chatSessions: "streams_ai_chat_sessions",
  chatMessages: "streams_ai_chat_messages",
  chatToolCalls: "streams_ai_chat_tool_calls",
  messageFeedback: "streams_ai_message_feedback",
  messageActionReceipts: "streams_ai_message_action_receipts",
  assets: "streams_ai_assets",
  jobs: "streams_ai_jobs",
  jobEvents: "streams_ai_job_events",
  providerRuns: "streams_ai_provider_runs",
  creditLedger: "streams_ai_credit_ledger",
  usageEvents: "streams_ai_usage_events",
  usageWallets: "streams_ai_usage_wallets",
  usageLedger: "streams_ai_usage_ledger",
  usageSessions: "streams_ai_usage_sessions",
  dailyUsage: "streams_ai_daily_usage",
  usageCreditPurchases: "streams_ai_usage_credit_purchases",
  autoReloadSettings: "streams_ai_auto_reload_settings",
  spendLimits: "streams_ai_spend_limits",
  usageNotifications: "streams_ai_usage_notifications",
  userSettings: "streams_ai_user_settings",
  memories: "streams_ai_memories",
  memoryChunks: "streams_ai_memory_chunks",
  projectKnowledge: "streams_ai_project_knowledge",
} as const;
