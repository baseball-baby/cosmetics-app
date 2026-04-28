import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Admin routes: entirely separate auth (admin cookie), bypass NextAuth
  if (pathname.startsWith('/admin')) {
    if (pathname !== '/admin/login') {
      const adminCookie = req.cookies.get('cosmetics_admin')?.value
      if (adminCookie !== process.env.ADMIN_PASSWORD) {
        return NextResponse.redirect(new URL('/admin/login', req.url))
      }
    }
    return NextResponse.next()
  }

  // Regular routes: require NextAuth session
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })
  if (!token && pathname !== '/login') {
    return NextResponse.redirect(new URL('/login', req.url))
  }
  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon|login).*)'],
}
