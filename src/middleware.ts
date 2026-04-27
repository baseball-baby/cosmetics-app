import { NextRequest, NextResponse } from 'next/server'

export function middleware(req: NextRequest) {
  const user = req.cookies.get('cosmetics_user')?.value
  const { pathname } = req.nextUrl
  if (!user && pathname !== '/login') {
    return NextResponse.redirect(new URL('/login', req.url))
  }
  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon|login).*)'],
}
