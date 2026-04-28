import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/db'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const DEFAULT_BRANDS = ['NARS', 'MAC', 'YSL', '資生堂', 'CLIO']

async function searchTavily(query: string, maxResults = 3) {
  try {
    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: process.env.TAVILY_API_KEY,
        query,
        search_depth: 'basic',
        max_results: maxResults,
      }),
    })
    const data = await res.json()
    return (data.results || []) as { title: string; content: string }[]
  } catch {
    return []
  }
}

export async function POST(req: NextRequest) {
  const userId = req.cookies.get('cosmetics_user')?.value
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { photos, trial_shades, user_brands } = body as {
    photos: Array<{ url: string; shades: string }>
    trial_shades?: Array<{ brand: string; product: string; shade_name: string; verdicts: string[] }>
    user_brands?: string[]
  }

  if (!photos || photos.length === 0) {
    return NextResponse.json({ error: 'photos required' }, { status: 400 })
  }

  // Validate photos
  type ContentBlock = Anthropic.TextBlockParam | Anthropic.ImageBlockParam
  const content: ContentBlock[] = []
  const validPhotos: Array<{ url: string; shades: string }> = []
  for (const photo of photos) {
    if (photo.url && photo.url.startsWith('http')) {
      content.push({ type: 'image', source: { type: 'url', url: photo.url } })
      validPhotos.push(photo)
    }
  }
  if (validPhotos.length === 0) {
    return NextResponse.json({ error: 'No valid photos' }, { status: 400 })
  }

  // Brands for shade table
  const brandsToResearch = (user_brands && user_brands.length > 0)
    ? user_brands.slice(0, 5)
    : DEFAULT_BRANDS

  // Only research shades the user explicitly marked as 適合 (have real shade names)
  const suitableShades = (trial_shades || []).filter(
    ts => ts.verdicts?.includes('適合') && ts.brand.trim() && ts.shade_name.trim()
  )

  // Run all Tavily searches in parallel
  const [shadeResults, brandResults] = await Promise.all([
    Promise.all(suitableShades.map(async ts => {
      const q = `${ts.brand} ${ts.product || ''} ${ts.shade_name} shade undertone warm cool neutral color`
      const r = await searchTavily(q, 3)
      return { ts, snippet: r.map(x => `${x.title}: ${x.content}`).join('\n').slice(0, 400) }
    })),
    Promise.all(brandsToResearch.map(async brand => {
      const q = `${brand} foundation shade range light medium warm neutral cool skin tone`
      const r = await searchTavily(q, 3)
      return { brand, snippet: r.map(x => `${x.title}: ${x.content}`).join('\n').slice(0, 400) }
    })),
  ])

  // Build context strings for prompt
  const shadeResearchCtx = shadeResults
    .filter(s => s.snippet)
    .map(s => `【${s.ts.brand} ${s.ts.shade_name} 官方資料】\n${s.snippet}`)
    .join('\n\n')

  const brandResearchCtx = brandResults
    .filter(b => b.snippet)
    .map(b => `【${b.brand} 色號資料】\n${b.snippet}`)
    .join('\n\n')

  const trialShadeCtx = (trial_shades || [])
    .filter(ts => ts.brand.trim())
    .map(ts =>
      `- ${[ts.brand, ts.product, ts.shade_name].filter(Boolean).join(' ')}：使用者評為「${ts.verdicts?.length > 0 ? ts.verdicts.join('、') : '未評'}」`
    ).join('\n')

  const hasPhotoShades = validPhotos.some(p => p.shades && p.shades.trim())
  const photoCtx = validPhotos.map((p, i) =>
    `照片${i + 1}：${p.shades ? '色號 ' + p.shades : '未標記'}`
  ).join('\n')

  const promptText = `你是一位專業彩妝色彩顧問。請根據上傳的照片和以下資訊，分析使用者的膚色特徵，並生成品牌色號推薦表。

${hasPhotoShades ? `【照片說明】\n${photoCtx}\n\n` : ''}${trialShadeCtx ? `【使用者試色記錄】\n${trialShadeCtx}\n\n` : ''}${shadeResearchCtx ? `【色號調性參考資料】（必須根據此資料判斷色號冷暖，禁止從使用者的「適合」評價直接推斷色號調性）\n${shadeResearchCtx}\n\n` : ''}

⚠️ 分析規則（必須遵守）：
1. 色號的冷暖調性必須來自官方資料或你的知識庫，絕對不可以因為使用者說「適合」就推斷該色號是暖調或冷調。
2. 若使用者說 B 系冷調色號適合，正確說法是：「你的膚色偏中性或具備冷暖兼容的特性，因此 B 系色號也能自然融合」，而非「B10 是暖調色號」。
3. color_analysis_summary 說明膚色特徵與適合的整體色調方向，不提具體品牌或色號（留給 brand_shade_table）。
4. 品牌色號推薦必須根據查到的真實色號，若資料不足可依膚色特性推測，但不得捏造不存在的色號。

【品牌色號對照表】
根據分析結果和以下品牌資料，為每個品牌各推薦：最適合色號、備選色號、建議避開色號。
品牌：${brandsToResearch.join('、')}

${brandResearchCtx ? `品牌色號資料：\n${brandResearchCtx}\n` : ''}

請以 JSON 格式回傳（繁體中文）：
{
  "shade_analyses": [
    ${hasPhotoShades ? '{ "shade": "色號名稱", "verdict": "色號剛好" | "偏黃" | "偏深" | "偏淺" | "偏冷" | "偏暖", "analysis": "說明（30-60字）" }' : ''}
  ],
  "undertone": "暖調" | "冷調" | "中性",
  "undertone_confidence": "判定依據（30-60字）",
  "depth": "亮膚" | "中淺" | "中" | "深",
  "color_analysis_summary": "整體膚色分析（120-200字），說明膚色特徵與適合的色調方向，不提具體品牌色號",
  "brand_shade_table": [
    {
      "brand": "品牌名稱",
      "recommended": "推薦色號名稱",
      "alternative": "備選色號名稱（沒有填空字串）",
      "avoid": "建議避開色號名稱（沒有填空字串）",
      "notes": "說明（15-30字）"
    }
  ]
}

只回傳 JSON，不要其他文字。`

  content.push({ type: 'text', text: promptText })

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2500,
    messages: [{ role: 'user', content }],
  })

  const raw = (response.content[0] as Anthropic.TextBlock).text.trim()
  let result: {
    shade_analyses: Array<{ shade: string; verdict: string; analysis: string }>
    undertone: string
    undertone_confidence: string
    depth: string
    color_analysis_summary: string
    brand_shade_table: Array<{ brand: string; recommended: string; alternative: string; avoid: string; notes: string }>
  }

  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    result = JSON.parse(jsonMatch ? jsonMatch[0] : raw)
  } catch {
    return NextResponse.json({ error: 'AI analysis failed', raw }, { status: 500 })
  }

  const photoUrls = validPhotos.map(p => p.url)

  const suitableFoundation: Record<string, { verdict: string; analysis: string }> = {}
  for (const a of result.shade_analyses || []) {
    if (a.shade && a.shade !== 'undefined') {
      suitableFoundation[a.shade] = { verdict: a.verdict, analysis: a.analysis }
    }
  }

  // Save analysis to user_profiles
  await supabase.from('user_profiles').upsert({
    user_id: userId,
    undertone: result.undertone,
    undertone_confidence: result.undertone_confidence,
    depth: result.depth,
    color_analysis_summary: result.color_analysis_summary,
    suitable_foundation_shades: JSON.stringify(suitableFoundation),
    analysis_photo_urls: JSON.stringify(photoUrls),
    brand_shade_table: JSON.stringify(result.brand_shade_table || []),
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' })

  // Merge trial shades into shade_notes (dedup)
  if (trial_shades && trial_shades.some(ts => ts.brand.trim())) {
    const newNotes = trial_shades
      .filter(ts => ts.brand.trim())
      .map(ts => ({
        shade: [ts.brand.trim(), ts.product.trim(), ts.shade_name.trim()].filter(Boolean).join(' '),
        verdicts: ts.verdicts || [],
      }))

    const { data: existing } = await supabase
      .from('user_profiles').select('shade_notes').eq('user_id', userId).maybeSingle()
    try {
      const prev: Array<{ shade: string }> = existing?.shade_notes ? JSON.parse(existing.shade_notes) : []
      const prevShades = new Set(prev.map((n) => n.shade))
      const merged = [...prev, ...newNotes.filter(n => !prevShades.has(n.shade))]
      await supabase.from('user_profiles').update({ shade_notes: JSON.stringify(merged) }).eq('user_id', userId)
    } catch {}
  }

  // Save individual shade analyses
  await supabase.from('shade_analyses').update({ is_current: 0 }).is('cosmetic_id', null).eq('user_id', userId)
  for (const a of result.shade_analyses || []) {
    const idx = validPhotos.findIndex(p => p.shades && p.shades.includes(a.shade))
    await supabase.from('shade_analyses').insert({
      user_id: userId,
      cosmetic_id: null,
      photo_url: (idx >= 0 ? validPhotos[idx] : validPhotos[0])?.url || null,
      ai_verdict: a.verdict,
      ai_analysis: a.analysis,
      is_current: 1,
    })
  }

  return NextResponse.json({
    undertone: result.undertone,
    depth: result.depth,
    color_analysis_summary: result.color_analysis_summary,
    shade_analyses: result.shade_analyses,
    brand_shade_table: result.brand_shade_table,
  })
}
