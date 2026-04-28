import { NextRequest, NextResponse } from 'next/server'

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Admin routes: require cosmetics_admin cookie (login page is exempt)
  if (pathname.startsWith('/admin') && pathname !== '/admin/login') {
    const adminCookie = req.cookies.get('cosmetics_admin')?.value
    if (adminCookie !== process.env.ADMIN_PASSWORD) {
      return NextResponse.redirect(new URL('/admin/login', req.url))
    }
    return NextResponse.next()
  }

  // Regular routes: require cosmetics_user cookie
  const user = req.cookies.get('cosmetics_user')?.value
  if (!user && pathname !== '/login') {
    return NextResponse.redirect(new URL('/login', req.url))
  }
  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon|login).*)'],
}
