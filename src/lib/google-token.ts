import { createServerClient } from '@/lib/supabase/server'

/**
 * Obtém um access_token válido para um usuário fora do contexto de uma sessão
 * de navegador (ex.: dentro de um cron job) — usa o refresh_token persistido
 * em `usuarios.google_refresh_token` no login (ver src/lib/auth.ts).
 *
 * Retorna null se o usuário nunca logou (sem refresh_token salvo) ou se a
 * troca por access_token falhar (token revogado, etc.).
 */
export async function getAccessTokenForUser(
  email: string
): Promise<{ accessToken: string; refreshToken: string } | null> {
  const supabase = createServerClient()
  const { data } = await supabase
    .from('usuarios')
    .select('google_refresh_token')
    .eq('email', email)
    .maybeSingle()

  const refreshToken = data?.google_refresh_token as string | undefined
  if (!refreshToken) return null

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  })
  const refreshed = await res.json()
  if (!res.ok || !refreshed.access_token) return null

  return { accessToken: refreshed.access_token, refreshToken }
}
