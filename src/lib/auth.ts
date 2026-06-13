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
          scope: 'openid email profile https://www.googleapis.com/auth/gmail.send',
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
      if (account) {
        token.accessToken = account.access_token
        token.refreshToken = account.refresh_token
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
      return token
    },
    async session({ session, token }) {
      session.accessToken = token.accessToken as string
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
