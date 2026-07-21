import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { podeAcessarAvaliacao } from '@/lib/acesso-restrito'
import { AvaliacaoClient } from '@/components/avaliacao/AvaliacaoClient'

export default async function AvaliacaoAtendimentosPage() {
  const session = await getServerSession(authOptions)
  if (!session || !podeAcessarAvaliacao(session.user.email)) {
    redirect('/dashboard')
  }

  return (
    <AvaliacaoClient
      tipo="atendimento"
      titulo="Avaliação de Atendimentos"
      descricao="Envie transcrições do RD Conversas (PDF, CSV ou Excel) e acompanhe KPIs, notas por atendente e insights em um dashboard visual."
      placeholder={`Cole aqui as transcrições dos atendimentos do RD Conversas.\n\nEx.:\n[Atendente Maria] Olá! Tudo bem? Como posso ajudar?\n[Cliente] Queria saber sobre o escritório virtual...\n---\n[Atendente João] Bom dia! ...`}
    />
  )
}
