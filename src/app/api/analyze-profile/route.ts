import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/db'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  const userId = req.cookies.get('cosmetics_user')?.value
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { photos, shade_notes } = body as {
    photos: Array<{ url: string; shades: string }>
    shade_notes?: Array<{ shade: string; verdicts: string[] }>
  }

  if (!photos || photos.length === 0) {
    return NextResponse.json({ error: 'photos required' }, { status: 400 })
  }

  type ContentBlock = Anthropic.TextBlockParam | Anthropic.ImageBlockParam
  const content: ContentBlock[] = []

  const validPhotos: Array<{ url: string; shades: string }> = []
  for (const photo of photos) {
    if (photo.url && photo.url.startsWith('http')) {
      content.push({
        type: 'image',
        source: { type: 'url', url: photo.url },
      })
      validPhotos.push(photo)
    }
  }

  if (validPhotos.length === 0) {
    return NextResponse.json({ error: 'No valid photos' }, { status: 400 })
  }

  const hasShades = validPhotos.some((p) => p.shades && p.shades.trim())

  const shadeNotesContext = shade_notes && shade_notes.length > 0
    ? `\n\n使用者已提供以下底妝試色記錄供參考：\n${shade_notes.map((n) => `- ${n.shade}：${n.verdicts.join('、')}`).join('\n')}`
    : ''

  let promptText: string
  if (hasShades) {
    const photoDescriptions = validPhotos.map((p, i) => `照片${i + 1}：色號 ${p.shades || '未標記'}`).join('\n')
    promptText = `你是一位專業彩妝色彩顧問，我上傳了幾張底妝試色照片。請仔細分析每張照片中的底妝色號與我的膚色是否相符。

照片說明：
${photoDescriptions}${shadeNotesContext}

請以 JSON 格式回傳以下分析結果：
{
  "shade_analyses": [
    {
      "shade": "色號名稱",
      "verdict": "色號剛好" | "偏黃" | "偏深" | "偏淺" | "偏冷" | "偏暖",
      "analysis": "詳細說明（50-100字）"
    }
  ],
  "undertone": "暖調" | "冷調" | "中性",
  "undertone_confidence": "判定說明（說明根據哪些觀察得出此結論，30-60字）",
  "depth": "亮膚" | "中淺" | "中" | "深",
  "color_analysis_summary": "整體色彩分析總結（150-250字），說明使用者的膚色特徵、適合哪類顏色、哪些顏色要避免，要具體提到口紅/腮紅/眼影/底妝的適合色調"
}

只回傳 JSON，不要其他文字。`
  } else {
    promptText = `你是一位專業彩妝色彩顧問，我上傳了幾張照片（可能是素顏或日常妝照）。請仔細觀察照片中的膚色，分析我的冷暖色調和深淺。${shadeNotesContext}

請以 JSON 格式回傳以下分析結果：
{
  "shade_analyses": [],
  "undertone": "暖調" | "冷調" | "中性",
  "undertone_confidence": "判定說明（說明根據哪些觀察得出此結論，30-60字）",
  "depth": "亮膚" | "中淺" | "中" | "深",
  "color_analysis_summary": "整體色彩分析總結（150-250字），說明使用者的膚色特徵、適合哪類顏色、哪些顏色要避免，要具體提到口紅/腮紅/眼影/底妝的適合色調"
}

只回傳 JSON，不要其他文字。`
  }

  content.push({ type: 'text', text: promptText })

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1500,
    messages: [{ role: 'user', content }],
  })

  const text = (response.content[0] as Anthropic.TextBlock).text.trim()
  let result: {
    shade_analyses: Array<{ shade: string; verdict: string; analysis: string }>
    undertone: string
    undertone_confidence: string
    depth: string
    color_analysis_summary: string
  }

  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    result = JSON.parse(jsonMatch ? jsonMatch[0] : text)
  } catch {
    return NextResponse.json({ error: 'AI analysis failed', raw: text }, { status: 500 })
  }

  const photoUrls = validPhotos.map((p) => p.url)

  const suitableFoundation: Record<string, { verdict: string; analysis: string }> = {}
  for (const analysis of result.shade_analyses) {
    const key = analysis.shade || (analysis as Record<string, string>).name || String(analysis)
    if (key && typeof key === 'string' && key !== 'undefined') {
      suitableFoundation[key] = { verdict: analysis.verdict, analysis: analysis.analysis }
    }
  }

  await supabase.from('user_profiles').upsert({
    user_id: userId,
    undertone: result.undertone,
    undertone_confidence: result.undertone_confidence,
    depth: result.depth,
    color_analysis_summary: result.color_analysis_summary,
    suitable_foundation_shades: JSON.stringify(suitableFoundation),
    analysis_photo_urls: JSON.stringify(photoUrls),
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' })

  await supabase
    .from('shade_analyses')
    .update({ is_current: 0 })
    .is('cosmetic_id', null)
    .eq('user_id', userId)

  for (const analysis of result.shade_analyses) {
    const photoIdx = validPhotos.findIndex((p) => p.shades && p.shades.includes(analysis.shade))
    const photoUrl = photoIdx >= 0 ? validPhotos[photoIdx]?.url : validPhotos[0]?.url

    await supabase.from('shade_analyses').insert({
      user_id: userId,
      cosmetic_id: null,
      photo_url: photoUrl || null,
      ai_verdict: analysis.verdict,
      ai_analysis: analysis.analysis,
      is_current: 1,
    })
  }

  return NextResponse.json({
    undertone: result.undertone,
    depth: result.depth,
    color_analysis_summary: result.color_analysis_summary,
    shade_analyses: result.shade_analyses,
  })
}
