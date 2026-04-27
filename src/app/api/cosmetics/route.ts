import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/db'
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
  const { data: existingRows } = await supabase
    .from('cosmetics')
    .select('sub_tags')
    .eq('category', category)
    .neq('id', id)
    .eq('user_id', userId)
    .not('sub_tags', 'is', null)

  const existingTags = (existingRows || [])
    .flatMap((r: { sub_tags: string }) => { try { return JSON.parse(r.sub_tags) as string[] } catch { return [] } })
    .filter((v: string, i: number, arr: string[]) => arr.indexOf(v) === i)

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
  const userId = req.cookies.get('cosmetics_user')?.value
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const category = searchParams.get('category')
  const search = searchParams.get('search')
  const sub_tag = searchParams.get('sub_tag')
  const sort = searchParams.get('sort') || 'created_at'
  const order = searchParams.get('order') || 'DESC'

  const allowed = ['expiry_date', 'purchase_date', 'brand', 'price', 'created_at']
  const sortCol = allowed.includes(sort) ? sort : 'created_at'
  const ascending = order === 'ASC'

  let query = supabase.from('cosmetics').select('*').eq('user_id', userId)

  if (category && category !== '全部') {
    query = query.eq('category', category)
  }

  if (search) {
    query = query.or(`brand.ilike.%${search}%,name.ilike.%${search}%,shade_name.ilike.%${search}%`)
  }

  if (sub_tag) {
    query = query.like('sub_tags', `%"${sub_tag}"%`)
  }

  query = query.order(sortCol, { ascending, nullsFirst: false })

  const { data: rows, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(rows)
}

export async function POST(req: NextRequest) {
  const userId = req.cookies.get('cosmetics_user')?.value
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const photoUrls: string[] = body.photo_urls || (body.photo_url ? [body.photo_url] : [])
  const primaryPhoto = photoUrls[0] || null

  const { data: row, error } = await supabase
    .from('cosmetics')
    .insert({
      user_id: userId,
      brand: body.brand,
      name: body.name,
      category: body.category,
      shade_name: body.shade_name || null,
      shade_description: body.shade_description || null,
      official_description: body.official_description || null,
      official_positioning: body.official_positioning || null,
      personal_notes: body.personal_notes || null,
      expiry_date: body.expiry_date || null,
      purchase_date: body.purchase_date || null,
      price: body.price ? Number(body.price) : null,
      photo_url: primaryPhoto,
      photo_urls: photoUrls.length > 0 ? JSON.stringify(photoUrls) : null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Auto-tag (best-effort)
  try {
    const tags = await autoTag(row.id, userId, body.brand, body.name, body.category, body.shade_name || null, body.official_description || null, body.official_positioning || null)
    if (tags.length > 0) {
      await supabase.from('cosmetics').update({ sub_tags: JSON.stringify(tags) }).eq('id', row.id)
      row.sub_tags = JSON.stringify(tags)
    }
  } catch {}

  return NextResponse.json(row, { status: 201 })
}
