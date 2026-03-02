import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!url || !key) {
        // During build/SSG, env vars may not exist.
        // Return a no-op proxy that won't crash at import time.
        // Actual Supabase calls only happen client-side at runtime.
        return new Proxy({} as ReturnType<typeof createBrowserClient>, {
            get(_target, prop) {
                if (prop === 'auth') {
                    return new Proxy({}, {
                        get() {
                            return async () => ({ data: { user: null, session: null }, error: { message: 'Supabase not configured' } })
                        }
                    })
                }
                if (prop === 'from') {
                    return () => ({
                        select: () => ({ eq: () => ({ single: async () => ({ data: null, error: { message: 'Supabase not configured' } }), data: null, error: null }), data: null, error: null }),
                        insert: () => ({ select: () => ({ single: async () => ({ data: null, error: null }) }) }),
                        update: () => ({ eq: async () => ({ data: null, error: null }) }),
                        delete: () => ({ eq: async () => ({ error: null }) }),
                    })
                }
                if (prop === 'rpc') {
                    return async () => ({ data: null, error: { message: 'Supabase not configured' } })
                }
                return undefined
            }
        })
    }

    return createBrowserClient(url, key, {
        auth: {
            lock: false,
        }
    })
}
