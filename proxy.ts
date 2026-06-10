import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const PUBLIC_PATHS = ['/login', '/api/login', '/api/logout']

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const isPublic = PUBLIC_PATHS.some(p => pathname.startsWith(p))
  const token = request.cookies.get('bdc_session')?.value

  // Pas de token sur une route protégée → login
  if (!isPublic && !token) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  //  SUPPRIMÉ : le redirect /login→/dashboard sur cookie périmé
  // Un cookie peut survivre à une suppression de session en DB.
  // C'est le layout server-side (getSessionUser) qui gère cette vérification.
  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|_next/webpack-hmr).*)'],
}