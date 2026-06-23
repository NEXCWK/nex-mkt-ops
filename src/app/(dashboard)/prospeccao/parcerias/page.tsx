import { ProspeccaoClient } from '@/components/prospeccao/ProspeccaoClient'

export default function ParceriasProspeccaoPage() {
  return (
    <ProspeccaoClient
      tipo="parcerias"
      titulo="Sistema Parcerias — Prospecção"
      descricao="Prospecte escritórios de contabilidade para parcerias de Escritório Virtual."
      nichoLabel="Perfil do parceiro"
      nichoPlaceholder="Ex.: escritórios de contabilidade, contadores autônomos, BPO contábil…"
    />
  )
}
