import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const name = req.cookies.get('cosmetics_user')?.value
  if (!name) return NextResponse.json({ error: 'Not logged in' }, { status: 401 })
  return NextResponse.json({ name })
}

export async function POST(req: NextRequest) {
  const { name } = await req.json()
  if (!name?.trim()) return NextResponse.json({ error: 'name required' }, { status: 400 })
  const res = NextResponse.json({ ok: true })
  res.cookies.set('cosmetics_user', name.trim(), {
    httpOnly: false, // readable by JS for display
    maxAge: 60 * 60 * 24 * 365,
    path: '/',
    sameSite: 'lax',
  })
  return res
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true })
  res.cookies.delete('cosmetics_user')
  return res
}
