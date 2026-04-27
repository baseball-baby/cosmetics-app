import { NextAuthOptions } from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'
import { getDb } from './db'

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  secret: process.env.NEXTAUTH_SECRET,
  callbacks: {
    async signIn({ user }) {
      const db = getDb()
      db.prepare(
        'INSERT OR IGNORE INTO users (id, email, created_at) VALUES (?, ?, datetime("now","localtime"))'
      ).run(user.id!, user.email!)
      return true
    },
    async session({ session, token }) {
      if (session.user && token.sub) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(session.user as any).id = token.sub
        const db = getDb()
        const row = db
          .prepare('SELECT display_name FROM users WHERE id = ?')
          .get(token.sub) as { display_name: string | null } | undefined
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(session.user as any).displayName = row?.display_name ?? null
      }
      return session
    },
  },
  pages: {
    signIn: '/login',
  },
}
