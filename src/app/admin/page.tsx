'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

interface UserStat {
  user_id: string
  cosmetics_count: number
  category_counts: Record<string, number>
  has_profile: boolean
  undertone: string | null
  depth: string | null
  analyses_count: number
  feedback_count: number
  last_activity: string | null
}

export default function AdminPage() {
  const router = useRouter()
  const [users, setUsers] = useState<UserStat[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/admin/users')
      .then(r => {
        if (r.status === 401) { router.push('/admin/login'); return null }
        return r.json()
      })
      .then(data => { if (data) { setUsers(data); setLoading(false) } })
  }, [router])

  const totalCosmetics = users.reduce((s, u) => s + u.cosmetics_count, 0)
  const usersWithProfile = users.filter(u => u.has_profile).length

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-blush-400 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-nude-50 p-4 sm:p-8">
      <div className="max-w-4xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-nude-900">後台管理 🗂️</h1>
            <p className="text-sm text-nude-500 mt-0.5">所有用戶數據總覽</p>
          </div>
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white rounded-2xl p-4 text-center border border-nude-100">
            <p className="text-2xl font-bold text-blush-600">{users.length}</p>
            <p className="text-xs text-nude-500 mt-0.5">用戶總數</p>
          </div>
          <div className="bg-white rounded-2xl p-4 text-center border border-nude-100">
            <p className="text-2xl font-bold text-nude-700">{totalCosmetics}</p>
            <p className="text-xs text-nude-500 mt-0.5">化妝品總件數</p>
          </div>
          <div className="bg-white rounded-2xl p-4 text-center border border-nude-100">
            <p className="text-2xl font-bold text-emerald-600">{usersWithProfile}</p>
            <p className="text-xs text-nude-500 mt-0.5">已完成膚況分析</p>
          </div>
        </div>

        {/* User list */}
        <div className="space-y-3">
          {users.length === 0 ? (
            <div className="bg-white rounded-2xl p-8 text-center text-nude-400 border border-nude-100">
              還沒有任何用戶
            </div>
          ) : (
            users.map(u => (
              <Link
                key={u.user_id}
                href={`/admin/users/${encodeURIComponent(u.user_id)}`}
                className="block bg-white rounded-2xl p-4 border border-nude-100 hover:border-blush-200 hover:shadow-sm transition-all"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-2 flex-1 min-w-0">
                    {/* Name + profile badge */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-nude-800">{u.user_id}</span>
                      {u.has_profile && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-blush-50 text-blush-600 font-medium">
                          {u.undertone} · {u.depth}
                        </span>
                      )}
                    </div>

                    {/* Stats row */}
                    <div className="flex flex-wrap gap-3 text-xs text-nude-500">
                      <span>💄 {u.cosmetics_count} 件化妝品</span>
                      {u.analyses_count > 0 && <span>🔬 {u.analyses_count} 次色號分析</span>}
                      {u.feedback_count > 0 && <span>💬 {u.feedback_count} 則回饋</span>}
                    </div>

                    {/* Category breakdown */}
                    {Object.keys(u.category_counts).length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {Object.entries(u.category_counts).map(([cat, count]) => (
                          <span key={cat} className="text-xs px-2 py-0.5 bg-nude-50 rounded-full text-nude-600">
                            {cat} {count}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="text-right flex-shrink-0">
                    {u.last_activity && (
                      <p className="text-xs text-nude-400">
                        {new Date(u.last_activity).toLocaleDateString('zh-TW')}
                      </p>
                    )}
                    <span className="text-nude-300 text-sm mt-1 inline-block">→</span>
                  </div>
                </div>
              </Link>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
