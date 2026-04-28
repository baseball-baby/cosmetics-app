import type { Metadata } from 'next'
import '../globals.css'

export const metadata: Metadata = {
  title: '後台管理 | 化妝品管理',
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-TW">
      <body className="antialiased bg-nude-50">
        {children}
      </body>
    </html>
  )
}
