/**
 * src/lib/connector/encryption.ts
 *
 * AES-256-GCM encryption for connector credentials.
 *
 * Security contract:
 * - Key comes ONLY from CONNECTOR_ENCRYPTION_KEY env var (32-byte hex = 64 chars)
 * - Every encrypt call generates a fresh random IV (12 bytes)
 * - The GCM authentication tag (16 bytes) is stored alongside ciphertext
 * - Format on disk: base64(iv).base64(tag).base64(ciphertext)
 * - Decryption fails loudly if key, IV, tag, or ciphertext is wrong
 * - Raw credentials NEVER leave this module as plaintext
 *
 * If CONNECTOR_ENCRYPTION_KEY is missing, encrypt/decrypt throw immediately.
 * This is intentional — the server must not operate without a key.
 */

import crypto from "crypto";
import type { DecryptedCredentials } from "./types";

const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12;    // 96-bit IV recommended for GCM
const TAG_BYTES = 16;   // 128-bit auth tag
const KEY_HEX_LEN = 64; // 32 bytes = 64 hex chars

function getKey(): Buffer {
  const raw = process.env.CONNECTOR_ENCRYPTION_KEY?.trim();
  if (!raw) {
    throw new Error(
      "[connector/encryption] CONNECTOR_ENCRYPTION_KEY is not set. " +
      "Generate one with: openssl rand -hex 32"
    );
  }
  if (raw.length !== KEY_HEX_LEN) {
    throw new Error(
      `[connector/encryption] CONNECTOR_ENCRYPTION_KEY must be ${KEY_HEX_LEN} hex characters (32 bytes). ` +
      `Got ${raw.length} characters.`
    );
  }
  return Buffer.from(raw, "hex");
}

/**
 * Encrypt credentials for storage.
 * Returns a string safe to store in the database.
 *
 * Format: base64(iv).base64(tag).base64(ciphertext)
 */
export function encryptCredentials(creds: DecryptedCredentials): string {
  const key = getKey();
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const plaintext = JSON.stringify(creds);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return [
    iv.toString("base64"),
    tag.toString("base64"),
    encrypted.toString("base64"),
  ].join(".");
}

/**
 * Decrypt credentials from storage.
 * Throws if decryption or authentication fails.
 *
 * Returns DecryptedCredentials — server-only, never serialise or log this.
 */
export function decryptCredentials(stored: string): DecryptedCredentials {
  const key = getKey();
  const parts = stored.split(".");
  if (parts.length !== 3) {
    throw new Error("[connector/encryption] Invalid stored credential format.");
  }

  const [ivB64, tagB64, cipherB64] = parts;
  const iv = Buffer.from(ivB64, "base64");
  const tag = Buffer.from(tagB64, "base64");
  const ciphertext = Buffer.from(cipherB64, "base64");

  if (iv.length !== IV_BYTES) {
    throw new Error("[connector/encryption] Invalid IV length.");
  }
  if (tag.length !== TAG_BYTES) {
    throw new Error("[connector/encryption] Invalid auth tag length.");
  }

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  let plaintext: string;
  try {
    plaintext = decipher.update(ciphertext).toString("utf8") + decipher.final("utf8");
  } catch {
    throw new Error(
      "[connector/encryption] Decryption failed — key mismatch, corrupted data, or tampered ciphertext."
    );
  }

  try {
    return JSON.parse(plaintext) as DecryptedCredentials;
  } catch {
    throw new Error("[connector/encryption] Decrypted payload is not valid JSON.");
  }
}

/**
 * Re-encrypt credentials with a fresh IV (rotation).
 * Call this periodically or after a suspected key exposure.
 */
export function rotateCredentials(stored: string): string {
  const creds = decryptCredentials(stored);
  return encryptCredentials(creds);
}

/**
 * Verify that a stored encrypted blob can be decrypted with the current key.
 * Returns true if valid, false if not — does not throw.
 */
export function verifyEncryptedBlob(stored: string): boolean {
  try {
    decryptCredentials(stored);
    return true;
  } catch {
    return false;
  }
}

/**
 * Mask a token for safe display in logs/UI.
 * Shows first 4 + last 4 chars, masks the rest.
 * Never call this on the full encrypted blob — only on tokens for display.
 */
export function maskToken(token: string): string {
  if (token.length <= 8) return "****";
  return token.slice(0, 4) + "****" + token.slice(-4);
}
