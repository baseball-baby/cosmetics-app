import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/db'

function isAdmin(req: NextRequest) {
  return req.cookies.get('cosmetics_admin')?.value === process.env.ADMIN_PASSWORD
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  if (!isAdmin(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { userId } = await params

  const [cosmetics, profile, analyses, feedbacks] = await Promise.all([
    supabase.from('cosmetics')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .then(r => r.data || []),
    supabase.from('user_profiles')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle()
      .then(r => r.data),
    supabase.from('shade_analyses')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .then(r => r.data || []),
    supabase.from('advice_feedback')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .then(r => r.data || []),
  ])

  return NextResponse.json({ cosmetics, profile, analyses, feedbacks })
}
