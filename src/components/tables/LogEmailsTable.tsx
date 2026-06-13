'use client'

import { useMemo, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { formatDateTime } from '@/lib/utils'
import { Mail } from 'lucide-react'
import { TableSearch } from './TableSearch'
import { LogEmailDialog } from '@/components/log/LogEmailDialog'

const TH = 'text-left px-4 py-3 text-[11px] font-heading font-semibold uppercase tracking-widest text-nex-gray-400'

export function LogEmailsTable({ logs }: { logs: any[] }) {
  const [busca, setBusca] = useState('')

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase()
    if (!q) return logs
    return logs.filter((log: any) =>
      [log.destinatario, log.clientes?.nome, log.templates_email?.nome, log.operador_email, log.corpo_final]
        .filter(Boolean)
        .some((v: string) => v.toLowerCase().includes(q))
    )
  }, [logs, busca])

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <TableSearch value={busca} onChange={setBusca} placeholder="Buscar por destinatário, cliente ou conteúdo..." />
        <p className="text-xs text-nex-gray-400">
          {filtrados.length} de {logs.length} registro{logs.length !== 1 ? 's' : ''}
        </p>
      </div>

      <div className="bg-white border border-nex-gray-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-nex-gray-50 border-b border-nex-gray-100">
              <tr>
                <th className={TH}>Destinatário</th>
                <th className={TH}>Cliente</th>
                <th className={TH}>Unidade</th>
                <th className={TH}>Operador</th>
                <th className={TH}>Registrado em</th>
                <th className={TH}>Ver</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-nex-gray-100">
              {filtrados.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-14">
                    <div className="flex flex-col items-center gap-2 text-center">
                      <Mail className="w-6 h-6 text-nex-gray-300" />
                      <p className="text-sm text-nex-gray-400">
                        {busca ? `Nenhum resultado para "${busca}".` : 'Nenhum e-mail registrado ainda. Os e-mails copiados na aba Novo E-mail aparecem aqui.'}
                      </p>
                    </div>
                  </td>
                </tr>
              )}
              {filtrados.map((log: any) => (
                <tr key={log.id} className="hover:bg-nex-gray-50 transition-colors">
                  <td className="px-4 py-3 font-medium">{log.destinatario}</td>
                  <td className="px-4 py-3">{log.clientes?.nome ?? '—'}</td>
                  <td className="px-4 py-3">
                    <Badge variant="secondary">
                      {log.unidade === 'nex_house' ? 'NH' : log.unidade === 'francisco_rocha' ? 'FCO' : '—'}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-nex-gray-500">{log.operador_email}</td>
                  <td className="px-4 py-3 text-nex-gray-500 whitespace-nowrap">{formatDateTime(log.sent_at)}</td>
                  <td className="px-4 py-3">
                    <LogEmailDialog log={log} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
