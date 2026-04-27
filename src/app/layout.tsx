import type { Metadata } from 'next'
import './globals.css'
import Navigation from '@/components/Navigation'
import SessionProvider from '@/components/SessionProvider'
import AuthGuard from '@/components/AuthGuard'

export const metadata: Metadata = {
  title: '我的化妝品管理',
  description: '個人化妝品庫存管理與 AI 適色分析',
  icons: {
    icon: 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>💋</text></svg>',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-TW">
      <body className="antialiased">
        <SessionProvider>
          <AuthGuard />
          <Navigation />
          <main className="pb-20 md:pb-0 md:pl-64 min-h-screen">
            <div className="max-w-5xl mx-auto px-4 py-6">
              {children}
            </div>
          </main>
        </SessionProvider>
      </body>
    </html>
  )
}
