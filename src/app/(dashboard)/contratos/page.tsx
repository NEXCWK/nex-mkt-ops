import { redirect } from 'next/navigation'

// Página legada — o registro canônico de documentos é o Histórico.
export default function ContratosPage() {
  redirect('/historico')
}
