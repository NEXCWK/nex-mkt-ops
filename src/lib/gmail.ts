import { google } from 'googleapis'

interface GmailCredentials {
  accessToken: string
  refreshToken?: string
}

function makeGmailClient({ accessToken, refreshToken }: GmailCredentials) {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  )
  oauth2Client.setCredentials({
    access_token: accessToken,
    ...(refreshToken ? { refresh_token: refreshToken } : {}),
  })
  return google.gmail({ version: 'v1', auth: oauth2Client })
}

// ── Envio de e-mail ────────────────────────────────────────────────────────────

interface SendEmailParams extends GmailCredentials {
  to: string
  cc: string[]
  subject: string
  body: string
  senderName?: string
  threadId?: string
}

export async function sendEmailViaGmail({
  accessToken,
  refreshToken,
  to,
  cc,
  subject,
  body,
  senderName,
  threadId,
}: SendEmailParams): Promise<{ messageId: string }> {
  const gmail = makeGmailClient({ accessToken, refreshToken })

  const ccHeader = cc.length > 0 ? `Cc: ${cc.join(', ')}\r\n` : ''
  const fromHeader = senderName ? `From: ${senderName}\r\n` : ''

  const rawMessage = [
    fromHeader,
    `To: ${to}\r\n`,
    ccHeader,
    `Subject: =?utf-8?B?${Buffer.from(subject).toString('base64')}?=\r\n`,
    'MIME-Version: 1.0\r\n',
    'Content-Type: text/html; charset=utf-8\r\n',
    '\r\n',
    body,
  ].join('')

  const encodedMessage = Buffer.from(rawMessage)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')

  const response = await gmail.users.messages.send({
    userId: 'me',
    requestBody: {
      raw: encodedMessage,
      ...(threadId ? { threadId } : {}),
    },
  })

  return { messageId: response.data.id ?? '' }
}

// ── Busca de threads ───────────────────────────────────────────────────────────

export interface ThreadResult {
  threadId: string
  subject: string
  from: string
  date: string
  snippet: string
}

export async function buscarThreads({
  accessToken,
  refreshToken,
  query,
}: GmailCredentials & { query: string }): Promise<ThreadResult[]> {
  const gmail = makeGmailClient({ accessToken, refreshToken })

  const listRes = await gmail.users.messages.list({
    userId: 'me',
    q: query,
    maxResults: 8,
  })

  const messages = listRes.data.messages ?? []
  if (messages.length === 0) return []

  const detalhes = await Promise.all(
    messages.map(msg =>
      gmail.users.messages.get({
        userId: 'me',
        id: msg.id!,
        format: 'metadata',
        metadataHeaders: ['Subject', 'From', 'Date'],
      })
    )
  )

  const seen = new Set<string>()
  return detalhes
    .map(d => {
      const headers = d.data.payload?.headers ?? []
      return {
        threadId: d.data.threadId ?? '',
        subject: headers.find(h => h.name === 'Subject')?.value ?? '(sem assunto)',
        from: headers.find(h => h.name === 'From')?.value ?? '',
        date: headers.find(h => h.name === 'Date')?.value ?? '',
        snippet: d.data.snippet ?? '',
      }
    })
    .filter(r => {
      if (!r.threadId || seen.has(r.threadId)) return false
      seen.add(r.threadId)
      return true
    })
}
