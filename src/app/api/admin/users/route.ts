import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/db'

function isAdmin(req: NextRequest) {
  return req.cookies.get('cosmetics_admin')?.value === process.env.ADMIN_PASSWORD
}

export async function GET(req: NextRequest) {
  if (!isAdmin(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Get all cosmetics grouped by user
  const { data: cosmetics } = await supabase
    .from('cosmetics')
    .select('user_id, category, created_at')
    .order('created_at', { ascending: false })

  // Get all profiles
  const { data: profiles } = await supabase
    .from('user_profiles')
    .select('user_id, undertone, depth, updated_at')

  // Get advice feedback counts
  const { data: feedbacks } = await supabase
    .from('advice_feedback')
    .select('user_id')

  // Get shade analyses counts
  const { data: analyses } = await supabase
    .from('shade_analyses')
    .select('user_id, created_at')

  const profileMap = new Map((profiles || []).map(p => [p.user_id, p]))
  const feedbackCounts = new Map<string, number>()
  for (const f of feedbacks || []) {
    feedbackCounts.set(f.user_id, (feedbackCounts.get(f.user_id) || 0) + 1)
  }
  const analysisCounts = new Map<string, number>()
  for (const a of analyses || []) {
    analysisCounts.set(a.user_id, (analysisCounts.get(a.user_id) || 0) + 1)
  }

  // Build user list from all known user_ids
  const userIds = new Set<string>()
  for (const c of cosmetics || []) userIds.add(c.user_id)
  for (const p of profiles || []) userIds.add(p.user_id)

  const users = Array.from(userIds).map(userId => {
    const userCosmetics = (cosmetics || []).filter(c => c.user_id === userId)
    const lastActivity = userCosmetics[0]?.created_at || profileMap.get(userId)?.updated_at || null
    const categoryCounts: Record<string, number> = {}
    for (const c of userCosmetics) {
      categoryCounts[c.category] = (categoryCounts[c.category] || 0) + 1
    }
    const profile = profileMap.get(userId)
    return {
      user_id: userId,
      cosmetics_count: userCosmetics.length,
      category_counts: categoryCounts,
      has_profile: !!profile?.undertone,
      undertone: profile?.undertone || null,
      depth: profile?.depth || null,
      analyses_count: analysisCounts.get(userId) || 0,
      feedback_count: feedbackCounts.get(userId) || 0,
      last_activity: lastActivity,
    }
  }).sort((a, b) => {
    if (!a.last_activity) return 1
    if (!b.last_activity) return -1
    return new Date(b.last_activity).getTime() - new Date(a.last_activity).getTime()
  })

  return NextResponse.json(users)
}
