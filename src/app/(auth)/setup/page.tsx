'use client'

import { useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'

export default function SetupPage() {
  const router = useRouter()
  const [form, setForm] = useState({ email: '', nome: '', perfil: 'admin', secret: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/bootstrap-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${form.secret}`,
        },
        body: JSON.stringify({ email: form.email, nome: form.nome, perfil: form.perfil }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Erro ao criar usuário')
      } else {
        setDone(true)
        setTimeout(() => router.push('/login'), 2000)
      }
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-nex-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-sm border border-nex-gray-100 p-8 w-full max-w-md">
        <div className="flex justify-center mb-8">
          <Image src="/nex-logo.png" alt="Nex." width={120} height={36} priority />
        </div>

        <h1 className="text-xl font-semibold text-nex-gray-900 mb-1">Configuração inicial</h1>
        <p className="text-sm text-nex-gray-500 mb-6">
          Crie o primeiro usuário administrador do sistema.
        </p>

        {done ? (
          <div className="text-center text-green-700 bg-green-50 border border-green-200 rounded-lg p-4">
            Usuário criado com sucesso! Redirecionando para o login...
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-nex-gray-700 mb-1">Nome</label>
              <input
                type="text"
                required
                value={form.nome}
                onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}
                placeholder="Seu nome"
                className="w-full border border-nex-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-nex-red"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-nex-gray-700 mb-1">E-mail</label>
              <input
                type="email"
                required
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                placeholder="voce@nexcoworking.com.br"
                className="w-full border border-nex-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-nex-red"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-nex-gray-700 mb-1">Perfil</label>
              <select
                value={form.perfil}
                onChange={e => setForm(f => ({ ...f, perfil: e.target.value }))}
                className="w-full border border-nex-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-nex-red"
              >
                <option value="admin">Admin</option>
                <option value="gestor">Gestor</option>
                <option value="operador">Operador</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-nex-gray-700 mb-1">SEED_SECRET</label>
              <input
                type="password"
                required
                value={form.secret}
                onChange={e => setForm(f => ({ ...f, secret: e.target.value }))}
                placeholder="Chave configurada no Railway"
                className="w-full border border-nex-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-nex-red"
              />
            </div>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-2">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-nex-red text-white rounded-lg py-2.5 text-sm font-semibold hover:bg-nex-red/90 disabled:opacity-50 transition"
            >
              {loading ? 'Criando...' : 'Criar usuário'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
