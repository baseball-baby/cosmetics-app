import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

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

async function autoFill(brand: string, name: string, category: string): Promise<{ official_description: string; official_positioning: string } | null> {
  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 400,
      messages: [{
        role: 'user',
        content: `你是一位美妝產品資料庫專家。請根據以下產品資訊，用繁體中文提供官方描述和品牌定位。

品牌：${brand}
產品名稱：${name}
類別：${category}

請以 JSON 格式回傳：
{"official_description":"產品功效與特色的官方描述（50-120字）","official_positioning":"品牌定位與風格（30-60字）"}

如果不確定，根據品牌風格和產品名稱合理推測。只回傳 JSON。`,
      }],
    })
    const text = (response.content[0] as Anthropic.TextBlock).text.trim()
    const match = text.match(/\{[\s\S]*\}/)
    return match ? JSON.parse(match[0]) : null
  } catch {
    return null
  }
}

async function autoTag(id: number, brand: string, name: string, category: string, shade_name: string | null, official_description: string | null, official_positioning: string | null): Promise<string[]> {
  const db = getDb()
  const existingRows = db.prepare(
    'SELECT sub_tags FROM cosmetics WHERE category = ? AND id != ? AND sub_tags IS NOT NULL'
  ).all(category, id) as { sub_tags: string }[]

  const existingTags = existingRows
    .flatMap((r) => { try { return JSON.parse(r.sub_tags) as string[] } catch { return [] } })
    .filter((v, i, arr) => arr.indexOf(v) === i)

  const hints = CATEGORY_TAG_HINTS[category] || '相關特性'
  const existingLine = existingTags.length > 0
    ? `已有標籤（優先沿用，語意相近直接用舊詞）：${existingTags.join('、')}\n`
    : ''

  const prompt = `你是美妝產品分類專家。根據以下資訊標記分類標籤（繁體中文）。

品牌：${brand}，產品：${name}，類別：${category}，色號：${shade_name || '無'}
官方描述：${official_description || '無'}，品牌定位：${official_positioning || '無'}

針對「${category}」，從以下面向挑最適合的標籤：${hints}
${existingLine}規則：優先沿用已有標籤，語意相同或高度相近的直接用舊標籤；只標記確定的；每個標籤≤5字；最多4個。
只回傳 JSON 陣列，例：["霧面","高遮瑕"]`

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 100,
      messages: [{ role: 'user', content: prompt }],
    })
    const text = (response.content[0] as Anthropic.TextBlock).text.trim()
    const match = text.match(/\[[\s\S]*\]/)
    return match ? (JSON.parse(match[0]) as string[]) : []
  } catch {
    return []
  }
}

export async function GET(req: NextRequest) {
  const db = getDb()
  const { searchParams } = new URL(req.url)
  const category = searchParams.get('category')
  const search = searchParams.get('search')
  const sub_tag = searchParams.get('sub_tag')
  const sort = searchParams.get('sort') || 'created_at'
  const order = searchParams.get('order') || 'DESC'

  const allowed = ['expiry_date', 'purchase_date', 'brand', 'price', 'created_at']
  const sortCol = allowed.includes(sort) ? sort : 'created_at'
  const sortOrder = order === 'ASC' ? 'ASC' : 'DESC'

  let query = 'SELECT * FROM cosmetics WHERE 1=1'
  const params: unknown[] = []

  if (category && category !== '全部') {
    query += ' AND category = ?'
    params.push(category)
  }

  if (search) {
    query += ' AND (brand LIKE ? OR name LIKE ? OR shade_name LIKE ?)'
    const like = `%${search}%`
    params.push(like, like, like)
  }

  if (sub_tag) {
    query += ' AND sub_tags LIKE ?'
    params.push(`%"${sub_tag}"%`)
  }

  query += ` ORDER BY CASE WHEN ${sortCol} IS NULL THEN 1 ELSE 0 END, ${sortCol} ${sortOrder}`

  const rows = db.prepare(query).all(...params)
  return NextResponse.json(rows)
}

export async function POST(req: NextRequest) {
  const db = getDb()
  const body = await req.json()

  const photoUrls: string[] = body.photo_urls || (body.photo_url ? [body.photo_url] : [])
  const primaryPhoto = photoUrls[0] || null

  // Auto-fill official info if empty
  let officialDescription = body.official_description || null
  let officialPositioning = body.official_positioning || null
  if (!officialDescription && body.brand && body.name) {
    const filled = await autoFill(body.brand, body.name, body.category)
    if (filled) {
      officialDescription = filled.official_description || null
      officialPositioning = filled.official_positioning || null
    }
  }

  const result = db.prepare(`
    INSERT INTO cosmetics (brand, name, category, shade_name, shade_description,
      official_description, official_positioning, personal_notes,
      expiry_date, purchase_date, price, photo_url, photo_urls)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    body.brand,
    body.name,
    body.category,
    body.shade_name || null,
    body.shade_description || null,
    officialDescription,
    officialPositioning,
    body.personal_notes || null,
    body.expiry_date || null,
    body.purchase_date || null,
    body.price ? Number(body.price) : null,
    primaryPhoto,
    photoUrls.length > 0 ? JSON.stringify(photoUrls) : null
  )

  const newId = result.lastInsertRowid as number

  // Auto-tag (best-effort)
  try {
    const tags = await autoTag(newId, body.brand, body.name, body.category, body.shade_name || null, officialDescription, officialPositioning)
    if (tags.length > 0) {
      db.prepare('UPDATE cosmetics SET sub_tags = ? WHERE id = ?').run(JSON.stringify(tags), newId)
    }
  } catch {}

  const row = db.prepare('SELECT * FROM cosmetics WHERE id = ?').get(newId)
  return NextResponse.json(row, { status: 201 })
}
