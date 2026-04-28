import { getServerSession } from 'next-auth'
import { authOptions } from './auth'

export async function getSessionUser(): Promise<string | null> {
  const session = await getServerSession(authOptions)
  return session?.user?.email ?? null
}
