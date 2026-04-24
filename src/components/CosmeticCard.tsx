'use client'

import Link from 'next/link'
import Image from 'next/image'
import { Cosmetic, CATEGORY_EMOJIS } from '@/lib/types'
import ColorVerdictBadge from './ColorVerdictBadge'
import ExpiryBadge from './ExpiryBadge'

interface Props {
  cosmetic: Cosmetic
  view: 'grid' | 'list'
  onOpen?: () => void
}

const categoryColors: Record<string, string> = {
  '粉底/遮瑕': 'bg-nude-100 text-nude-700',
  '眼影': 'bg-purple-50 text-purple-600',
  '眼線': 'bg-gray-100 text-gray-700',
  '睫毛膏': 'bg-slate-100 text-slate-700',
  '口紅/唇釉': 'bg-rose-50 text-rose-600',
  '腮紅/修容': 'bg-pink-50 text-pink-600',
  '打亮': 'bg-yellow-50 text-yellow-600',
  '眉筆': 'bg-amber-50 text-amber-700',
  '定妝': 'bg-violet-50 text-violet-600',
  '其他': 'bg-nude-50 text-nude-600',
}

function CategoryEmoji({ category }: { category: string }) {
  return <span>{CATEGORY_EMOJIS[category] || '🌞'}</span>
}

export default function CosmeticCard({ cosmetic, view, onOpen }: Props) {
  const primaryPhoto = cosmetic.photo_url

  if (view === 'list') {
    const inner = (
      <div className="flex items-center gap-3 px-4 py-3 hover:bg-nude-50 transition-colors cursor-pointer">
        <div className="w-11 h-11 rounded-lg overflow-hidden flex-shrink-0 bg-nude-100">
          {primaryPhoto ? (
            <Image src={primaryPhoto} alt={cosmetic.name} width={44} height={44} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-xl">
              <CategoryEmoji category={cosmetic.category} />
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-xs text-blush-500 font-medium truncate leading-tight">{cosmetic.brand}</p>
          <p className="text-sm font-medium text-nude-900 truncate leading-snug">{cosmetic.name}</p>
          {cosmetic.shade_name && (
            <p className="text-xs text-nude-400 truncate leading-tight">{cosmetic.shade_name}</p>
          )}
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {cosmetic.color_verdict && <ColorVerdictBadge verdict={cosmetic.color_verdict} />}
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${categoryColors[cosmetic.category] || 'bg-nude-100 text-nude-600'}`}>
            {cosmetic.category}
          </span>
        </div>
      </div>
    )
    if (onOpen) return <div onClick={onOpen}>{inner}</div>
    return <Link href={`/cosmetics/${cosmetic.id}`}>{inner}</Link>
  }

  const gridInner = (
      <div className="card hover:shadow-md transition-shadow cursor-pointer h-full flex flex-col">
        <div className="relative aspect-square bg-nude-100">
          {primaryPhoto ? (
            <Image src={primaryPhoto} alt={cosmetic.name} fill className="object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-5xl">
              <CategoryEmoji category={cosmetic.category} />
            </div>
          )}
          <div className="absolute top-2 left-2">
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${categoryColors[cosmetic.category] || 'bg-nude-100 text-nude-600'}`}>
              {cosmetic.category}
            </span>
          </div>
          {cosmetic.color_verdict && (
            <div className="absolute top-2 right-2">
              <ColorVerdictBadge verdict={cosmetic.color_verdict} />
            </div>
          )}
        </div>

        <div className="p-3 flex-1 flex flex-col gap-1">
          <p className="text-xs text-nude-500">{cosmetic.brand}</p>
          <p className="font-medium text-sm text-nude-900 leading-tight">{cosmetic.name}</p>
          {cosmetic.shade_name && (
            <p className="text-xs text-nude-500">{cosmetic.shade_name}</p>
          )}
          <div className="mt-auto pt-2">
            <ExpiryBadge expiryDate={cosmetic.expiry_date} />
          </div>
        </div>
      </div>
  )
  if (onOpen) return <div onClick={onOpen}>{gridInner}</div>
  return <Link href={`/cosmetics/${cosmetic.id}`}>{gridInner}</Link>
}
