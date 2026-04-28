'use client'

import { signIn } from 'next-auth/react'
import { useState } from 'react'

export default function LoginPage() {
  const [loading, setLoading] = useState(false)

  async function handleGoogleSignIn() {
    setLoading(true)
    await signIn('google', { callbackUrl: '/' })
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-nude-50 px-4">
      <div className="bg-white rounded-3xl shadow-lg p-8 max-w-sm w-full space-y-6">
        <div className="text-center">
          <div className="text-6xl mb-4">💋</div>
          <h1 className="text-2xl font-bold text-nude-900">我的化妝品管理</h1>
          <p className="text-sm text-nude-500 mt-2">用 Google 帳號登入</p>
        </div>
        <button
          onClick={handleGoogleSignIn}
          disabled={loading}
          className="w-full flex items-center justify-center gap-3 border border-nude-200 rounded-2xl py-3 px-4 text-sm font-medium text-nude-700 hover:bg-nude-50 transition-colors disabled:opacity-50"
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z" fill="#4285F4"/>
            <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z" fill="#34A853"/>
            <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z" fill="#FBBC05"/>
            <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58Z" fill="#EA4335"/>
          </svg>
          {loading ? '登入中…' : '使用 Google 登入'}
        </button>
      </div>
    </div>
  )
}
