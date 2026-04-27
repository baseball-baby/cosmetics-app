'use client'

import { useState } from 'react'

export default function LoginPage() {
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    const res = await fetch('/api/user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim() }),
    })
    if (res.ok) {
      window.location.href = '/'
    } else {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-nude-50 px-4">
      <div className="bg-white rounded-3xl shadow-lg p-8 max-w-sm w-full space-y-6">
        <div className="text-center">
          <div className="text-6xl mb-4">💋</div>
          <h1 className="text-2xl font-bold text-nude-900">我的化妝品管理</h1>
          <p className="text-sm text-nude-500 mt-2">輸入你的名字開始使用</p>
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
            {saving ? '進入中…' : '開始使用 →'}
          </button>
        </form>
        <p className="text-xs text-nude-400 text-center">下次進來輸入一樣的名字就能找回你的資料</p>
      </div>
    </div>
  )
}
