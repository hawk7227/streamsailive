/**
 * src/test/__mocks__/server-only.ts
 *
 * Vitest mock for the 'server-only' Next.js package.
 *
 * 'server-only' is a compile-time guard that prevents Next.js from
 * including server-side modules in the client bundle. It throws at
 * import time in non-server environments.
 *
 * In vitest/jsdom this makes any module that imports 'server-only'
 * unresolvable. This empty mock satisfies the import without enforcing
 * the server-only constraint, which is correct for testing purposes.
 */
export {};
