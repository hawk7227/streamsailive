export function assertNonEmptyPrompt(input: string): void {
  if (!input || !input.trim()) {
    throw new Error("Media prompt cannot be empty.");
  }
}

export function assertCompiledPrompt(compiled: string, context: string): void {
  if (!compiled.trim()) {
    throw new Error(`Compiled ${context} prompt cannot be empty.`);
  }
}

export function assertNoDuplicates(items: string[], label: string): void {
  if (items.length !== new Set(items).size) {
    throw new Error(`${label} contains duplicate entries.`);
  }
}
