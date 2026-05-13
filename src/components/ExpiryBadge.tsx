interface Props {
  expiryDate: string | null
}

export function getDaysUntilExpiry(expiryDate: string | null): number | null {
  if (!expiryDate) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const expiry = new Date(expiryDate)
  expiry.setHours(0, 0, 0, 0)
  return Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}

export default function ExpiryBadge({ expiryDate }: Props) {
  const days = getDaysUntilExpiry(expiryDate)
  if (days === null) return null

  if (days < 0) {
    return (
      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-blush-100 text-blush-700 border border-blush-200 font-medium">
        ⚠️ 已過期
      </span>
    )
  }

  if (days <= 30) {
    return (
      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-blush-50 text-blush-600 border border-blush-200 font-medium">
        🌸 {days} 天後到期
      </span>
    )
  }

  if (days <= 60) {
    return (
      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-nude-100 text-nude-500 border border-nude-200 font-medium">
        🌷 {days} 天後到期
      </span>
    )
  }

  return null
}
