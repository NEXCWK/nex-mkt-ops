import { NextAuthOptions } from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'
import { createServerClient } from './supabase/server'

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: [
            'openid email profile',
            'https://www.googleapis.com/auth/gmail.send',
            'https://www.googleapis.com/auth/gmail.readonly',
          ].join(' '),
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    }),
  ],
  callbacks: {
    async signIn({ user }) {
      if (!user.email?.endsWith('@nexcoworking.com.br')) {
        return '/login?error=domain'
      }

      const supabase = createServerClient()
      const { data } = await supabase
        .from('usuarios')
        .select('id, ativo')
        .eq('email', user.email)
        .maybeSingle()

      if (!data || !data.ativo) {
        return '/login?error=unauthorized'
      }
      return true
    },

    async jwt({ token, account, user }) {
      // Initial sign-in: store tokens + expiry
      if (account) {
        token.accessToken = account.access_token
        token.refreshToken = account.refresh_token
        token.expiresAt = account.expires_at // Unix timestamp (seconds)
      }
      if (user) {
        const supabase = createServerClient()
        const { data } = await supabase
          .from('usuarios')
          .select('perfil, nome')
          .eq('email', user.email)
          .maybeSingle()
        token.perfil = data?.perfil
        token.nome = data?.nome ?? user.name
      }

      // Token still valid (60s buffer) or no expiry info stored yet
      if (!token.expiresAt || Date.now() < ((token.expiresAt as number) - 60) * 1000) {
        return token
      }

      // Access token expired — refresh silently
      try {
        const res = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            client_id: process.env.GOOGLE_CLIENT_ID!,
            client_secret: process.env.GOOGLE_CLIENT_SECRET!,
            grant_type: 'refresh_token',
            refresh_token: token.refreshToken as string,
          }),
        })
        const refreshed = await res.json()
        if (!res.ok) throw refreshed
        return {
          ...token,
          accessToken: refreshed.access_token,
          expiresAt: Math.floor(Date.now() / 1000) + (refreshed.expires_in ?? 3600),
        }
      } catch {
        // Refresh failed — API routes will return 401 and prompt re-login
        return { ...token, accessToken: undefined, error: 'RefreshAccessTokenError' }
      }
    },

    async session({ session, token }) {
      session.accessToken = token.accessToken as string | undefined
      session.refreshToken = token.refreshToken as string | undefined
      session.user.perfil = token.perfil as string
      session.user.nome = token.nome as string
      return session
    },
  },
  pages: {
    signIn: '/login',
    error: '/login',
  },
  secret: process.env.NEXTAUTH_SECRET,
}
