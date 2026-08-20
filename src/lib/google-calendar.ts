import { google } from 'googleapis'

interface GoogleCredentials {
  accessToken: string
  refreshToken?: string
}

function makeCalendarClient({ accessToken, refreshToken }: GoogleCredentials) {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  )
  oauth2Client.setCredentials({
    access_token: accessToken,
    ...(refreshToken ? { refresh_token: refreshToken } : {}),
  })
  return google.calendar({ version: 'v3', auth: oauth2Client })
}

interface CreateEventParams extends GoogleCredentials {
  summary: string
  description?: string
  location?: string
  /** Data/hora local (America/Sao_Paulo) de início do evento. */
  start: Date
  /** Duração do evento em minutos. */
  durationMinutes?: number
  attendeeEmails: string[]
}

/**
 * Cria um evento no Google Agenda do usuário autenticado e envia convite por
 * e-mail automaticamente para os `attendeeEmails` (sendUpdates: 'all').
 */
export async function createCalendarInvite({
  accessToken,
  refreshToken,
  summary,
  description,
  location,
  start,
  durationMinutes = 30,
  attendeeEmails,
}: CreateEventParams): Promise<{ eventId: string; htmlLink?: string | null }> {
  const calendar = makeCalendarClient({ accessToken, refreshToken })

  const end = new Date(start.getTime() + durationMinutes * 60 * 1000)
  const timeZone = 'America/Sao_Paulo'

  const response = await calendar.events.insert({
    calendarId: 'primary',
    sendUpdates: 'all',
    requestBody: {
      summary,
      description,
      location,
      start: { dateTime: start.toISOString(), timeZone },
      end: { dateTime: end.toISOString(), timeZone },
      attendees: [...new Set(attendeeEmails)].map(email => ({ email })),
    },
  })

  return { eventId: response.data.id ?? '', htmlLink: response.data.htmlLink }
}
