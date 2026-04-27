import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { supabase } from '@/lib/db'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// Categories where shade-specific image search makes sense
const SHADE_IMAGE_CATEGORIES = ['口紅/唇釉', '腮紅/修容', '眼影']

async function searchProductImage(brand: string, name: string, category: string, shadeName?: string): Promise<string | null> {
  try {
    const useShade = shadeName && SHADE_IMAGE_CATEGORIES.includes(category)
    const query = useShade
      ? `${brand} ${name} ${shadeName} shade swatch color`
      : `${brand} ${name} product image official`
    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: process.env.TAVILY_API_KEY,
        query,
        search_depth: 'basic',
        max_results: 3,
        include_images: true,
      }),
    })
    const data = await res.json()
    const images = data.images as string[] | undefined
    return images?.[0] ?? null
  } catch {
    return null
  }
}

async function downloadImage(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) })
    if (!res.ok) return null
    const contentType = res.headers.get('content-type') || ''
    if (!contentType.startsWith('image/')) return null
    const ext = contentType.includes('png') ? 'png' : contentType.includes('webp') ? 'webp' : 'jpg'
    const buffer = await res.arrayBuffer()
    const filename = `autofetch_${Date.now()}.${ext}`

    const { error } = await supabase.storage
      .from('uploads')
      .upload(filename, Buffer.from(buffer), { contentType, upsert: false })

    if (error) return null
    const { data } = supabase.storage.from('uploads').getPublicUrl(filename)
    return data.publicUrl
  } catch {
    return null
  }
}

export async function POST(req: NextRequest) {
  const { brand, name, category, hasPhotos, shade_name } = await req.json()
  if (!brand || !name) return NextResponse.json({ error: 'brand and name required' }, { status: 400 })

  const prompt = `你是一位美妝產品資料庫專家。請根據以下產品資訊，用繁體中文提供官方描述和品牌定位。

品牌：${brand}
產品名稱：${name}
類別：${category || ''}

請以 JSON 格式回傳：
{
  "official_description": "產品功效與特色的官方描述（50-120字）",
  "official_positioning": "品牌定位與風格（30-60字，例如：高遮瑕持妝、適合乾性肌膚、自然裸妝感）"
}

如果你不確定這個產品的詳細資訊，請根據品牌風格和產品名稱推測合理的描述。只回傳 JSON。`

  const [response, imageUrl] = await Promise.all([
    client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 400,
      messages: [{ role: 'user', content: prompt }],
    }),
    !hasPhotos ? searchProductImage(brand, name, category || '', shade_name || '') : Promise.resolve(null),
  ])

  const text = (response.content[0] as Anthropic.TextBlock).text.trim()
  let result: { official_description: string; official_positioning: string }
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    result = JSON.parse(jsonMatch ? jsonMatch[0] : text)
  } catch {
    return NextResponse.json({ error: 'Parse failed', raw: text }, { status: 500 })
  }

  let photoUrl: string | null = null
  if (imageUrl) {
    photoUrl = await downloadImage(imageUrl)
  }

  return NextResponse.json({ ...result, photo_url: photoUrl })
}
