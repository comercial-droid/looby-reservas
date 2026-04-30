'use client'

import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'
import React, { useEffect, useMemo, useState } from 'react'
import { contatarClienteWhatsApp } from '@/app/utils/helpers'

type Status = 'pendente' | 'aprovado_cortesia' | 'aprovado_venda' | 'cancelado' | string
type Tipo = 'aniversario' | 'cortesia' | 'venda' | string

type ReservaRow = {
  id: string | number
  user_id: string | null
  data_evento: string
  espaco_id: string
  nome: string
  telefone: string
  tipo: Tipo
  status: Status
  observacao: string | null
  comprovante_url: string | null
  created_at?: string
}

function normLower(s: any) {
  return String(s ?? '').trim().toLowerCase()
}

function onlyDigits(s: any) {
  return String(s ?? '').replace(/\D/g, '')
}

function firstDayOfMonthISO() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}-01`
}

function lastDayOfMonthISO() {
  const d = new Date()
  const y = d.getFullYear()
  const m = d.getMonth() + 1
  const lastDay = new Date(y, m, 0).getDate()
  return `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
}

function labelTipo(tipo: string) {
  const t = normLower(tipo)
  if (t === 'venda') return 'VENDA'
  if (t === 'cortesia') return 'CORTESIA'
  if (t === 'aniversario') return 'ANIVERSÁRIO'
  return String(tipo ?? '').toUpperCase()
}

function labelStatus(status: string) {
  const s = normLower(status)
  if (s === 'pendente') return 'PENDENTE'
  if (s === 'aprovado_venda') return 'APROVADO (VENDA)'
  if (s === 'aprovado_cortesia') return 'APROVADO (CORTESIA/ANIV)'
  if (s === 'cancelado') return 'CANCELADO'
  return String(status ?? '').toUpperCase()
}

function toneStatus(status: string) {
  const s = normLower(status)
  if (s === 'pendente') return 'bg-yellow-100 text-yellow-800 border-yellow-200'
  if (s === 'aprovado_venda') return 'bg-green-100 text-green-800 border-green-200'
  if (s === 'aprovado_cortesia') return 'bg-orange-100 text-orange-800 border-orange-200'
  if (s === 'cancelado') return 'bg-red-100 text-red-800 border-red-200'
  return 'bg-neutral-100 text-neutral-800 border-neutral-200'
}

function toneTipo(tipo: string) {
  const t = normLower(tipo)
  if (t === 'venda') return 'bg-blue-100 text-blue-800 border-blue-200'
  return 'bg-purple-100 text-purple-800 border-purple-200'
}

function formatCreatedAtBR(dateValue?: string) {
  if (!dateValue) return ''
  return new Date(dateValue).toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
  })
}

function podeCancelarReserva(status: string) {
  const s = normLower(status)
  return s === 'pendente' || s === 'aprovado_venda' || s === 'aprovado_cortesia'
}

function StatCard({
  title,
  value,
  hint,
}: {
  title: string
  value: number | string
  hint?: string
}) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
      <div className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">{title}</div>
      <div className="mt-1 break-words text-2xl font-black tracking-tight text-neutral-900 sm:text-3xl">{value}</div>
      {hint ? <div className="mt-1 text-[10px] leading-relaxed text-neutral-400">{hint}</div> : null}
    </div>
  )
}

export default function MinhasReservasPage() {
  const router = useRouter()

  const [authChecking, setAuthChecking] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [userName, setUserName] = useState<string>('')

  const [dataInicial, setDataInicial] = useState<string>(firstDayOfMonthISO())
  const [dataFinal, setDataFinal] = useState<string>(lastDayOfMonthISO())
  const [tipoFiltro, setTipoFiltro] = useState<'todas' | 'venda' | 'cortesia' | 'aniversario'>('todas')
  const [statusFiltro, setStatusFiltro] = useState<'todos' | 'pendente' | 'aprovado' | 'cancelado'>('todos')
  const [busca, setBusca] = useState('')

  const [loading, setLoading] = useState(false)
  const [erroUi, setErroUi] = useState<string | null>(null)
  const [rows, setRows] = useState<ReservaRow[]>([])
  const [cancelandoId, setCancelandoId] = useState<string | null>(null)

  useEffect(() => {
    async function check() {
      const { data } = await supabase.auth.getUser()
      const u = data.user
      if (!u) {
        router.push('/login?next=/minhas-reservas')
        return
      }

      setUserId(u.id)

      const { data: p } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', u.id)
        .maybeSingle()

      setUserName((p as any)?.full_name ?? (u.user_metadata as any)?.full_name ?? u.email ?? 'Usuário')
      setAuthChecking(false)
    }

    check()
  }, [router])

  async function fetchRows() {
    if (!userId) return
    setErroUi(null)
    setLoading(true)

    try {
      let q = supabase
        .from('reservas')
        .select('*')
        .eq('user_id', userId)
        .gte('data_evento', dataInicial)
        .lte('data_evento', dataFinal)
        .order('created_at', { ascending: false })

      if (tipoFiltro !== 'todas') q = q.eq('tipo', tipoFiltro)

      if (statusFiltro === 'pendente') q = q.eq('status', 'pendente')
      if (statusFiltro === 'cancelado') q = q.eq('status', 'cancelado')
      if (statusFiltro === 'aprovado') q = q.in('status', ['aprovado_venda', 'aprovado_cortesia'])

      const s = busca.trim()
      if (s) {
        const digits = onlyDigits(s)
        if (digits.length >= 6) {
          q = q.or(`telefone.ilike.%${digits}%,nome.ilike.%${s}%,espaco_id.ilike.%${s}%`)
        } else {
          q = q.or(`nome.ilike.%${s}%,espaco_id.ilike.%${s}%`)
        }
      }

      const { data, error } = await q

      if (error) {
        console.error(error)
        setErroUi(`Erro ao buscar reservas: ${error.message}`)
        setRows([])
        return
      }

      setRows((data as ReservaRow[]) || [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (authChecking) return
    fetchRows()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authChecking, userId, dataInicial, dataFinal, tipoFiltro, statusFiltro, busca])

  const computed = useMemo(() => {
    const total = rows.length
    const pendentes = rows.filter((r) => normLower(r.status) === 'pendente').length
    const canceladas = rows.filter((r) => normLower(r.status) === 'cancelado').length
    const aprovadas = rows.filter((r) =>
      ['aprovado_venda', 'aprovado_cortesia'].includes(normLower(r.status))
    ).length

    const vendas = rows.filter((r) => normLower(r.tipo) === 'venda').length
    const cortesias = rows.filter((r) => normLower(r.tipo) === 'cortesia').length
    const aniversarios = rows.filter((r) => normLower(r.tipo) === 'aniversario').length

    return { total, pendentes, aprovadas, canceladas, vendas, cortesias, aniversarios }
  }, [rows])

  async function cancelarReserva(r: ReservaRow) {
    if (!userId) {
      alert('Faça login novamente.')
      return
    }

    if (!podeCancelarReserva(r.status)) {
      alert('Essa reserva não pode mais ser cancelada por você.')
      return
    }

    const confirmar = window.confirm(
      `Tem certeza que deseja cancelar sua reserva do espaço ${r.espaco_id} para o dia ${r.data_evento}?`
    )

    if (!confirmar) return

    const idStr = String(r.id)
    setCancelandoId(idStr)
    setErroUi(null)

    try {
      const { error } = await supabase
        .from('reservas')
        .update({ status: 'cancelado' })
        .eq('id', r.id)
        .eq('user_id', userId)

      if (error) {
        console.error(error)
        setErroUi(`Erro ao cancelar reserva: ${error.message}`)
        return
      }

      await fetchRows()
      alert('Reserva cancelada com sucesso.')
    } finally {
      setCancelandoId(null)
    }
  }

  async function sair() {
    await supabase.auth.signOut()
    router.push('/login?next=/minhas-reservas')
  }

  if (authChecking) {
    return <div className="min-h-svh bg-white p-8 text-neutral-500">Verificando login…</div>
  }

  return (
    <div className="min-h-svh bg-neutral-50 text-neutral-900">
      <div className="border-b border-black/5 bg-white shadow-sm">
        <div className="mx-auto max-w-6xl px-4 py-4 sm:px-6 sm:py-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <h1 className="text-lg font-semibold tracking-tight text-neutral-900 sm:text-2xl">
                Meu relatório
              </h1>
              <p className="mt-1 break-words text-xs text-neutral-500 sm:text-sm">
                Usuário: <span className="font-semibold text-neutral-900">{userName}</span>
              </p>
              {erroUi ? <p className="mt-2 text-xs text-red-600 sm:text-sm">{erroUi}</p> : null}
            </div>

            <div className="flex flex-wrap items-center justify-end gap-3 lg:w-auto">
              <button
                onClick={() => router.push('/')}
                className="px-6 py-2.5 rounded-full text-[10px] font-black uppercase tracking-[0.15em] text-[#5b1019] border border-[#5b1019]/20 bg-[#5b1019]/5 transition-all hover:bg-[#5b1019] hover:text-white"
              >
                Voltar
              </button>

              <button
                onClick={fetchRows}
                className="px-6 py-2.5 rounded-full text-[10px] font-black uppercase tracking-[0.15em] text-[#5b1019] border border-[#5b1019]/20 bg-[#5b1019]/5 transition-all hover:bg-[#5b1019] hover:text-white"
              >
                Atualizar
              </button>

              <button
                onClick={sair}
                className="px-6 py-2.5 rounded-full text-[10px] font-black uppercase tracking-[0.15em] text-red-600 border border-red-200 bg-red-50 transition-all hover:bg-red-600 hover:text-white"
              >
                Sair
              </button>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-12 md:gap-3">
            <div className="sm:col-span-1 md:col-span-3">
              <label className="text-[11px] font-bold uppercase tracking-widest text-neutral-400 sm:text-xs">De</label>
              <input
                type="date"
                value={dataInicial}
                onChange={(e) => setDataInicial(e.target.value)}
                className="mt-1 w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-[16px] text-neutral-900 outline-none focus:border-[#5b1019]/30 sm:py-3"
              />
            </div>

            <div className="sm:col-span-1 md:col-span-3">
              <label className="text-[11px] font-bold uppercase tracking-widest text-neutral-400 sm:text-xs">Até</label>
              <input
                type="date"
                value={dataFinal}
                onChange={(e) => setDataFinal(e.target.value)}
                className="mt-1 w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-[16px] text-neutral-900 outline-none focus:border-[#5b1019]/30 sm:py-3"
              />
            </div>

            <div className="sm:col-span-1 md:col-span-3">
              <label className="text-[11px] font-bold uppercase tracking-widest text-neutral-400 sm:text-xs">Tipo</label>
              <select
                value={tipoFiltro}
                onChange={(e) => setTipoFiltro(e.target.value as any)}
                className="mt-1 w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-[16px] text-neutral-900 outline-none focus:border-[#5b1019]/30 sm:py-3"
              >
                <option value="todas">Todos</option>
                <option value="venda">Venda</option>
                <option value="cortesia">Cortesia</option>
                <option value="aniversario">Aniversário</option>
              </select>
            </div>

            <div className="sm:col-span-1 md:col-span-3">
              <label className="text-[11px] font-bold uppercase tracking-widest text-neutral-400 sm:text-xs">Status</label>
              <select
                value={statusFiltro}
                onChange={(e) => setStatusFiltro(e.target.value as any)}
                className="mt-1 w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-[16px] text-neutral-900 outline-none focus:border-[#5b1019]/30 sm:py-3"
              >
                <option value="todos">Todos</option>
                <option value="pendente">Pendentes</option>
                <option value="aprovado">Aprovadas</option>
                <option value="cancelado">Canceladas</option>
              </select>
            </div>

            <div className="sm:col-span-2 md:col-span-3">
              <label className="text-[11px] font-bold uppercase tracking-widest text-neutral-400 sm:text-xs">Buscar</label>
              <input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="João, C4, M13..."
                className="mt-1 w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-[16px] text-neutral-900 outline-none focus:border-[#5b1019]/30 sm:py-3"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
          <StatCard title="TOTAL DO PERÍODO" value={computed.total} hint="Todas as reservas no período (por data_evento)" />
          <StatCard title="Pendentes" value={computed.pendentes} />
          <StatCard title="Aprovadas" value={computed.aprovadas} />
          <StatCard title="Canceladas" value={computed.canceladas} />
          <StatCard title="Vendas" value={computed.vendas} />
          <StatCard title="Cortesia/Aniv" value={computed.cortesias + computed.aniversarios} />
        </div>

        <div className="rounded-3xl border border-neutral-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="text-lg font-black uppercase tracking-tighter text-neutral-900">Reservas do período</h2>
              <p className="mt-1 text-sm text-neutral-400">Lista filtrada conforme suas preferências.</p>
            </div>
          </div>

          <div className="mt-4">
            {loading ? (
              <div className="rounded-2xl border border-neutral-100 bg-neutral-50 p-6 text-sm text-neutral-400">
                Carregando…
              </div>
            ) : rows.length === 0 ? (
              <div className="rounded-2xl border border-neutral-100 bg-neutral-50 p-6 text-sm text-neutral-400">
                Nenhuma reserva encontrada para os filtros atuais.
              </div>
            ) : (
              <div className="space-y-3">
                {rows.map((r) => {
                  const podeCancelar = podeCancelarReserva(r.status)
                  const cancelando = cancelandoId === String(r.id)

                  return (
                    <div
                      key={String(r.id)}
                      className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm"
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="text-base font-black uppercase tracking-tight text-neutral-900 break-words">
                              {r.espaco_id}
                            </div>

                            <span className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-[10px] font-bold text-blue-700">
                              {r.data_evento}
                            </span>

                            <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-bold ${toneStatus(r.status)}`}>
                              {labelStatus(r.status)}
                            </span>

                            <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-bold ${toneTipo(r.tipo)}`}>
                              {labelTipo(r.tipo)}
                            </span>
                          </div>

                          <div className="mt-3 grid grid-cols-1 gap-3 text-sm text-neutral-600 sm:gap-2 md:grid-cols-2">
                            <div className="rounded-xl border border-neutral-100 bg-neutral-50 px-3 py-3 sm:py-2">
                              <div className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">Nome</div>
                              <div className="truncate font-semibold text-neutral-900">{r.nome}</div>
                            </div>

                            <div className="rounded-xl border border-neutral-100 bg-neutral-50 px-3 py-3 sm:py-2">
                              <div className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">Telefone</div>
                              <div className="font-semibold text-neutral-900 break-all">{r.telefone}</div>
                            </div>

                            <div className="rounded-xl border border-neutral-100 bg-neutral-50 px-3 py-3 sm:py-2 md:col-span-2">
                              <div className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">Observação</div>
                              <div className="mt-1 whitespace-pre-wrap break-words text-sm text-neutral-700">
                                {String(r.observacao ?? '').trim() ? (
                                  r.observacao
                                ) : (
                                  <span className="text-neutral-300">—</span>
                                )}
                              </div>
                            </div>
                          </div>

                          {r.created_at ? (
                            <div className="mt-3 text-[10px] text-neutral-400">
                              Criado em: {formatCreatedAtBR(r.created_at)}
                            </div>
                          ) : null}
                        </div>

                            <div className="flex flex-col gap-2 sm:w-[170px]">
                              {podeCancelar ? (
                                <>
                                  <button
                                    onClick={() => contatarClienteWhatsApp(r)}
                                    className="inline-flex min-h-[42px] items-center justify-center rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500"
                                  >
                                    WhatsApp (Cliente)
                                  </button>
                                  
                                  <button
                                    onClick={() => cancelarReserva(r)}
                                    disabled={cancelando}
                                    className="inline-flex min-h-[42px] items-center justify-center rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-60"
                                  >
                                    {cancelando ? 'Cancelando...' : 'Cancelar reserva'}
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button
                                    onClick={() => contatarClienteWhatsApp(r)}
                                    className="inline-flex min-h-[42px] items-center justify-center rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500"
                                  >
                                    WhatsApp (Cliente)
                                  </button>
                                  <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-center text-xs text-white/45">
                                    Sem ações adicionais
                                  </div>
                                </>
                              )}
                            </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}