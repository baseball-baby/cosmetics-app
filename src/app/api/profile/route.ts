import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/db'

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

export async function GET(req: NextRequest) {
  const userId = req.cookies.get('cosmetics_user')?.value
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: row } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()

  return NextResponse.json(row ?? { ...BLANK_PROFILE, user_id: userId })
}

export async function PUT(req: NextRequest) {
  const userId = req.cookies.get('cosmetics_user')?.value
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()

  await supabase.from('user_profiles').upsert({
    user_id: userId,
    skin_tone_description: body.skin_tone_description || null,
    skin_type: body.skin_type || null,
    undertone: body.undertone || null,
    undertone_confidence: body.undertone_confidence || null,
    depth: body.depth || null,
    skin_concerns: body.skin_concerns || null,
    makeup_preferences: body.makeup_preferences || null,
    suitable_foundation_shades: body.suitable_foundation_shades ? JSON.stringify(body.suitable_foundation_shades) : null,
    color_analysis_summary: body.color_analysis_summary || null,
    analysis_photo_urls: body.analysis_photo_urls ? JSON.stringify(body.analysis_photo_urls) : null,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' })

  const { data: row } = await supabase.from('user_profiles').select('*').eq('user_id', userId).single()
  return NextResponse.json(row)
}

export async function PATCH(req: NextRequest) {
  const userId = req.cookies.get('cosmetics_user')?.value
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json() as { shade_notes?: unknown[]; brand_shade_table?: unknown[] }

  const update: Record<string, unknown> = {
    user_id: userId,
    updated_at: new Date().toISOString(),
  }
  if (body.shade_notes !== undefined) update.shade_notes = JSON.stringify(body.shade_notes)
  if (body.brand_shade_table !== undefined) update.brand_shade_table = JSON.stringify(body.brand_shade_table)

  await supabase.from('user_profiles').upsert(update, { onConflict: 'user_id' })

  const { data: row } = await supabase.from('user_profiles').select('*').eq('user_id', userId).single()
  return NextResponse.json(row)
}
