'use client'

import { Search, X } from 'lucide-react'

export function TableSearch({ value, onChange, placeholder }: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-nex-gray-400 pointer-events-none" />
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder ?? 'Buscar...'}
        className="h-9 w-64 max-w-full rounded-md border border-nex-gray-200 bg-white pl-9 pr-8 text-sm placeholder:text-nex-gray-300 focus:outline-none focus:ring-1 focus:ring-nex-gray-400 focus:border-nex-gray-400 transition-colors"
      />
      {value && (
        <button
          onClick={() => onChange('')}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-nex-gray-400 hover:text-nex-black transition-colors"
          title="Limpar busca"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  )
}
