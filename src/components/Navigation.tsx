'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const navItems = [
  { href: '/', label: '化妝品庫', icon: '💄' },
  { href: '/profile', label: '我的色彩', icon: '🎨' },
  { href: '/colors', label: '色彩統整', icon: '🌈' },
  { href: '/match', label: 'AI 搭配', icon: '✨' },
  { href: '/advice', label: '買前建議', icon: '🛍️' },
]

export default function Navigation() {
  const pathname = usePathname()

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex fixed inset-y-0 left-0 w-64 bg-white border-r border-blush-100 flex-col z-30">
        <div className="px-6 py-8">
          <h1 className="text-xl font-bold text-blush-700">
            <span className="mr-2">🌸</span>
            化妝品管理
          </h1>
          <p className="text-xs text-nude-500 mt-1">你的個人美妝助手</p>
        </div>

        <nav className="flex-1 px-4 space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href))
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-blush-50 text-blush-700'
                    : 'text-nude-600 hover:bg-nude-50 hover:text-nude-800'
                }`}
              >
                <span className="text-lg">{item.icon}</span>
                {item.label}
              </Link>
            )
          })}
        </nav>

        <div className="px-6 py-4 text-xs text-nude-400">
          管理你的彩妝，讓每天都美美的
        </div>
      </aside>

      {/* Mobile bottom bar */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 bg-white border-t border-blush-100 z-30 flex">
        {navItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href))
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex-1 flex flex-col items-center gap-1 py-3 text-xs font-medium transition-colors ${
                isActive ? 'text-blush-600' : 'text-nude-500'
              }`}
            >
              <span className="text-xl">{item.icon}</span>
              {item.label}
            </Link>
          )
        })}
      </nav>
    </>
  )
}
