import { updateSession } from '@/lib/supabase/middleware'
import { NextResponse, type NextRequest } from 'next/server'

function isStandaloneStreamsPanelMode() {
  return (
    process.env.STREAMS_STANDALONE_PANEL === 'true' ||
    process.env.NEXT_PUBLIC_STREAMS_STANDALONE_PANEL === 'true'
  )
}

function shouldServeStandalonePanel(pathname: string) {
  if (pathname.startsWith('/api')) return false
  if (pathname.startsWith('/_next')) return false
  if (pathname === '/favicon.ico') return false
  if (/\.[a-zA-Z0-9]+$/.test(pathname)) return false
  return pathname !== '/streams'
}

export async function middleware(request: NextRequest) {
  if (isStandaloneStreamsPanelMode() && shouldServeStandalonePanel(request.nextUrl.pathname)) {
    const url = request.nextUrl.clone()
    url.pathname = '/streams'
    return NextResponse.rewrite(url)
  }

  return await updateSession(request)
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * Feel free to modify this pattern to include more paths.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
