import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/db'
import { getSessionUser } from '@/lib/getUser'

export async function POST(req: NextRequest) {
  const userId = await getSessionUser()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { oldName } = await req.json()
  if (!oldName?.trim()) return NextResponse.json({ error: 'oldName required' }, { status: 400 })

  const old = oldName.trim()

  // Check old account has data
  const { data: oldCosmetics } = await supabase
    .from('cosmetics')
    .select('id')
    .eq('user_id', old)

  if (!oldCosmetics?.length) {
    return NextResponse.json({ error: 'no_data' }, { status: 404 })
  }

  // Migrate all tables
  await Promise.all([
    supabase.from('cosmetics').update({ user_id: userId }).eq('user_id', old),
    supabase.from('user_profiles').update({ user_id: userId }).eq('user_id', old),
    supabase.from('shade_analyses').update({ user_id: userId }).eq('user_id', old),
    supabase.from('advice_feedback').update({ user_id: userId }).eq('user_id', old),
  ])

  return NextResponse.json({ ok: true, migrated: oldCosmetics.length })
}
