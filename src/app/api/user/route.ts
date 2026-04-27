import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getDb } from '@/lib/db'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const db = getDb()
  const row = db.prepare('SELECT id, email, display_name, created_at FROM users WHERE id = ?').get(session.user.id)
  return NextResponse.json(row)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { display_name } = await req.json()
  if (!display_name?.trim()) return NextResponse.json({ error: 'display_name required' }, { status: 400 })
  const db = getDb()
  db.prepare('UPDATE users SET display_name = ? WHERE id = ?').run(display_name.trim(), session.user.id)
  return NextResponse.json({ ok: true })
}
