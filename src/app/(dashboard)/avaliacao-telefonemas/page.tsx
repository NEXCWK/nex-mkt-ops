import { AvaliacaoClient } from '@/components/avaliacao/AvaliacaoClient'

export default function AvaliacaoTelefonemasPage() {
  return (
    <AvaliacaoClient
      tipo="telefonema"
      titulo="Avaliador de Telefonemas"
      descricao="Envie transcrições de ligações (PDF, CSV ou Excel) e acompanhe KPIs, notas por atendente e insights em um dashboard visual."
      placeholder={`Cole aqui as transcrições das ligações.\n\nEx.:\n[Atendente Maria] Nex Coworking, bom dia!\n[Cliente] Oi, é sobre uma sala de reunião...\n---\n[Atendente João] Nex Coworking, boa tarde! ...`}
    />
  )
}
