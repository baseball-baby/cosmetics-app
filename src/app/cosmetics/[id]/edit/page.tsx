import { notFound } from 'next/navigation'
import { getDb } from '@/lib/db'
import { Cosmetic } from '@/lib/types'
import CosmeticForm from '@/components/CosmeticForm'
import Link from 'next/link'

export default function EditCosmeticPage({ params }: { params: { id: string } }) {
  const db = getDb()
  const cosmetic = db.prepare('SELECT * FROM cosmetics WHERE id = ?').get(Number(params.id)) as Cosmetic | undefined
  if (!cosmetic) notFound()

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-3">
        <Link href={`/cosmetics/${params.id}`} className="text-nude-500 hover:text-nude-700">← 返回</Link>
        <h1 className="text-xl font-bold text-nude-900">編輯化妝品</h1>
      </div>
      <div className="card p-6">
        <CosmeticForm initial={cosmetic} />
      </div>
    </div>
  )
}
