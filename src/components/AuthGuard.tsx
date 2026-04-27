'use client'

import { useSession } from 'next-auth/react'
import { useRouter, usePathname } from 'next/navigation'
import { useEffect } from 'react'

export default function AuthGuard() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (status === 'loading') return
    if (status === 'authenticated') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const displayName = (session?.user as any)?.displayName
      if (!displayName && pathname !== '/setup') {
        router.push('/setup')
      }
    }
  }, [session, status, pathname, router])

  return null
}
