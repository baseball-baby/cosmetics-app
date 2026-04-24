import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const POPULAR_BRANDS = [
  'NARS', 'MAC', 'Chanel', 'Dior', 'YSL', 'Yves Saint Laurent',
  'Giorgio Armani', 'Armani Beauty', 'Shiseido', '資生堂', 'SKII', 'SK-II',
  'KATE', 'RMK', 'SUQQU', 'IPSA', 'ADDICTION', 'LUNASOL', 'KANEBO',
  "Clé de Peau", 'COSME DECORTÉ', 'THREE', 'Laneige', '蘭芝',
  'Innisfree', 'Missha', 'CLIO', 'Rom&nd', 'Hera', 'Sulwhasoo',
  'Etude House', 'Etude', 'Pony Effect', 'Fenty Beauty', 'Too Faced',
  'Urban Decay', 'Charlotte Tilbury', 'Laura Mercier', 'Bobbi Brown',
  'Estée Lauder', 'Lancome', 'Lancôme', 'Givenchy', 'Guerlain', 'Clarins',
  'Benefit', 'NYX', 'Maybelline', "L'Oréal", 'Revlon', 'KIKO',
  'Clinique', 'Kosas', 'Rare Beauty', 'Milk Makeup', 'Glossier',
  'ColourPop', 'Morphe', 'Pat McGrath', 'Hourglass', 'Anastasia Beverly Hills',
  'Tarte', 'CEZANNE', 'Canmake', 'Kissme', 'Integrate', 'EXCEL',
  'Fasio', 'Majolica Majorca', 'RIMMEL', 'Catrice', 'Essence',
  'Huda Beauty', 'Make Up For Ever', 'MUFE', 'Holika Holika',
  'The Saem', 'Peripera', "A'PIEU", 'Etude',
  '肌膚之鑰', 'Pola', 'Albion', 'Shu Uemura', 'JILL STUART', 'Paul & Joe',
  'Anna Sui', 'Etvos', 'Amplitude', 'Whomee', 'FLOWFUSHI',
]

async function searchTavily(query: string, maxResults = 5) {
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
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const type = searchParams.get('type')
  const q = searchParams.get('q')?.trim() || ''
  const brand = searchParams.get('brand')?.trim() || ''

  if (!q || q.length < 2) return NextResponse.json([])

  // Brand autocomplete
  if (type === 'brand') {
    const lower = q.toLowerCase()
    const local = POPULAR_BRANDS.filter((b) =>
      b.toLowerCase().includes(lower)
    ).slice(0, 8)

    if (local.length >= 3) return NextResponse.json(local)

    // Fall back to Tavily if local results are sparse
    try {
      const results = await searchTavily(`${q} makeup cosmetics brand name`, 3)
      const snippets = results.map((r) => `${r.title}\n${r.content}`).join('\n\n').slice(0, 2000)
      const resp = await client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 200,
        messages: [{
          role: 'user',
          content: `From these search results, extract up to 5 real makeup/cosmetics brand names that match or are related to "${q}". Return ONLY a JSON array of strings, e.g. ["NARS", "Fenty Beauty"]. No explanation.\n\n${snippets}`,
        }],
      })
      const text = (resp.content[0] as Anthropic.TextBlock).text.trim()
      const match = text.match(/\[[\s\S]*\]/)
      const extra: string[] = match ? JSON.parse(match[0]) : []
      const combined = [...local, ...extra]
      const merged = combined.filter((v, i) => combined.indexOf(v) === i).slice(0, 8)
      return NextResponse.json(merged)
    } catch {
      return NextResponse.json(local)
    }
  }

  // Product autocomplete (requires brand)
  if (type === 'product' && brand) {
    try {
      const results = await searchTavily(`${brand} ${q} makeup product cosmetics`, 5)
      const snippets = results.map((r) => `${r.title}\n${r.content}`).join('\n\n').slice(0, 3000)

      const resp = await client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 400,
        messages: [{
          role: 'user',
          content: `From these search results about "${brand}" cosmetics, extract up to 8 real product names matching or related to "${q}".

Return ONLY a JSON array: [{"name": "...", "category": "..."}]
Category must be one of: 粉底/遮瑕, 眼影, 眼線, 睫毛膏, 口紅/唇釉, 腮紅/修容, 打亮, 眉筆, 定妝, 其他
Only include real products. If none match, return [].

Search results:
${snippets}`,
        }],
      })
      const text = (resp.content[0] as Anthropic.TextBlock).text.trim()
      const match = text.match(/\[[\s\S]*\]/)
      return NextResponse.json(match ? JSON.parse(match[0]) : [])
    } catch {
      return NextResponse.json([])
    }
  }

  return NextResponse.json([])
}
