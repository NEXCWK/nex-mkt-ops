import { AvaliacaoClient } from '@/components/avaliacao/AvaliacaoClient'

export default function AvaliacaoTelefonemasPage() {
  return (
    <AvaliacaoClient
      tipo="telefonema"
      titulo="Avaliador de Telefonemas"
      descricao="Avaliação diária dos atendimentos por telefone com KPIs, notas e gráficos."
      placeholder={`Cole aqui as transcrições das ligações do dia.\n\nEx.:\n[Atendente] Nex Coworking, bom dia!\n[Cliente] Oi, é sobre uma sala de reunião...\n---\n[Atendente] Nex Coworking, boa tarde! ...`}
    />
  )
}
