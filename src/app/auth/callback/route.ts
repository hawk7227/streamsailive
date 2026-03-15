import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const origin = requestUrl.origin

  if (code) {
    const supabase = await createClient()
    await supabase.auth.exchangeCodeForSession(code)
    
    // Check if user is logged in after exchanging code
    const { data: { user } } = await supabase.auth.getUser()
    
    if (user) {
      // User is logged in, redirect to dashboard
      return NextResponse.redirect(`${origin}/dashboard`)
    }
  }

  // User is not logged in, redirect to landing page
  return NextResponse.redirect(`${origin}/`)
}
