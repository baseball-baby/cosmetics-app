import type { Metadata } from 'next'
import { Plus_Jakarta_Sans, Noto_Sans_TC } from 'next/font/google'
import '../globals.css'

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-heading',
  weight: ['400', '500', '600', '700'],
  display: 'swap',
})

const notoSansTC = Noto_Sans_TC({
  subsets: ['latin'],
  variable: '--font-body',
  weight: ['400', '500'],
  display: 'swap',
})

export const metadata: Metadata = {
  title: '後台管理 | Pouchy',
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-TW">
      <body className={`${plusJakartaSans.variable} ${notoSansTC.variable} antialiased font-sans bg-nude-50`}>
        {children}
      </body>
    </html>
  )
}
