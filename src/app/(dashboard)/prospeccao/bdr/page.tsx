import { ProspeccaoClient } from '@/components/prospeccao/ProspeccaoClient'

export default function BdrPage() {
  return (
    <ProspeccaoClient
      tipo="bdr"
      titulo="Sistema BDR — Prospecção"
      descricao="Gere listas de empresas por região e nicho e dispare e-mails de prospecção comercial."
      nichoLabel="Nicho / segmento de mercado"
      nichoPlaceholder="Ex.: startups de tecnologia, escritórios de advocacia, e-commerces…"
    />
  )
}
