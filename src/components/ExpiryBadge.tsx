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
      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-200 font-medium">
        ⚠️ 已過期
      </span>
    )
  }

  if (days <= 30) {
    return (
      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-red-50 text-red-600 border border-red-200 font-medium">
        🔴 {days} 天後到期
      </span>
    )
  }

  if (days <= 60) {
    return (
      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-orange-50 text-orange-600 border border-orange-200 font-medium">
        🟠 {days} 天後到期
      </span>
    )
  }

  return null
}
