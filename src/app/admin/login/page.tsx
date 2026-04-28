'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function AdminLoginPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    })
    setLoading(false)
    if (res.ok) {
      router.push('/admin')
    } else {
      setError('密碼錯誤')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-nude-50 p-4">
      <div className="bg-white rounded-2xl shadow-sm border border-nude-100 p-8 w-full max-w-sm space-y-6">
        <div className="text-center">
          <div className="text-4xl mb-3">🔐</div>
          <h1 className="text-xl font-bold text-nude-900">後台管理</h1>
          <p className="text-sm text-nude-500 mt-1">請輸入管理員密碼</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="密碼"
            className="input-field w-full"
            autoFocus
          />
          {error && <p className="text-xs text-red-500">{error}</p>}
          <button type="submit" disabled={loading || !password} className="btn-primary w-full">
            {loading ? '驗證中…' : '進入後台'}
          </button>
        </form>
      </div>
    </div>
  )
}
