import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
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

async function autoTag(id: number, userId: string, brand: string, name: string, category: string, shade_name: string | null, official_description: string | null, official_positioning: string | null): Promise<string[]> {
  const db = getDb()
  const existingRows = db.prepare(
    'SELECT sub_tags FROM cosmetics WHERE category = ? AND id != ? AND user_id = ? AND sub_tags IS NOT NULL'
  ).all(category, id, userId) as { sub_tags: string }[]

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
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = session.user.id

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

  let query = 'SELECT * FROM cosmetics WHERE user_id = ?'
  const params: unknown[] = [userId]

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
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = session.user.id

  const db = getDb()
  const body = await req.json()

  const photoUrls: string[] = body.photo_urls || (body.photo_url ? [body.photo_url] : [])
  const primaryPhoto = photoUrls[0] || null

  const result = db.prepare(`
    INSERT INTO cosmetics (user_id, brand, name, category, shade_name, shade_description,
      official_description, official_positioning, personal_notes,
      expiry_date, purchase_date, price, photo_url, photo_urls)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    userId,
    body.brand,
    body.name,
    body.category,
    body.shade_name || null,
    body.shade_description || null,
    body.official_description || null,
    body.official_positioning || null,
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
    const tags = await autoTag(newId, userId, body.brand, body.name, body.category, body.shade_name || null, body.official_description || null, body.official_positioning || null)
    if (tags.length > 0) {
      db.prepare('UPDATE cosmetics SET sub_tags = ? WHERE id = ?').run(JSON.stringify(tags), newId)
    }
  } catch {}

  const row = db.prepare('SELECT * FROM cosmetics WHERE id = ?').get(newId)
  return NextResponse.json(row, { status: 201 })
}
