import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/db'
import { getSessionUser } from '@/lib/getUser'

export async function POST(req: NextRequest) {
  const userId = await getSessionUser()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { feedback } = await req.json() as { feedback: string }
  if (!feedback?.trim()) return NextResponse.json({ error: 'feedback required' }, { status: 400 })

  await supabase.from('advice_feedback').insert({
    user_id: userId,
    question: 'profile_analysis',
    ai_answer: '',
    user_correction: feedback.trim(),
  })

  return NextResponse.json({ ok: true })
}
