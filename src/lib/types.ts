export type Category =
  | '粉底/遮瑕'
  | '眼影'
  | '眼線'
  | '睫毛膏'
  | '口紅/唇釉'
  | '腮紅/修容'
  | '打亮'
  | '眉筆'
  | '定妝'
  | '其他'

export const CATEGORY_EMOJIS: Record<string, string> = {
  '粉底/遮瑕': '🧴',
  '眼影': '👁️',
  '眼線': '✏️',
  '睫毛膏': '🖤',
  '口紅/唇釉': '💋',
  '腮紅/修容': '🌸',
  '打亮': '✨',
  '眉筆': '🤎',
  '定妝': '🫧',
  '其他': '🌞',
}

export const CATEGORIES: Category[] = [
  '粉底/遮瑕',
  '眼影',
  '眼線',
  '睫毛膏',
  '口紅/唇釉',
  '腮紅/修容',
  '打亮',
  '眉筆',
  '定妝',
  '其他',
]

export type ColorVerdict = '適合' | '偏黃' | '偏深' | '偏淺' | '偏冷' | '偏暖' | '不適合' | null

export interface Cosmetic {
  id: number
  brand: string
  name: string
  category: Category
  shade_name: string | null
  shade_description: string | null
  official_description: string | null
  official_positioning: string | null
  personal_notes: string | null
  expiry_date: string | null
  purchase_date: string | null
  price: number | null
  photo_url: string | null
  photo_urls: string | null
  color_verdict: ColorVerdict
  color_verdict_reason: string | null
  sub_tags: string | null
  color_data: string | null
  created_at: string
}

export interface ColorData {
  hex: string
  color_family: string
  finish: string
  is_expansion_color: boolean
  description: string
  user_override?: boolean
}

export interface ShadeNote {
  shade: string
  cosmetic_id?: number
  verdicts: ColorVerdict[]
}

export interface ColorProfile {
  id: number
  skin_tone_description: string | null
  skin_type: '乾性' | '油性' | '混合' | '中性' | null
  undertone: '暖調' | '冷調' | '中性' | null
  undertone_confidence: string | null
  depth: '亮膚' | '中淺' | '中' | '深' | null
  skin_concerns: string | null
  makeup_preferences: string | null
  suitable_foundation_shades: string | null
  color_analysis_summary: string | null
  analysis_photo_urls: string | null
  shade_notes: string | null
  updated_at: string
}

export interface ShadeAnalysis {
  id: number
  cosmetic_id: number | null
  photo_url: string | null
  ai_verdict: string
  ai_analysis: string
  is_current: boolean
  created_at: string
}
