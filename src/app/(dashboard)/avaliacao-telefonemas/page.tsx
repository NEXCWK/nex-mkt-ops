import { AvaliacaoClient } from '@/components/avaliacao/AvaliacaoClient'

export default function AvaliacaoTelefonemasPage() {
  return (
    <AvaliacaoClient
      tipo="telefonema"
      titulo="Avaliador de Telefonemas"
      descricao="Envie o áudio da ligação (.mp3) para o sistema ouvir, transcrever e avaliar — ou envie transcrições em PDF, CSV ou Excel. Acompanhe KPIs, notas por atendente e insights em um dashboard visual."
      placeholder={`Cole aqui as transcrições das ligações.\n\nEx.:\n[Atendente Maria] Nex Coworking, bom dia!\n[Cliente] Oi, é sobre uma sala de reunião...\n---\n[Atendente João] Nex Coworking, boa tarde! ...`}
    />
  )
}
