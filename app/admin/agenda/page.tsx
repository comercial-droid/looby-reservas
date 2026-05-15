'use client'

export const dynamic = 'force-dynamic'

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { todayISO, formatBRDate } from '@/app/utils/helpers'

export default function AgendaPage() {
  const router = useRouter()

  const [authChecking, setAuthChecking] = useState(true)
  const [dataSelecionada, setDataSelecionada] = useState<string>(todayISO())
  const [eventoId, setEventoId] = useState<string | null>(null)
  const [nomeEvento, setNomeEvento] = useState('')
  const [ativo, setAtivo] = useState(true)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [mensagem, setMensagem] = useState<{ tipo: 'sucesso' | 'erro'; texto: string } | null>(null)

  useEffect(() => {
    async function checkAccess() {
      const { data } = await supabase.auth.getUser()
      const user = data.user

      if (!user) {
        router.push('/login?next=/admin/agenda')
        return
      }

      // 1. Verifica se é admin na tabela 'admins'
      const { data: adminRow } = await supabase
        .from('admins')
        .select('user_id')
        .eq('user_id', user.id)
        .maybeSingle()

      // 2. Verifica o cargo no perfil
      const { data: profileRow } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle()

      const isAgenda = profileRow?.role === 'agenda'

      if (!adminRow && !isAgenda) {
        alert('Seu usuário não tem permissão para acessar esta página.')
        await supabase.auth.signOut()
        router.push('/login?next=/admin/agenda')
        return
      }

      setAuthChecking(false)
    }

    checkAccess()
  }, [router])

  useEffect(() => {
    if (authChecking) return

    async function fetchEvento() {
      setLoading(true)
      setMensagem(null)
      
      const { data, error } = await supabase
        .from('eventos_agenda')
        .select('*')
        .eq('data_evento', dataSelecionada)
        .maybeSingle()

      if (error) {
        console.error('Erro ao buscar evento:', error)
        setMensagem({ tipo: 'erro', texto: 'Erro ao buscar evento da data selecionada.' })
      }

      if (data) {
        setEventoId(data.id)
        setNomeEvento(data.nome_evento)
        setAtivo(data.ativo)
      } else {
        setEventoId(null)
        setNomeEvento('')
        setAtivo(true)
      }

      setLoading(false)
    }

    fetchEvento()
  }, [dataSelecionada, authChecking])

  async function handleSalvar(e: React.FormEvent) {
    e.preventDefault()

    if (!nomeEvento.trim()) {
      setMensagem({ tipo: 'erro', texto: 'O nome do evento não pode ficar em branco.' })
      return
    }

    setSaving(true)
    setMensagem(null)

    try {
      if (eventoId) {
        // Atualizar existente
        const { error } = await supabase
          .from('eventos_agenda')
          .update({
            nome_evento: nomeEvento,
            ativo: ativo,
            atualizado_em: new Date().toISOString()
          })
          .eq('id', eventoId)

        if (error) throw error
        setMensagem({ tipo: 'sucesso', texto: 'Evento atualizado com sucesso!' })
      } else {
        // Criar novo
        const { data, error } = await supabase
          .from('eventos_agenda')
          .insert({
            data_evento: dataSelecionada,
            nome_evento: nomeEvento,
            ativo: ativo
          })
          .select('id')
          .single()

        if (error) throw error
        if (data) setEventoId(data.id)
        setMensagem({ tipo: 'sucesso', texto: 'Evento cadastrado com sucesso!' })
      }
    } catch (error: any) {
      console.error('Erro ao salvar evento:', error)
      setMensagem({ tipo: 'erro', texto: `Erro ao salvar: ${error.message || 'Erro desconhecido'}` })
    } finally {
      setSaving(false)
    }
  }

  if (authChecking) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-neutral-50 text-sm text-neutral-500">
        Verificando acesso...
      </div>
    )
  }

  return (
    <div className="min-h-svh bg-neutral-50 text-neutral-900 pb-10">
      <div className="border-b border-black/5 bg-white shadow-sm">
        <div className="mx-auto max-w-4xl px-4 py-4 sm:px-6 sm:py-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div className="min-w-0">
              <h1 className="text-xl font-bold tracking-tight text-neutral-900 sm:text-2xl">
                Agenda de Eventos
              </h1>
              <p className="mt-1 text-sm text-neutral-500">
                Configure os eventos que serão exibidos na tela principal de reservas.
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <button
                onClick={() => router.push('/admin')}
                className="rounded-none border border-neutral-200 bg-white px-4 py-2 text-sm font-semibold text-neutral-700 transition-colors hover:bg-neutral-50"
              >
                Voltar ao Admin
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
        <div className="rounded-none border border-neutral-200 bg-white p-5 shadow-sm sm:p-8">
          
          {mensagem && (
            <div className={`mb-6 p-4 text-sm font-medium border ${
              mensagem.tipo === 'sucesso' 
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
                : 'bg-red-50 text-red-800 border-red-200'
            }`}>
              {mensagem.texto}
            </div>
          )}

          <div className="mb-8">
            <label className="block text-xs font-bold uppercase tracking-widest text-neutral-500 mb-2">
              Selecione a Data
            </label>
            <input
              type="date"
              value={dataSelecionada}
              onChange={(e) => setDataSelecionada(e.target.value)}
              className="w-full max-w-xs rounded-none border border-neutral-200 bg-neutral-50 px-3 py-2 text-base text-neutral-900 outline-none focus:border-neutral-400 focus:bg-white"
            />
            <p className="mt-2 text-xs text-neutral-400">
              Data selecionada: {formatBRDate(dataSelecionada)}
            </p>
          </div>

          <div className="h-px w-full bg-neutral-100 mb-8" />

          {loading ? (
            <div className="py-10 text-center text-sm text-neutral-400">
              Carregando dados da data...
            </div>
          ) : (
            <form onSubmit={handleSalvar} className="space-y-6 max-w-lg">
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-neutral-500 mb-2">
                  Nome do Evento
                </label>
                <input
                  type="text"
                  value={nomeEvento}
                  onChange={(e) => setNomeEvento(e.target.value)}
                  placeholder="Ex: Sexta Sertaneja Especial"
                  className="w-full rounded-none border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-base text-neutral-900 outline-none focus:border-neutral-400 focus:bg-white"
                  required
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <input
                  type="checkbox"
                  id="ativo"
                  checked={ativo}
                  onChange={(e) => setAtivo(e.target.checked)}
                  className="h-5 w-5 rounded-none border-neutral-300 text-neutral-900 focus:ring-neutral-900"
                />
                <label htmlFor="ativo" className="text-sm font-semibold text-neutral-700 cursor-pointer">
                  Evento Ativo
                </label>
              </div>
              <p className="text-xs text-neutral-400 mt-1 pl-8">
                Se desmarcado, a tela de reservas mostrará "Evento não configurado".
              </p>

              <div className="pt-6">
                <button
                  type="submit"
                  disabled={saving}
                  className="w-full sm:w-auto rounded-none bg-neutral-900 px-6 py-3 text-sm font-bold tracking-wide text-white transition-colors hover:bg-neutral-800 disabled:opacity-50"
                >
                  {saving ? 'Salvando...' : (eventoId ? 'Atualizar Evento' : 'Cadastrar Evento')}
                </button>
              </div>
            </form>
          )}

        </div>
      </div>
    </div>
  )
}
