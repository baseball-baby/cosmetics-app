import { notFound } from 'next/navigation'
import { cookies } from 'next/headers'
import { supabase } from '@/lib/db'
import { Cosmetic } from '@/lib/types'
import CosmeticForm from '@/components/CosmeticForm'
import Link from 'next/link'

export default async function EditCosmeticPage({ params }: { params: { id: string } }) {
  const cookieStore = cookies()
  const userId = cookieStore.get('cosmetics_user')?.value

  if (!userId) notFound()

  const { data: cosmetic } = await supabase
    .from('cosmetics')
    .select('*')
    .eq('id', Number(params.id))
    .eq('user_id', userId)
    .maybeSingle()

  if (!cosmetic) notFound()

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-3">
        <Link href={`/cosmetics/${params.id}`} className="text-nude-500 hover:text-nude-700">← 返回</Link>
        <h1 className="text-xl font-bold text-nude-900">編輯化妝品</h1>
      </div>
      <div className="card p-6">
        <CosmeticForm initial={cosmetic as Cosmetic} />
      </div>
    </div>
  )
}
