import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { getDb, UPLOADS_DIR_PATH } from '@/lib/db'
import type { ColorData } from '@/lib/types'
import fs from 'fs'
import path from 'path'

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

function readImageBase64(photoUrl: string): { mediaType: 'image/jpeg' | 'image/png' | 'image/webp'; data: string } | null {
  try {
    const filename = photoUrl.replace(/^\/uploads\//, '')
    const filePath = path.join(UPLOADS_DIR_PATH, filename)
    const buffer = fs.readFileSync(filePath)
    const ext = path.extname(photoUrl).toLowerCase()
    const mediaType = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg'
    return { mediaType, data: buffer.toString('base64') }
  } catch {
    return null
  }
}

const COLOR_FAMILIES = '裸色系/玫瑰紅/橘色系/珊瑚色/莓果色/正紅色/酒紅色/大地色/粉色系/棕色系/紫色系/磚紅色'
const FINISHES = '霧面/緞面/亮面/珠光/玻璃唇'

async function analyzeByVision(product: ProductRow): Promise<ColorData | null> {
  const img = readImageBase64(product.photo_url!)
  if (!img) return null

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 200,
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: img.mediaType, data: img.data } },
        {
          type: 'text',
          text: `這是「${product.brand} ${product.name}${product.shade_name ? ` / ${product.shade_name}` : ''}」的照片。
請根據照片中實際看到的顏色分析（不要靠產品名稱猜測），回傳 JSON（繁體中文）：
{"hex":"#XXXXXX","color_family":"${COLOR_FAMILIES} 其中一個","finish":"${FINISHES} 其中一個","is_expansion_color":true或false（亮/暖/淺色為true，深/冷色為false）,"description":"一句描述（15字內）"}
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

// POST: analyze products by IDs, save results to DB
export async function POST(req: NextRequest) {
  const { ids } = await req.json() as { ids: number[] }
  if (!ids?.length) return NextResponse.json({ error: 'ids required' }, { status: 400 })

  const db = getDb()
  const placeholders = ids.map(() => '?').join(', ')
  const products = db.prepare(
    `SELECT id, brand, name, category, shade_name, shade_description, photo_url FROM cosmetics WHERE id IN (${placeholders})`
  ).all(...ids) as ProductRow[]

  const withPhotos = products.filter((p) => p.photo_url)
  const withoutPhotos = products.filter((p) => !p.photo_url)

  // Vision analysis in parallel, chunks of 5
  const allResults = new Map<number, ColorData>()
  for (let i = 0; i < withPhotos.length; i += 5) {
    const chunk = withPhotos.slice(i, i + 5)
    const results = await Promise.all(chunk.map((p) => analyzeByVision(p)))
    chunk.forEach((p, idx) => { if (results[idx]) allResults.set(p.id, results[idx]!) })
  }

  // Text fallback for products without photos
  const textResults = await analyzeByText(withoutPhotos)
  textResults.forEach((v, k) => allResults.set(k, v))

  // Save to DB
  for (const [id, data] of Array.from(allResults.entries())) {
    db.prepare('UPDATE cosmetics SET color_data = ? WHERE id = ?').run(JSON.stringify(data), id)
  }

  return NextResponse.json({ analyzed: allResults.size })
}

// PATCH: user override for a single product
export async function PATCH(req: NextRequest) {
  const { id, data } = await req.json() as { id: number; data: ColorData }
  const db = getDb()
  db.prepare('UPDATE cosmetics SET color_data = ? WHERE id = ?').run(
    JSON.stringify({ ...data, user_override: true }),
    id
  )
  return NextResponse.json({ ok: true })
}

// GET: summary/gaps from existing color_data in DB
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const category = searchParams.get('category') || 'all'
  const db = getDb()

  const cats = category === 'all' ? ['口紅/唇釉', '腮紅/修容'] : [category]
  const placeholders = cats.map(() => '?').join(', ')
  const rows = db.prepare(
    `SELECT brand, name, shade_name, category, color_data FROM cosmetics WHERE category IN (${placeholders}) AND color_data IS NOT NULL`
  ).all(...cats) as { brand: string; name: string; shade_name: string | null; category: string; color_data: string }[]

  if (rows.length < 2) return NextResponse.json({ summary: '', gaps: '' })

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
