/**
 * src/lib/streams/connectors/supabase.ts
 *
 * Supabase connector adapter — Phase 7.
 *
 * Uses Supabase service role key + project ref, stored encrypted.
 * Credentials are decrypted server-side only — never returned to client.
 *
 * Actions:
 *   validateCredentials() — verify service key is valid for project
 *   getProjectInfo()      — project name, region, DB version
 *   listMigrations()      — applied migrations from schema_migrations
 *   runMigration()        — apply SQL migration (destructive — logged)
 *   checkTableExists()    — verify a table exists in the public schema
 *   getRowCount()         — row count for a given table
 */

export interface SupabaseValidation {
  valid:       boolean;
  projectRef:  string | null;
  projectName: string | null;
  region:      string | null;
  error?:      string;
}

export interface SupabaseMigration {
  version:    string;
  insertedAt: string;
}

export interface SupabaseConnectorCredentials {
  projectRef:     string;  // e.g. "abcdefghijklmnop"
  serviceRoleKey: string;  // supabase service_role JWT
}

// ── Parse credential payload ───────────────────────────────────────────────────
// Stored as JSON string, encrypted at rest.

export function parseSupabaseCredentials(decrypted: string): SupabaseConnectorCredentials {
  const parsed = JSON.parse(decrypted) as Record<string, unknown>;
  const projectRef     = parsed.projectRef as string;
  const serviceRoleKey = parsed.serviceRoleKey as string;

  if (!projectRef || !serviceRoleKey) {
    throw new Error("Supabase credentials missing projectRef or serviceRoleKey");
  }

  return { projectRef, serviceRoleKey };
}

// ── Supabase Management API helpers ───────────────────────────────────────────

const MGMT_API = "https://api.supabase.com";

function mgmtHeaders(token: string): Record<string, string> {
  return {
    Authorization:  `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

// ── Validate credentials ──────────────────────────────────────────────────────

export async function validateSupabaseCredentials(
  creds: SupabaseConnectorCredentials,
): Promise<SupabaseValidation> {
  try {
    // Use the REST endpoint to verify the service key works
    const url = `https://${creds.projectRef}.supabase.co/rest/v1/`;
    const res = await fetch(url, {
      headers: {
        apikey:        creds.serviceRoleKey,
        Authorization: `Bearer ${creds.serviceRoleKey}`,
      },
    });

    // 200 or 400 (no table specified) both mean the key is valid
    if (res.status === 200 || res.status === 400) {
      return {
        valid:       true,
        projectRef:  creds.projectRef,
        projectName: null,  // requires management API with personal access token
        region:      null,
      };
    }

    return {
      valid:       false,
      projectRef:  creds.projectRef,
      projectName: null,
      region:      null,
      error:       `HTTP ${res.status}`,
    };
  } catch (err) {
    return {
      valid:       false,
      projectRef:  creds.projectRef,
      projectName: null,
      region:      null,
      error:       err instanceof Error ? err.message : "Network error",
    };
  }
}

// ── List applied migrations ───────────────────────────────────────────────────

export async function listSupabaseMigrations(
  creds: SupabaseConnectorCredentials,
): Promise<SupabaseMigration[]> {
  const url = `https://${creds.projectRef}.supabase.co/rest/v1/schema_migrations` +
    `?select=version,inserted_at&order=inserted_at.desc&limit=20`;

  const res = await fetch(url, {
    headers: {
      apikey:        creds.serviceRoleKey,
      Authorization: `Bearer ${creds.serviceRoleKey}`,
      Accept:        "application/json",
    },
  });

  if (!res.ok) return [];

  const data = await res.json() as Record<string, unknown>[];
  return data.map(r => ({
    version:    r.version as string,
    insertedAt: r.inserted_at as string,
  }));
}

// ── Check table exists ────────────────────────────────────────────────────────

export async function checkSupabaseTableExists(
  creds: SupabaseConnectorCredentials,
  tableName: string,
): Promise<boolean> {
  // Query information_schema via RPC or REST head request
  const url = `https://${creds.projectRef}.supabase.co/rest/v1/${tableName}?limit=1`;
  const res = await fetch(url, {
    method: "HEAD",
    headers: {
      apikey:        creds.serviceRoleKey,
      Authorization: `Bearer ${creds.serviceRoleKey}`,
    },
  });

  // 200 = table exists, 404 = does not exist
  return res.status === 200;
}

// ── Get row count ─────────────────────────────────────────────────────────────

export async function getSupabaseRowCount(
  creds: SupabaseConnectorCredentials,
  tableName: string,
): Promise<number | null> {
  const url = `https://${creds.projectRef}.supabase.co/rest/v1/${tableName}?select=*`;
  const res = await fetch(url, {
    method: "HEAD",
    headers: {
      apikey:           creds.serviceRoleKey,
      Authorization:    `Bearer ${creds.serviceRoleKey}`,
      Prefer:           "count=exact",
    },
  });

  if (!res.ok) return null;

  const rangeHeader = res.headers.get("content-range");
  if (!rangeHeader) return null;

  // Format: "0-49/1234"
  const total = rangeHeader.split("/")[1];
  return total ? parseInt(total, 10) : null;
}

// ── Run migration (destructive — caller must log) ─────────────────────────────

export async function runSupabaseMigration(
  creds: SupabaseConnectorCredentials,
  sql: string,
): Promise<{ success: boolean; error?: string }> {
  const url = `https://${creds.projectRef}.supabase.co/rest/v1/rpc/exec_sql`;

  const res = await fetch(url, {
    method:  "POST",
    headers: {
      apikey:           creds.serviceRoleKey,
      Authorization:    `Bearer ${creds.serviceRoleKey}`,
      "Content-Type":   "application/json",
    },
    body: JSON.stringify({ query: sql }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as Record<string, unknown>;
    return {
      success: false,
      error:   (err.message as string) ?? `HTTP ${res.status}`,
    };
  }

  return { success: true };
}
