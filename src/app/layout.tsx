import type { Metadata } from 'next'
import './globals.css'
import Navigation from '@/components/Navigation'

export const metadata: Metadata = {
  title: '我的化妝品管理',
  description: '個人化妝品庫存管理與 AI 適色分析',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-TW">
      <body className="antialiased">
        <Navigation />
        <main className="pb-20 md:pb-0 md:pl-64 min-h-screen">
          <div className="max-w-5xl mx-auto px-4 py-6">
            {children}
          </div>
        </main>
      </body>
    </html>
  )
}
