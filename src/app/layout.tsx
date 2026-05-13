import type { Metadata } from 'next'
import { Plus_Jakarta_Sans, Noto_Sans_TC, DM_Mono } from 'next/font/google'
import './globals.css'
import Navigation from '@/components/Navigation'
import SessionProviderWrapper from '@/components/SessionProviderWrapper'

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

const dmMono = DM_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  weight: ['400', '500'],
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Pouchy',
  description: '你的化妝品管理閨蜜',
  icons: {
    icon: 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>💋</text></svg>',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-TW">
      <body className={`${plusJakartaSans.variable} ${notoSansTC.variable} ${dmMono.variable} antialiased font-sans`}>
        <SessionProviderWrapper>
          <Navigation />
          <main className="pb-20 md:pb-0 md:pl-64 min-h-screen">
            <div className="max-w-5xl mx-auto px-4 py-6">
              {children}
            </div>
          </main>
        </SessionProviderWrapper>
      </body>
    </html>
  )
}
