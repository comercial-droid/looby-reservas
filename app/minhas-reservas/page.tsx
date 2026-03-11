'use client'

import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'
import React, { useEffect, useMemo, useState } from 'react'

type Status = 'pendente' | 'aprovado_cortesia' | 'aprovado_venda' | 'cancelado' | string
type Tipo = 'aniversario' | 'cortesia' | 'venda' | string

type ReservaRow = {
  id: any
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

function monthNowYYYYMM() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

function monthRangeFromYYYYMM(ym: string) {
  // ym = "YYYY-MM"
  const [yStr, mStr] = ym.split('-')
  const y = Number(yStr)
  const m = Number(mStr)
  const start = new Date(y, m - 1, 1)
  const end = new Date(y, m, 0) // último dia do mês
  const startISO = `${yStr}-${mStr}-01`
  const endISO = `${yStr}-${mStr}-${String(end.getDate()).padStart(2, '0')}`
  return { startISO, endISO }
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
  if (s === 'pendente') return 'bg-yellow-400/15 text-yellow-200 border-yellow-400/25'
  if (s === 'aprovado_venda') return 'bg-green-400/15 text-green-200 border-green-400/25'
  if (s === 'aprovado_cortesia') return 'bg-orange-400/15 text-orange-200 border-orange-400/25'
  if (s === 'cancelado') return 'bg-red-400/15 text-red-200 border-red-400/25'
  return 'bg-white/5 text-neutral-200 border-white/10'
}

function toneTipo(tipo: string) {
  const t = normLower(tipo)
  if (t === 'venda') return 'bg-green-400/15 text-green-200 border-green-400/25'
  return 'bg-orange-400/15 text-orange-200 border-orange-400/25'
}

function StatCard({ title, value, hint }: { title: string; value: number | string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 shadow-[0_18px_40px_rgba(0,0,0,0.25)]">
      <div className="text-xs text-white/60">{title}</div>
      <div className="mt-1 text-3xl font-semibold tracking-tight">{value}</div>
      {hint ? <div className="mt-1 text-xs text-white/45">{hint}</div> : null}
    </div>
  )
}

export default function MinhasReservasPage() {
  const router = useRouter()

  const [authChecking, setAuthChecking] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [userName, setUserName] = useState<string>('')

  const [mes, setMes] = useState<string>(monthNowYYYYMM())
  const [tipoFiltro, setTipoFiltro] = useState<'todas' | 'venda' | 'cortesia' | 'aniversario'>('todas')
  const [statusFiltro, setStatusFiltro] = useState<'todos' | 'pendente' | 'aprovado' | 'cancelado'>('todos')
  const [busca, setBusca] = useState('')

  const [loading, setLoading] = useState(false)
  const [erroUi, setErroUi] = useState<string | null>(null)
  const [rows, setRows] = useState<ReservaRow[]>([])

  useEffect(() => {
    async function check() {
      const { data } = await supabase.auth.getUser()
      const u = data.user
      if (!u) {
        router.push('/login?next=/minhas-reservas')
        return
      }
      setUserId(u.id)

      // tenta pegar nome do profiles
      const { data: p } = await supabase.from('profiles').select('full_name').eq('id', u.id).maybeSingle()
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
      const { startISO, endISO } = monthRangeFromYYYYMM(mes)

      let q = supabase
        .from('reservas')
        .select('*')
        .eq('user_id', userId)
        .gte('data_evento', startISO)
        .lte('data_evento', endISO)
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
  }, [authChecking, userId, mes, tipoFiltro, statusFiltro, busca])

  const computed = useMemo(() => {
    const total = rows.length
    const pendentes = rows.filter((r) => normLower(r.status) === 'pendente').length
    const canceladas = rows.filter((r) => normLower(r.status) === 'cancelado').length
    const aprovadas = rows.filter((r) => ['aprovado_venda', 'aprovado_cortesia'].includes(normLower(r.status))).length

    const vendas = rows.filter((r) => normLower(r.tipo) === 'venda').length
    const cortesias = rows.filter((r) => normLower(r.tipo) === 'cortesia').length
    const aniversarios = rows.filter((r) => normLower(r.tipo) === 'aniversario').length

    return { total, pendentes, aprovadas, canceladas, vendas, cortesias, aniversarios }
  }, [rows])

  async function sair() {
    await supabase.auth.signOut()
    router.push('/login?next=/minhas-reservas')
  }

  if (authChecking) {
    return <div className="min-h-screen bg-neutral-950 text-white p-8">Verificando login…</div>
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-white">
      <div className="sticky top-0 z-40 border-b border-white/10 bg-neutral-950/75 backdrop-blur">
        <div className="mx-auto max-w-6xl px-6 py-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Meu relatório (mês)</h1>
              <p className="mt-1 text-sm text-white/60">
                Usuário: <span className="font-semibold text-white">{userName}</span>
              </p>
              {erroUi ? <p className="mt-3 text-sm text-red-300">{erroUi}</p> : null}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => router.push('/')}
                className="rounded-xl bg-white/10 px-4 py-2 text-sm font-semibold hover:bg-white/15"
              >
                Voltar pro mapa
              </button>

              <button
                onClick={fetchRows}
                className="rounded-xl border border-white/15 bg-white/[0.04] px-4 py-2 text-sm font-semibold hover:bg-white/[0.07]"
              >
                Atualizar
              </button>

              <button
                onClick={sair}
                className="rounded-xl bg-neutral-800 px-4 py-2 text-sm font-semibold hover:bg-neutral-700"
              >
                Sair
              </button>
            </div>
          </div>

          {/* filtros */}
          <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-12">
            <div className="md:col-span-3">
              <label className="text-xs text-white/55">Mês</label>
              <input
                type="month"
                value={mes}
                onChange={(e) => setMes(e.target.value)}
                className="mt-1 w-full rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-sm outline-none focus:border-white/25"
              />
            </div>

            <div className="md:col-span-3">
              <label className="text-xs text-white/55">Tipo</label>
              <select
                value={tipoFiltro}
                onChange={(e) => setTipoFiltro(e.target.value as any)}
                className="mt-1 w-full rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-sm outline-none focus:border-white/25"
              >
                <option value="todas">Todos</option>
                <option value="venda">Venda</option>
                <option value="cortesia">Cortesia</option>
                <option value="aniversario">Aniversário</option>
              </select>
            </div>

            <div className="md:col-span-3">
              <label className="text-xs text-white/55">Status</label>
              <select
                value={statusFiltro}
                onChange={(e) => setStatusFiltro(e.target.value as any)}
                className="mt-1 w-full rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-sm outline-none focus:border-white/25"
              >
                <option value="todos">Todos</option>
                <option value="pendente">Pendentes</option>
                <option value="aprovado">Aprovadas</option>
                <option value="cancelado">Canceladas</option>
              </select>
            </div>

            <div className="md:col-span-3">
              <label className="text-xs text-white/55">Buscar (nome / telefone / espaço)</label>
              <input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Ex: João, 45999..., C4, M13..."
                className="mt-1 w-full rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-sm outline-none focus:border-white/25"
              />
            </div>
          </div>
        </div>
      </div>

      {/* conteúdo */}
      <div className="mx-auto max-w-6xl px-6 py-8 space-y-6">
        {/* ✅ total do mês como principal */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
          <StatCard title="TOTAL DO MÊS" value={computed.total} hint="Todas as reservas no mês (por data_evento)" />
          <StatCard title="Pendentes" value={computed.pendentes} />
          <StatCard title="Aprovadas" value={computed.aprovadas} />
          <StatCard title="Canceladas" value={computed.canceladas} />
          <StatCard title="Vendas" value={computed.vendas} />
          <StatCard title="Cortesia/Aniv" value={computed.cortesias + computed.aniversarios} />
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 shadow-[0_18px_40px_rgba(0,0,0,0.25)]">
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="text-lg font-semibold tracking-tight">Reservas do mês</h2>
              <p className="mt-1 text-sm text-white/55">Lista filtrada (por você).</p>
            </div>
          </div>

          <div className="mt-4">
            {loading ? (
              <div className="rounded-2xl border border-white/10 bg-black/20 p-6 text-sm text-white/70">Carregando…</div>
            ) : rows.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-black/20 p-6 text-sm text-white/55">
                Nenhuma reserva encontrada para os filtros atuais.
              </div>
            ) : (
              <div className="space-y-3">
                {rows.map((r) => (
                  <div
                    key={String(r.id)}
                    className="rounded-2xl border border-white/10 bg-black/25 p-4 shadow-[0_14px_30px_rgba(0,0,0,0.22)]"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="text-base font-semibold tracking-tight">{r.espaco_id}</div>
                      <span className="inline-flex items-center rounded-full border px-2.5 py-1 text-xs bg-blue-400/15 text-blue-200 border-blue-400/25">
                        {r.data_evento}
                      </span>

                      <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs ${toneStatus(r.status)}`}>
                        {labelStatus(r.status)}
                      </span>

                      <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs ${toneTipo(r.tipo)}`}>
                        {labelTipo(r.tipo)}
                      </span>
                    </div>

                    <div className="mt-3 grid grid-cols-1 gap-2 text-sm text-white/80 md:grid-cols-2">
                      <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
                        <div className="text-xs text-white/50">Nome</div>
                        <div className="truncate font-medium">{r.nome}</div>
                      </div>

                      <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
                        <div className="text-xs text-white/50">Telefone</div>
                        <div className="font-medium">{r.telefone}</div>
                      </div>

                      <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 md:col-span-2">
                        <div className="text-xs text-white/50">Observação</div>
                        <div className="mt-1 whitespace-pre-wrap break-words text-sm text-white/85">
                          {String(r.observacao ?? '').trim() ? r.observacao : <span className="text-white/45">—</span>}
                        </div>
                      </div>
                    </div>

                    {r.created_at ? (
                      <div className="mt-3 text-xs text-white/45">
                        Criado em: {new Date(r.created_at).toLocaleString('pt-BR')}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}