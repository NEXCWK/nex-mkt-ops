import { google } from 'googleapis'

interface SendEmailParams {
  accessToken: string
  to: string
  cc: string[]
  subject: string
  body: string
  senderName?: string
}

export async function sendEmailViaGmail({
  accessToken,
  to,
  cc,
  subject,
  body,
  senderName,
}: SendEmailParams): Promise<{ messageId: string }> {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  )
  oauth2Client.setCredentials({ access_token: accessToken })

  const gmail = google.gmail({ version: 'v1', auth: oauth2Client })

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
    requestBody: { raw: encodedMessage },
  })

  return { messageId: response.data.id ?? '' }
}
