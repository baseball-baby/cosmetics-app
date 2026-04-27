import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/db'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  const userId = req.cookies.get('cosmetics_user')?.value
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { situation, extra_notes } = await req.json()

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()

  const { data: cosmetics } = await supabase
    .from('cosmetics')
    .select('*')
    .eq('user_id', userId)
    .order('category')

  const inventoryText = (cosmetics || [])
    .map(
      (c) =>
        `[ID:${c.id}] ${c.brand} ${c.name}（${c.category}）${c.shade_name ? `色號：${c.shade_name}` : ''}${c.color_verdict ? ` 適色：${c.color_verdict}` : ''}`
    )
    .join('\n')

  const prompt = `你是一位頂尖彩妝師，請根據使用者的色彩檔案和庫存化妝品，為今天的情境推薦 2-3 個完整搭配組合。

【使用者色彩檔案】
色調（undertone）：${profile?.undertone || '未分析'}
膚色深淺（depth）：${profile?.depth || '未分析'}
色彩分析總結：${profile?.color_analysis_summary || '未分析'}

【今天的需求】
${situation}
${extra_notes ? `補充狀態：${extra_notes}` : ''}

【現有化妝品庫存】
${inventoryText || '（庫存為空）'}

請以 JSON 格式回傳：
{
  "combinations": [
    {
      "name": "組合名稱（10字以內，例如：自然光澤感妝容）",
      "description": "整體搭配說明與上妝順序建議（100-150字）",
      "products": [
        {
          "id": 產品ID（必須是庫存中存在的 ID）,
          "reason": "選用理由（30-60字），包含顏色為何適合今天狀態"
        }
      ]
    }
  ]
}

重要：products 中的 id 必須對應上方庫存清單中真實存在的 ID。若庫存不足以完成某類別，可略過。只回傳 JSON。`

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2000,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = (response.content[0] as Anthropic.TextBlock).text.trim()
  let result: {
    combinations: Array<{
      name: string
      description: string
      products: Array<{ id: number; reason: string }>
    }>
  }

  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    result = JSON.parse(jsonMatch ? jsonMatch[0] : text)
  } catch {
    return NextResponse.json({ error: 'AI analysis failed', raw: text }, { status: 500 })
  }

  const cosmeticMap = new Map((cosmetics || []).map((c) => [Number(c.id), c]))
  const enriched = result.combinations.map((combo) => ({
    ...combo,
    products: combo.products
      .filter((p) => cosmeticMap.has(p.id))
      .map((p) => ({
        ...p,
        cosmetic: cosmeticMap.get(p.id),
      })),
  }))

  return NextResponse.json({ combinations: enriched })
}
