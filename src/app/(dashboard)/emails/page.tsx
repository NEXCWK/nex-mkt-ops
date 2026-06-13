import { redirect } from 'next/navigation'

// Página legada — o registro canônico de e-mails é o Log de E-mails.
export default function EmailsPage() {
  redirect('/log-emails')
}
