import { ColorVerdict } from '@/lib/types'

interface Props {
  verdict: ColorVerdict
  size?: 'sm' | 'md'
}

export default function ColorVerdictBadge({ verdict, size = 'sm' }: Props) {
  if (!verdict) return null

  const config: Record<string, { icon: string; label: string; className: string }> = {
    適合: { icon: '✅', label: '適合', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    偏黃: { icon: '⚠️', label: '偏黃', className: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
    偏深: { icon: '⚠️', label: '偏深', className: 'bg-amber-50 text-amber-700 border-amber-200' },
    偏淺: { icon: '⚠️', label: '偏淺', className: 'bg-orange-50 text-orange-700 border-orange-200' },
    偏冷: { icon: '⚠️', label: '偏冷', className: 'bg-blue-50 text-blue-700 border-blue-200' },
    偏暖: { icon: '⚠️', label: '偏暖', className: 'bg-rose-50 text-rose-700 border-rose-200' },
    不適合: { icon: '❌', label: '不適合', className: 'bg-red-50 text-red-700 border-red-200' },
  }

  const style = config[verdict] || config['不適合']
  const sizeClass = size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-sm px-3 py-1'

  return (
    <span className={`inline-flex items-center gap-1 rounded-full border font-medium ${sizeClass} ${style.className}`}>
      <span>{style.icon}</span>
      {style.label}
    </span>
  )
}
