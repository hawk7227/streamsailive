import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
    // Stub required env vars so env.ts validate() does not throw during unit tests.
    // These are test-only values — no real credentials, no real endpoints.
    env: {
      OPENAI_API_KEY: 'test-openai-key-for-unit-tests',
      NEXT_PUBLIC_SUPABASE_URL: 'https://test.supabase.co',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-anon-key',
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // 'server-only' is a Next.js compile-time guard — not a real package.
      // In vitest/jsdom it fails to resolve. Mock it as an empty module.
      'server-only': path.resolve(__dirname, './src/test/__mocks__/server-only.ts'),
    },
  },
})
