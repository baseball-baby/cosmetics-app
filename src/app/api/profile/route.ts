import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

const BLANK_PROFILE = {
  skin_tone_description: null,
  skin_type: null,
  undertone: null,
  undertone_confidence: null,
  depth: null,
  skin_concerns: null,
  makeup_preferences: null,
  suitable_foundation_shades: null,
  color_analysis_summary: null,
  analysis_photo_urls: null,
  shade_notes: null,
  updated_at: new Date().toISOString(),
}

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const db = getDb()
  const row = db.prepare('SELECT * FROM user_profiles WHERE user_id = ?').get(session.user.id)
  return NextResponse.json(row ?? { ...BLANK_PROFILE, user_id: session.user.id })
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = session.user.id
  const db = getDb()
  const body = await req.json()

  db.prepare(`
    INSERT INTO user_profiles (
      user_id, skin_tone_description, skin_type, undertone, undertone_confidence, depth,
      skin_concerns, makeup_preferences, suitable_foundation_shades,
      color_analysis_summary, analysis_photo_urls, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now','localtime'))
    ON CONFLICT(user_id) DO UPDATE SET
      skin_tone_description = excluded.skin_tone_description,
      skin_type = excluded.skin_type,
      undertone = excluded.undertone,
      undertone_confidence = excluded.undertone_confidence,
      depth = excluded.depth,
      skin_concerns = excluded.skin_concerns,
      makeup_preferences = excluded.makeup_preferences,
      suitable_foundation_shades = excluded.suitable_foundation_shades,
      color_analysis_summary = excluded.color_analysis_summary,
      analysis_photo_urls = excluded.analysis_photo_urls,
      updated_at = excluded.updated_at
  `).run(
    userId,
    body.skin_tone_description || null,
    body.skin_type || null,
    body.undertone || null,
    body.undertone_confidence || null,
    body.depth || null,
    body.skin_concerns || null,
    body.makeup_preferences || null,
    body.suitable_foundation_shades ? JSON.stringify(body.suitable_foundation_shades) : null,
    body.color_analysis_summary || null,
    body.analysis_photo_urls ? JSON.stringify(body.analysis_photo_urls) : null
  )

  const row = db.prepare('SELECT * FROM user_profiles WHERE user_id = ?').get(userId)
  return NextResponse.json(row)
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = session.user.id
  const db = getDb()
  const body = await req.json() as { shade_notes: unknown[] }

  db.prepare(`
    INSERT INTO user_profiles (user_id, shade_notes, updated_at)
    VALUES (?, ?, datetime('now','localtime'))
    ON CONFLICT(user_id) DO UPDATE SET
      shade_notes = excluded.shade_notes,
      updated_at = excluded.updated_at
  `).run(userId, JSON.stringify(body.shade_notes))

  const row = db.prepare('SELECT * FROM user_profiles WHERE user_id = ?').get(userId)
  return NextResponse.json(row)
}
