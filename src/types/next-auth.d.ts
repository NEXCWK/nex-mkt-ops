import 'next-auth'

declare module 'next-auth' {
  interface Session {
    accessToken?: string
    refreshToken?: string
    user: {
      name?: string | null
      email?: string | null
      image?: string | null
      perfil?: string
      nome?: string
    }
  }
}
