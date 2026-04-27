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

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 100,
      messages: [{
        role: 'user',
        content: `你是美妝產品分類專家。根據以下資訊標記分類標籤（繁體中文）。

品牌：${brand}，產品：${name}，類別：${category}，色號：${shade_name || '無'}
官方描述：${official_description || '無'}，品牌定位：${official_positioning || '無'}

針對「${category}」，從以下面向挑最適合的標籤：${hints}
${existingLine}規則：優先沿用已有標籤，語意相同或高度相近的直接用舊標籤；只標記確定的；每個標籤≤5字；最多4個。
只回傳 JSON 陣列，例：["霧面","高遮瑕"]`,
      }],
    })
    const text = (response.content[0] as Anthropic.TextBlock).text.trim()
    const match = text.match(/\[[\s\S]*\]/)
    return match ? (JSON.parse(match[0]) as string[]) : []
  } catch {
    return []
  }
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const userId = _req.cookies.get('cosmetics_user')?.value
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: row, error } = await supabase
    .from('cosmetics')
    .select('*')
    .eq('id', Number(params.id))
    .eq('user_id', userId)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(row)
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const userId = req.cookies.get('cosmetics_user')?.value
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const id = Number(params.id)
  const body = await req.json()

  // Verify ownership
  const { data: existing } = await supabase
    .from('cosmetics')
    .select('id')
    .eq('id', id)
    .eq('user_id', userId)
    .maybeSingle()

  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const photoUrls: string[] = body.photo_urls || (body.photo_url ? [body.photo_url] : [])
  const primaryPhoto = photoUrls[0] || null

  await supabase.from('cosmetics').update({
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
  }).eq('id', id).eq('user_id', userId)

  // Auto-tag (best-effort, always re-run on edit)
  try {
    const tags = await autoTag(id, userId, body.brand, body.name, body.category, body.shade_name || null, body.official_description || null, body.official_positioning || null)
    if (tags.length > 0) {
      await supabase.from('cosmetics').update({ sub_tags: JSON.stringify(tags) }).eq('id', id)
    }
  } catch {}

  const { data: row } = await supabase.from('cosmetics').select('*').eq('id', id).single()
  return NextResponse.json(row)
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const userId = _req.cookies.get('cosmetics_user')?.value
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: row } = await supabase
    .from('cosmetics')
    .select('photo_url, photo_urls')
    .eq('id', Number(params.id))
    .eq('user_id', userId)
    .maybeSingle()

  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Delete images from Supabase Storage
  const urls: string[] = []
  if (row.photo_urls) {
    try { urls.push(...JSON.parse(row.photo_urls)) } catch {}
  } else if (row.photo_url) {
    urls.push(row.photo_url)
  }

  const filenames = urls
    .map((url: string) => url.split('/').pop())
    .filter((f): f is string => !!f)

  if (filenames.length > 0) {
    await supabase.storage.from('uploads').remove(filenames)
  }

  await supabase.from('cosmetics').delete().eq('id', Number(params.id)).eq('user_id', userId)
  return NextResponse.json({ success: true })
}
