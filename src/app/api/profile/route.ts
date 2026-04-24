import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export async function GET() {
  const db = getDb()
  const row = db.prepare('SELECT * FROM color_profile WHERE id = 1').get()
  return NextResponse.json(row)
}

export async function PUT(req: NextRequest) {
  const db = getDb()
  const body = await req.json()

  db.prepare(`
    UPDATE color_profile SET
      skin_tone_description = ?,
      skin_type = ?,
      undertone = ?,
      undertone_confidence = ?,
      depth = ?,
      skin_concerns = ?,
      makeup_preferences = ?,
      suitable_foundation_shades = ?,
      color_analysis_summary = ?,
      analysis_photo_urls = ?,
      updated_at = datetime('now','localtime')
    WHERE id = 1
  `).run(
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

  const row = db.prepare('SELECT * FROM color_profile WHERE id = 1').get()
  return NextResponse.json(row)
}

export async function PATCH(req: NextRequest) {
  const db = getDb()
  const body = await req.json() as { shade_notes: unknown[] }
  db.prepare(`UPDATE color_profile SET shade_notes = ?, updated_at = datetime('now','localtime') WHERE id = 1`)
    .run(JSON.stringify(body.shade_notes))
  const row = db.prepare('SELECT * FROM color_profile WHERE id = 1').get()
  return NextResponse.json(row)
}
