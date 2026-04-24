/**
 * src/lib/streams/credentials.ts
 *
 * Phase 7 — Credential encryption via Web Crypto API.
 * No Node.js crypto import. Compatible with Next.js Edge + Node 18+.
 *
 * Raw credentials NEVER stored plain, returned to client, or logged.
 * Format: base64(iv):base64(ciphertext):base64(authTag)
 * Key:    STREAMS_CREDENTIAL_KEY env — 64-char hex. Generate: openssl rand -hex 32
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
declare const process: { env: Record<string, string | undefined> };

const ALGORITHM = "AES-GCM";
const IV_BYTES  = 12;

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return bytes;
}

function toBase64(buf: Uint8Array): string {
  return btoa(String.fromCharCode(...buf));
}

function fromBase64(b64: string): Uint8Array {
  return Uint8Array.from(atob(b64), c => c.charCodeAt(0));
}

function getKeyBytes(): Uint8Array {
  const raw = process.env.STREAMS_CREDENTIAL_KEY;
  if (!raw || raw.length !== 64) {
    throw new Error(
      "STREAMS_CREDENTIAL_KEY must be a 64-char hex string. " +
      "Generate: openssl rand -hex 32"
    );
  }
  return hexToBytes(raw);
}

async function importKey(bytes: Uint8Array): Promise<CryptoKey> {
  return globalThis.crypto.subtle.importKey(
    "raw",
    bytes as unknown as ArrayBuffer,
    { name: ALGORITHM },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function encryptCredential(plaintext: string): Promise<string> {
  const key     = await importKey(getKeyBytes());
  const iv      = globalThis.crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const encoded = new TextEncoder().encode(plaintext);

  const enc   = await globalThis.crypto.subtle.encrypt(
    { name: ALGORITHM, iv: iv as unknown as ArrayBuffer },
    key,
    encoded as unknown as ArrayBuffer,
  );

  const bytes  = new Uint8Array(enc);
  const cipher = bytes.slice(0, -16);
  const tag    = bytes.slice(-16);

  return [toBase64(iv), toBase64(cipher), toBase64(tag)].join(":");
}

export async function decryptCredential(stored: string): Promise<string> {
  const key   = await importKey(getKeyBytes());
  const parts = stored.split(":");
  if (parts.length !== 3) throw new Error("Invalid credential format");

  const iv  = fromBase64(parts[0]);
  const ct  = fromBase64(parts[1]);
  const tag = fromBase64(parts[2]);
  if (iv.length !== IV_BYTES) throw new Error("Invalid IV length");

  const combined = new Uint8Array(ct.length + tag.length);
  combined.set(ct);
  combined.set(tag, ct.length);

  const dec = await globalThis.crypto.subtle.decrypt(
    { name: ALGORITHM, iv: iv as unknown as ArrayBuffer },
    key,
    combined as unknown as ArrayBuffer,
  );

  return new TextDecoder().decode(dec);
}

export interface SafeAccountInfo {
  id:                string;
  provider:          string;
  providerAccountId: string | null;
  scopes:            string[];
  status:            string;
  projectId:         string | null;
  lastValidatedAt:   string | null;
  validationError:   string | null;
  rotationDueAt:     string | null;
  connectedAt:       string;
}

export function toSafeAccountInfo(row: Record<string, unknown>): SafeAccountInfo {
  return {
    id:                row.id as string,
    provider:          row.provider as string,
    providerAccountId: row.provider_account_id as string | null,
    scopes:            row.scopes as string[],
    status:            row.status as string,
    projectId:         row.project_id as string | null,
    lastValidatedAt:   row.last_validated_at as string | null,
    validationError:   row.validation_error as string | null,
    rotationDueAt:     row.rotation_due_at as string | null,
    connectedAt:       row.connected_at as string,
  };
}

export function credentialKeyConfigured(): boolean {
  return typeof process.env.STREAMS_CREDENTIAL_KEY === "string" &&
    process.env.STREAMS_CREDENTIAL_KEY.length === 64;
}
