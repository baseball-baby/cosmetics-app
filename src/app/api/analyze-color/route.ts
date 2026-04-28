import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/db'
import Anthropic from '@anthropic-ai/sdk'
import { getSessionUser } from '@/lib/getUser'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  const userId = await getSessionUser()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { cosmetic_id } = await req.json()
  if (!cosmetic_id) return NextResponse.json({ error: 'cosmetic_id required' }, { status: 400 })

  const { data: cosmetic } = await supabase
    .from('cosmetics')
    .select('*')
    .eq('id', Number(cosmetic_id))
    .eq('user_id', userId)
    .maybeSingle()

  if (!cosmetic) return NextResponse.json({ error: 'Cosmetic not found' }, { status: 404 })

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()

  type ContentBlock = Anthropic.TextBlockParam | Anthropic.ImageBlockParam
  const content: ContentBlock[] = []

  if (cosmetic.photo_url && cosmetic.photo_url.startsWith('http')) {
    content.push({
      type: 'image',
      source: { type: 'url', url: cosmetic.photo_url },
    })
  }

  const categoryHint = getCategoryHint(cosmetic.category as string)

  content.push({
    type: 'text',
    text: `你是一位專業彩妝色彩顧問，請根據以下資訊分析這款化妝品是否適合使用者。

【產品資訊】
品牌：${cosmetic.brand}
產品名稱：${cosmetic.name}
類別：${cosmetic.category}
色號名稱：${cosmetic.shade_name || '未填寫'}
顏色描述：${cosmetic.shade_description || '未填寫'}
官方描述：${cosmetic.official_description || '未填寫'}

【使用者色彩檔案】
膚色色調（undertone）：${profile?.undertone || '未分析'}
膚色深淺（depth）：${profile?.depth || '未分析'}
色彩分析總結：${profile?.color_analysis_summary || '未分析'}

【分析重點】
${categoryHint}

請以 JSON 格式回傳：
{
  "verdict": "適合" | "偏黃" | "偏深" | "偏淺" | "偏冷" | "偏暖" | "不適合",
  "reason": "詳細說明（100-200字），說明為何適合或不適合，以及如何搭配使用"
}

只回傳 JSON，不要其他文字。`,
  })

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 500,
    messages: [{ role: 'user', content }],
  })

  const text = (response.content[0] as Anthropic.TextBlock).text.trim()
  let result: { verdict: string; reason: string }
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    result = JSON.parse(jsonMatch ? jsonMatch[0] : text)
  } catch {
    result = { verdict: '不適合', reason: text }
  }

  await supabase.from('cosmetics').update({
    color_verdict: result.verdict,
    color_verdict_reason: result.reason,
  }).eq('id', Number(cosmetic_id))

  await supabase
    .from('shade_analyses')
    .update({ is_current: 0 })
    .eq('cosmetic_id', Number(cosmetic_id))

  await supabase.from('shade_analyses').insert({
    user_id: userId,
    cosmetic_id: Number(cosmetic_id),
    photo_url: cosmetic.photo_url || null,
    ai_verdict: result.verdict,
    ai_analysis: result.reason,
    is_current: 1,
  })

  return NextResponse.json({ verdict: result.verdict, reason: result.reason })
}

function getCategoryHint(category: string): string {
  switch (category) {
    case '粉底/遮瑕':
      return '重點分析色號深淺與冷暖是否吻合使用者膚色，是否會顯灰、偏黃或顏色過深/過淺。'
    case '口紅/唇釉':
      return '重點分析唇色的色調是否與使用者膚色相襯，暖調膚色適合橘調、珊瑚色；冷調膚色適合粉色、玫瑰色。'
    case '腮紅/修容':
      return '重點分析腮紅顏色是否自然提氣色，是否與膚色冷暖相配，避免顯髒或不自然。'
    case '眼影':
      return '重點分析色系是否能提亮眼周、是否會顯髒，暖調膚色搭暖色系更融合，冷調膚色可嘗試冷色或大地色。'
    default:
      return '進行通用的色彩相容性分析，分析顏色與使用者膚色的整體協調程度。'
  }
}
