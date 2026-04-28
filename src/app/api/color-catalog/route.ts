import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { supabase } from '@/lib/db'
import type { ColorData } from '@/lib/types'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

interface ProductRow {
  id: number
  brand: string
  name: string
  category: string
  shade_name: string | null
  shade_description: string | null
  photo_url: string | null
}

const COLOR_FAMILIES = '裸色系/玫瑰紅/橘色系/珊瑚色/莓果色/正紅色/酒紅色/大地色/粉色系/棕色系/紫色系/磚紅色'
const FINISHES = '霧面/緞面/亮面/珠光/玻璃唇'

async function analyzeByVision(product: ProductRow): Promise<ColorData | null> {
  if (!product.photo_url || !product.photo_url.startsWith('http')) return null

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 200,
    messages: [{
      role: 'user',
      content: [
        {
          type: 'image',
          source: { type: 'url', url: product.photo_url },
        },
        {
          type: 'text',
          text: `這是「${product.brand} ${product.name}${product.shade_name ? ` / ${product.shade_name}` : ''}」的照片。
請根據照片中實際看到的顏色分析（不要靠產品名稱猜測），回傳 JSON（繁體中文）：
{"hex":"#XXXXXX","color_family":"${COLOR_FAMILIES} 其中一個","finish":"${FINISHES} 其中一個","is_expansion_color":true或false,"description":"一句描述（15字內）"}

is_expansion_color 判斷規則：只看顏色明度，與冷暖無關。淺色/明亮色為 true（膨脹），深色/暗色為 false（收縮）。

只回傳 JSON。`,
        },
      ],
    }],
  })

  const text = (response.content[0] as Anthropic.TextBlock).text.trim()
  try {
    const match = text.match(/\{[\s\S]*?\}/)
    return match ? JSON.parse(match[0]) : null
  } catch {
    return null
  }
}

async function searchTavily(query: string) {
  const res = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ api_key: process.env.TAVILY_API_KEY, query, search_depth: 'basic', max_results: 3 }),
  })
  const data = await res.json()
  return (data.results || []) as { title: string; content: string }[]
}

async function analyzeByText(products: ProductRow[]): Promise<Map<number, ColorData>> {
  if (products.length === 0) return new Map()

  const searchSnippets: Record<number, string> = {}
  await Promise.all(products.map(async (p) => {
    try {
      const results = await searchTavily(`${p.brand} ${p.name} ${p.shade_name || ''} shade color makeup`)
      searchSnippets[p.id] = results.map((r) => `${r.title}: ${r.content}`).join('\n').slice(0, 400)
    } catch {
      searchSnippets[p.id] = ''
    }
  }))

  const context = products.map((p) =>
    `ID:${p.id} ${p.brand} ${p.name}${p.shade_name ? ` ${p.shade_name}` : ''} | ${searchSnippets[p.id] || '無資料'}`
  ).join('\n\n')

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 800,
    messages: [{
      role: 'user',
      content: `根據以下搜尋資料分析每個產品的色彩（繁體中文）。若資料不足請誠實標記 description 為「資訊不足」。

${context}

is_expansion_color 判斷規則：只看顏色明度，與冷暖無關。淺色/明亮色為 true（膨脹），深色/暗色為 false（收縮）。

回傳 JSON：{"results":[{"id":數字,"hex":"#XXXXXX","color_family":"${COLOR_FAMILIES} 其中一個","finish":"${FINISHES} 其中一個","is_expansion_color":true/false,"description":"描述（15字內）"}]}
只回傳 JSON。`,
    }],
  })

  const text = (response.content[0] as Anthropic.TextBlock).text.trim()
  const result = new Map<number, ColorData>()
  try {
    const match = text.match(/\{[\s\S]*\}/)
    const parsed = JSON.parse(match ? match[0] : '{}') as { results: (ColorData & { id: number })[] }
    for (const item of parsed.results || []) {
      const { id, ...data } = item
      result.set(id, data)
    }
  } catch {}
  return result
}

export async function POST(req: NextRequest) {
  const userId = req.cookies.get('cosmetics_user')?.value
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { ids } = await req.json() as { ids: number[] }
  if (!ids?.length) return NextResponse.json({ error: 'ids required' }, { status: 400 })

  const { data: products } = await supabase
    .from('cosmetics')
    .select('id, brand, name, category, shade_name, shade_description, photo_url')
    .in('id', ids)
    .eq('user_id', userId)

  const rows = (products || []) as ProductRow[]
  const withPhotos = rows.filter((p) => p.photo_url && p.photo_url.startsWith('http'))
  const withoutPhotos = rows.filter((p) => !p.photo_url || !p.photo_url.startsWith('http'))

  const allResults = new Map<number, ColorData>()
  for (let i = 0; i < withPhotos.length; i += 5) {
    const chunk = withPhotos.slice(i, i + 5)
    const results = await Promise.all(chunk.map((p) => analyzeByVision(p)))
    chunk.forEach((p, idx) => { if (results[idx]) allResults.set(p.id, results[idx]!) })
  }

  const textResults = await analyzeByText(withoutPhotos)
  textResults.forEach((v, k) => allResults.set(k, v))

  for (const [id, data] of Array.from(allResults.entries())) {
    await supabase.from('cosmetics').update({ color_data: JSON.stringify(data) }).eq('id', id)
  }

  return NextResponse.json({ analyzed: allResults.size })
}

export async function PATCH(req: NextRequest) {
  const { id, data } = await req.json() as { id: number; data: ColorData }
  await supabase.from('cosmetics').update({
    color_data: JSON.stringify({ ...data, user_override: true }),
  }).eq('id', id)
  return NextResponse.json({ ok: true })
}

export async function GET(req: NextRequest) {
  const userId = req.cookies.get('cosmetics_user')?.value
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const category = searchParams.get('category') || 'all'

  const cats = category === 'all' ? ['口紅/唇釉', '腮紅/修容'] : [category]

  const { data: rows } = await supabase
    .from('cosmetics')
    .select('brand, name, shade_name, category, color_data')
    .in('category', cats)
    .not('color_data', 'is', null)
    .eq('user_id', userId)

  if (!rows || rows.length < 2) return NextResponse.json({ summary: '', gaps: '' })

  const context = rows.map((r) => {
    const d = JSON.parse(r.color_data) as ColorData
    return `${r.brand} ${r.name}${r.shade_name ? ` ${r.shade_name}` : ''} | ${d.color_family} | ${d.finish} | ${d.description}`
  }).join('\n')

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 300,
    messages: [{
      role: 'user',
      content: `根據以下化妝品色彩資料（繁體中文），生成收藏總結和補齊建議：
${context}
回傳 JSON：{"summary":"整體收藏特色（50字內）","gaps":"建議補齊的色系或妝感（50字內）"}
只回傳 JSON。`,
    }],
  })

  const text = (response.content[0] as Anthropic.TextBlock).text.trim()
  try {
    const match = text.match(/\{[\s\S]*\}/)
    return NextResponse.json(match ? JSON.parse(match[0]) : { summary: '', gaps: '' })
  } catch {
    return NextResponse.json({ summary: '', gaps: '' })
  }
}
