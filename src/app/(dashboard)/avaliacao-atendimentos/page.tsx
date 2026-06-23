import { AvaliacaoClient } from '@/components/avaliacao/AvaliacaoClient'

export default function AvaliacaoAtendimentosPage() {
  return (
    <AvaliacaoClient
      tipo="atendimento"
      titulo="Avaliação de Atendimentos"
      descricao="Avaliação diária dos atendimentos do RD Conversas com KPIs, notas e gráficos."
      placeholder={`Cole aqui as transcrições dos atendimentos do RD Conversas.\n\nEx.:\n[Atendente Maria] Olá! Tudo bem? Como posso ajudar?\n[Cliente] Queria saber sobre o escritório virtual...\n---\n[Atendente João] Bom dia! ...`}
    />
  )
}
