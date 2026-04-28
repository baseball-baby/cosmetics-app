import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/getUser'

export async function GET() {
  const email = await getSessionUser()
  if (!email) return NextResponse.json({ error: 'Not logged in' }, { status: 401 })
  return NextResponse.json({ name: email })
}
