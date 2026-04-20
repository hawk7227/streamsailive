/**
 * src/lib/utils/error.ts
 * Shared error narrowing for catch (error: unknown) blocks.
 */

export function toErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return String(error);
}
