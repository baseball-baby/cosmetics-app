import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { getDb } from '@/lib/db'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// Category-specific tag pool for prompt guidance
const CATEGORY_TAG_HINTS: Record<string, string> = {
  '粉底/遮瑕': '妝感（光澤/霧面/緞面/自然妝感）、遮瑕力（輕透/中遮瑕/高遮瑕）、保濕控油（滋潤/控油/水潤/持妝）',
  '眼影': '質地（啞光/珠光/亮片/閃粉）、色系（大地色/煙燻/彩色/裸色）',
  '眼線': '持妝（防水/持久）、效果（自然/俐落）',
  '睫毛膏': '效果（加長/濃密/捲翹/自然）、持妝（防水/一般）',
  '口紅/唇釉': '妝感（霧面/緞面/亮面/玻璃唇）、特性（保濕/持妝/顯色/滋潤）',
  '腮紅/修容': '妝感（霧面/珠光/亮面）',
  '打亮': '妝感（霧光/珠光/閃爍）',
  '眉筆': '效果（自然/立體/持妝）',
  '定妝': '效果（控油/保濕/霧面/持妝）',
}

interface CosmeticRow {
  id: number
  brand: string
  name: string
  category: string
  shade_name: string | null
  official_description: string | null
  official_positioning: string | null
}

export async function POST(req: NextRequest) {
  const { cosmetic_id } = await req.json()
  if (!cosmetic_id) return NextResponse.json({ error: 'cosmetic_id required' }, { status: 400 })

  const db = getDb()
  const cosmetic = db.prepare(
    'SELECT id, brand, name, category, shade_name, official_description, official_positioning FROM cosmetics WHERE id = ?'
  ).get(cosmetic_id) as CosmeticRow | undefined

  if (!cosmetic) return NextResponse.json({ error: 'not found' }, { status: 404 })

  // Collect existing tags in this category to encourage reuse
  const existingRows = db.prepare(
    'SELECT sub_tags FROM cosmetics WHERE category = ? AND id != ? AND sub_tags IS NOT NULL'
  ).all(cosmetic.category, cosmetic_id) as { sub_tags: string }[]

  const allExisting = existingRows.flatMap((r) => { try { return JSON.parse(r.sub_tags) as string[] } catch { return [] } })
  const existingTags = allExisting.filter((v, i) => allExisting.indexOf(v) === i)

  const hints = CATEGORY_TAG_HINTS[cosmetic.category] || '相關特性'

  const prompt = `你是一位美妝產品分類專家。請根據以下產品資訊，自動標記適合的分類標籤，用繁體中文。

產品資訊：
品牌：${cosmetic.brand}
產品名稱：${cosmetic.name}
類別：${cosmetic.category}
色號：${cosmetic.shade_name || '無'}
官方描述：${cosmetic.official_description || '無'}
品牌定位：${cosmetic.official_positioning || '無'}

針對「${cosmetic.category}」類別，請從以下面向挑選最適合的標籤：
${hints}
${existingTags.length > 0 ? `
已有標籤（優先從這裡挑選語意相符的，不要新增重複或近似詞）：
${existingTags.join('、')}
` : ''}
規則：
- 優先沿用已有標籤，語意相同或高度相近的直接用舊標籤，不另造新詞
- 只標記你有把握的，不確定的不要標
- 每個標籤不超過 5 個字
- 最多回傳 4 個標籤
- 如果完全沒有足夠資訊判斷，回傳空陣列

只回傳 JSON 陣列，例如：["霧面", "高遮瑕"]`

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 150,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = (response.content[0] as Anthropic.TextBlock).text.trim()
  try {
    const match = text.match(/\[[\s\S]*\]/)
    const tags: string[] = match ? JSON.parse(match[0]) : []
    const tagJson = JSON.stringify(tags)
    db.prepare('UPDATE cosmetics SET sub_tags = ? WHERE id = ?').run(tagJson, cosmetic_id)
    return NextResponse.json({ tags })
  } catch {
    return NextResponse.json({ tags: [] })
  }
}

// Manual tag update
export async function PUT(req: NextRequest) {
  const { cosmetic_id, tags } = await req.json() as { cosmetic_id: number; tags: string[] }
  if (!cosmetic_id) return NextResponse.json({ error: 'cosmetic_id required' }, { status: 400 })

  const db = getDb()
  db.prepare('UPDATE cosmetics SET sub_tags = ? WHERE id = ?').run(JSON.stringify(tags), cosmetic_id)
  return NextResponse.json({ tags })
}
