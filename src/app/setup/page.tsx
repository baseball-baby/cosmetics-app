'use client'

import { useState } from 'react'
import { useSession } from 'next-auth/react'

export default function SetupPage() {
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const { data: session } = useSession()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    await fetch('/api/user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ display_name: name.trim() }),
    })
    // Full reload to get fresh session with new displayName
    window.location.href = '/'
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-nude-50 px-4">
      <div className="bg-white rounded-3xl shadow-lg p-8 max-w-sm w-full space-y-6">
        <div className="text-center">
          <div className="text-6xl mb-4">💋</div>
          <h1 className="text-2xl font-bold text-nude-900">歡迎！</h1>
          {session?.user?.email && (
            <p className="text-xs text-nude-400 mt-1">{session.user.email}</p>
          )}
          <p className="text-sm text-nude-500 mt-2">請輸入你的名字，之後 AI 會用來跟你打招呼</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            className="input-field text-center text-lg"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="你的名字"
            autoFocus
            maxLength={20}
          />
          <button
            type="submit"
            className="btn-primary w-full"
            disabled={saving || !name.trim()}
          >
            {saving ? '設定中…' : '開始使用 →'}
          </button>
        </form>
      </div>
    </div>
  )
}
