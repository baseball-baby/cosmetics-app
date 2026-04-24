import CosmeticForm from '@/components/CosmeticForm'
import Link from 'next/link'

export default function NewCosmeticPage() {
  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-3">
        <Link href="/" className="text-nude-500 hover:text-nude-700">← 返回</Link>
        <h1 className="text-xl font-bold text-nude-900">新增化妝品</h1>
      </div>
      <div className="card p-6">
        <CosmeticForm />
      </div>
    </div>
  )
}
