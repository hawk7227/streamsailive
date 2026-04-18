// ── Branded types ─────────────────────────────────────────────────────────
// Validators return branded types, not void.
// This enforces at the type level that validation has happened before
// a value enters the compiler internals. Skipping validation is a type error.

declare const __brand: unique symbol;
type Brand<T, B extends string> = T & { readonly [__brand]: B };

export type ValidatedRawPrompt = Brand<string, "ValidatedRawPrompt">;
export type ValidatedCompiledPrompt = Brand<string, "ValidatedCompiledPrompt">;

// ── Validators ─────────────────────────────────────────────────────────────

export function validateRawPrompt(input: string): ValidatedRawPrompt {
  if (!input || !input.trim()) {
    throw new Error("Media prompt cannot be empty.");
  }
  return input as ValidatedRawPrompt;
}

export function validateCompiledPrompt(
  compiled: string,
  context: string,
): ValidatedCompiledPrompt {
  if (!compiled.trim()) {
    throw new Error(`Compiled ${context} prompt cannot be empty.`);
  }
  return compiled as ValidatedCompiledPrompt;
}

export function assertNoDuplicates(items: string[], label: string): void {
  if (items.length !== new Set(items).size) {
    throw new Error(`${label} contains duplicate entries.`);
  }
}

// ── Legacy aliases — kept for any existing callers ─────────────────────────
// These delegate to the typed validators. Remove once all callers migrate.

export function assertNonEmptyPrompt(input: string): void {
  validateRawPrompt(input);
}

export function assertCompiledPrompt(compiled: string, context: string): void {
  validateCompiledPrompt(compiled, context);
}
