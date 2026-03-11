'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

type Status = 'pendente' | 'aprovado_cortesia' | 'aprovado_venda' | 'cancelado' | string
type Tipo = 'aniversario' | 'cortesia' | 'venda' | string

type ReservaRow = {
  id: any
  user_id?: string | null
  data_evento: string
  espaco_id: string
  modelo_preco?: string | null
  valor_espaco?: number | null
  valor_sinal?: number | null
  nome: string
  telefone: string
  tipo: Tipo
  status: Status
  observacao?: string | null
  comprovante_url: string | null
  created_at?: string
}

type ProfileRow = {
  id: string
  full_name: string | null
  role: string | null
}

type ReservaLogRow = {
  id: number
  reserva_id: string
  acao: string
  status_anterior: string | null
  status_novo: string | null
  user_id: string | null
  user_nome: string | null
  detalhes: any
  created_at: string
}

function todayISO() {
  const d = new Date()
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function norm(s: any) {
  return String(s ?? '').trim().toUpperCase()
}
function normLower(s: any) {
  return String(s ?? '').trim().toLowerCase()
}
function onlyDigits(s: any) {
  return String(s ?? '').replace(/\D/g, '')
}

function isPendente(status: Status) {
  return normLower(status) === 'pendente'
}
function isAprovado(status: Status) {
  const s = normLower(status)
  return s === 'aprovado_venda' || s === 'aprovado_cortesia'
}
function isCancelado(status: Status) {
  return normLower(status) === 'cancelado'
}

function isCamarote(espacoId: string) {
  const id = norm(espacoId)
  if (id === 'NUVEM') return true
  return /^C([1-9]|1[0-4])$/.test(id)
}
function isMesa(espacoId: string) {
  const id = norm(espacoId)
  if (!id.startsWith('M')) return false
  const num = Number(id.replace('M', ''))
  if (Number.isNaN(num)) return false
  if (num >= 1 && num <= 19) return true
  return [117, 120, 125].includes(num)
}

function mesaNumero(espacoId: string) {
  const id = norm(espacoId)
  if (!id.startsWith('M')) return null
  const num = Number(id.replace('M', ''))
  if (Number.isNaN(num)) return null
  return num
}
function camaroteNumero(espacoId: string) {
  const id = norm(espacoId)
  if (id === 'NUVEM') return 999
  if (!id.startsWith('C')) return null
  const num = Number(id.replace('C', ''))
  if (Number.isNaN(num)) return null
  return num
}

function ordenarCamarotes(a: ReservaRow, b: ReservaRow) {
  const na = camaroteNumero(a.espaco_id) ?? 999
  const nb = camaroteNumero(b.espaco_id) ?? 999
  return na - nb
}
function ordenarMesas(a: ReservaRow, b: ReservaRow) {
  const especiais = [117, 120, 125]
  const na = mesaNumero(a.espaco_id) ?? 9999
  const nb = mesaNumero(b.espaco_id) ?? 9999

  const aEsp = especiais.includes(na)
  const bEsp = especiais.includes(nb)

  if (aEsp && bEsp) return na - nb
  if (aEsp) return 1
  if (bEsp) return -1
  return na - nb
}

function displayLocal(espacoId: string) {
  const id = norm(espacoId)
  if (id.startsWith('M')) {
    const n = id.replace('M', '')
    return n.padStart(n.length <= 2 ? 2 : n.length, '0')
  }
  return id
}

function displayEspacoCompleto(espacoId: string) {
  return `${isMesa(espacoId) ? 'Mesa' : 'Camarote'} ${displayLocal(espacoId)}`
}

function destinoStatusPorTipo(tipo: string): 'aprovado_venda' | 'aprovado_cortesia' {
  const t = normLower(tipo)
  return t === 'venda' ? 'aprovado_venda' : 'aprovado_cortesia'
}

function labelTipo(tipo: string) {
  const t = normLower(tipo)
  if (t === 'venda') return 'Venda'
  if (t === 'cortesia') return 'Cortesia'
  if (t === 'aniversario') return 'Aniversário'
  return String(tipo ?? '')
}

function statusBadgeText(status: Status) {
  const s = normLower(status)
  if (s === 'pendente') return 'PENDENTE'
  if (s === 'aprovado_venda') return 'VENDA APROVADA'
  if (s === 'aprovado_cortesia') return 'CORTESIA APROVADA'
  if (s === 'cancelado') return 'CANCELADA'
  return String(status ?? '').toUpperCase()
}

function statusTone(status: Status): 'neutral' | 'yellow' | 'green' | 'orange' | 'red' | 'blue' {
  const s = normLower(status)
  if (s === 'pendente') return 'yellow'
  if (s === 'aprovado_venda') return 'green'
  if (s === 'aprovado_cortesia') return 'orange'
  if (s === 'cancelado') return 'red'
  return 'neutral'
}

function parseISODateAsLocal(dateISO: string) {
  const [y, m, d] = String(dateISO).split('-').map(Number)
  if (!y || !m || !d) return null
  return new Date(y, m - 1, d)
}

function formatShortDate(dateISO: string) {
  const d = parseISODateAsLocal(dateISO)
  if (!d || isNaN(d.getTime())) return dateISO
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '').toUpperCase()
}

function formatBRDate(dateISO: string) {
  const d = parseISODateAsLocal(dateISO)
  if (!d || isNaN(d.getTime())) return dateISO
  return d.toLocaleDateString('pt-BR')
}

function formatarDataHora(data: string) {
  return new Date(data).toLocaleString('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  })
}

function formatCurrencyBR(value: number | null | undefined) {
  const n = Number(value ?? 0)
  return n.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })
}

function traduzAcao(acao: string) {
  switch (acao) {
    case 'criou_reserva':
      return 'Criou a reserva'
    case 'aprovou_venda':
      return 'Aprovou como venda'
    case 'aprovou_cortesia':
      return 'Aprovou como cortesia'
    case 'cancelou_reserva':
      return 'Cancelou a reserva'
    case 'moveu_para_pendente':
      return 'Moveu para pendente'
    case 'editou_reserva':
      return 'Editou a reserva'
    case 'alterou_status':
      return 'Alterou o status'
    default:
      return acao
  }
}

function getCorAcao(acao: string) {
  switch (acao) {
    case 'criou_reserva':
      return 'bg-sky-500'
    case 'aprovou_venda':
      return 'bg-emerald-500'
    case 'aprovou_cortesia':
      return 'bg-amber-500'
    case 'cancelou_reserva':
      return 'bg-rose-500'
    case 'moveu_para_pendente':
      return 'bg-yellow-500'
    case 'editou_reserva':
      return 'bg-violet-500'
    default:
      return 'bg-neutral-400'
  }
}

function formatPeriodoLabel(dataInicial: string, dataFinal: string) {
  if (dataInicial && dataFinal) {
    if (dataInicial === dataFinal) return formatBRDate(dataInicial)
    return `${formatBRDate(dataInicial)} até ${formatBRDate(dataFinal)}`
  }
  if (dataInicial) return `A partir de ${formatBRDate(dataInicial)}`
  if (dataFinal) return `Até ${formatBRDate(dataFinal)}`
  return 'Período completo'
}

function valorFaltaReceber(r: ReservaRow) {
  const valorBase = Number(r.valor_espaco ?? 0)
  const sinal = Number(r.valor_sinal ?? 0)
  return Math.max(valorBase - sinal, 0)
}

function formatTelefoneRelatorio(tel: string) {
  const d = onlyDigits(tel)
  if (!d) return '****'
  return `${d.slice(0, 4)}****`
}

function csvEscape(value: any) {
  const s = String(value ?? '')
  if (/[",;\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

function downloadCsv(filename: string, headers: string[], rows: (string | number)[][]) {
  const csvContent = [
    headers.map(csvEscape).join(';'),
    ...rows.map((row) => row.map(csvEscape).join(';')),
  ].join('\n')

  const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/** WhatsApp */
function toBRPhoneE164(phoneRaw: string) {
  const d = onlyDigits(phoneRaw)
  if (!d) return ''
  if (d.startsWith('55')) return d
  return `55${d}`
}
function waLink(phoneRaw: string, message: string) {
  const phone = toBRPhoneE164(phoneRaw)
  if (!phone) return ''
  const text = encodeURIComponent(message)
  return `https://wa.me/${phone}?text=${text}`
}
function whatsappMessage(r: ReservaRow) {
  const data = formatBRDate(r.data_evento)
  const espacoLabel = `${isMesa(r.espaco_id) ? 'Mesa' : 'Camarote'} ${displayLocal(r.espaco_id)}`
  const tipo = normLower(r.tipo)
  const status = normLower(r.status)

  if (status === 'pendente') {
    return `Olá, ${r.nome}! Recebemos sua solicitação de reserva (${espacoLabel}) para o dia ${data} no Looby.\n\nAssim que aprovarmos, te avisamos por aqui.`
  }
  if (status === 'aprovado_venda') {
    return `Olá, ${r.nome}! Sua reserva foi APROVADA (${espacoLabel}) para o dia ${data} no Looby. ✅\n\nQualquer dúvida, me chama por aqui.`
  }
  if (status === 'aprovado_cortesia') {
    const label = tipo === 'aniversario' ? 'ANIVERSÁRIO' : 'CORTESIA'
    return `Olá, ${r.nome}! Sua reserva de ${label} foi APROVADA (${espacoLabel}) para o dia ${data} no Looby. ✅\n\nNos vemos lá!`
  }
  if (status === 'cancelado') {
    return `Olá, ${r.nome}. Sua reserva (${espacoLabel}) para o dia ${data} foi CANCELADA. ❌\n\nSe quiser, posso te ajudar a solicitar outra data/espaço.`
  }
  return `Olá, ${r.nome}! Sobre sua reserva (${espacoLabel}) do dia ${data} no Looby, me chama por aqui para atualizarmos o status.`
}

function Pill({
  children,
  tone = 'neutral',
}: {
  children: React.ReactNode
  tone?: 'neutral' | 'yellow' | 'green' | 'orange' | 'red' | 'blue'
}) {
  const cls =
    tone === 'yellow'
      ? 'bg-yellow-50 text-yellow-700 border-yellow-200'
      : tone === 'green'
        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
        : tone === 'orange'
          ? 'bg-orange-50 text-orange-700 border-orange-200'
          : tone === 'red'
            ? 'bg-red-50 text-red-700 border-red-200'
            : tone === 'blue'
              ? 'bg-blue-50 text-blue-700 border-blue-200'
              : 'bg-neutral-100 text-neutral-700 border-neutral-200'

  return <span className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs ${cls}`}>{children}</span>
}

function StatCard({ title, value, hint }: { title: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
      <div className="text-xs text-neutral-500">{title}</div>
      <div className="mt-1 text-3xl font-semibold tracking-tight text-neutral-900">{value}</div>
      {hint ? <div className="mt-1 text-xs text-neutral-400">{hint}</div> : null}
    </div>
  )
}

async function getSignedUrl(path: string) {
  const { data, error } = await supabase.storage.from('comprovantes').createSignedUrl(path, 60 * 10)
  if (error) throw error
  return data.signedUrl
}
function isPdf(path: string) {
  return /\.pdf$/i.test(path)
}

function Section({
  title,
  subtitle,
  right,
  children,
}: {
  title: string
  subtitle?: string
  right?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-neutral-900">{title}</h2>
          {subtitle ? <p className="mt-1 text-sm text-neutral-500">{subtitle}</p> : null}
        </div>
        {right ? <div className="flex items-center gap-2">{right}</div> : null}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  )
}

function EmptyState({ text }: { text: string }) {
  return <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-6 text-sm text-neutral-500">{text}</div>
}

function ReservationCard({
  r,
  disabled,
  onAprovar,
  onCancelar,
  onVerComprovante,
  onVerDetalhes,
  solicitanteNome,
  compact = false,
}: {
  r: ReservaRow
  disabled: boolean
  onAprovar?: () => void
  onCancelar?: () => void
  onVerComprovante?: () => void
  onVerDetalhes?: () => void
  solicitanteNome?: string
  compact?: boolean
}) {
  const hasObsText = !!String(r.observacao ?? '').trim()
  const hasFile = !!r.comprovante_url
  const msg = whatsappMessage(r)
  const link = waLink(r.telefone, msg)
  const modeloPrecoText = String(r.modelo_preco ?? '').trim()
  const localLabel = `${isMesa(r.espaco_id) ? 'Mesa' : 'Camarote'} ${displayLocal(r.espaco_id)}`
  const dataCurta = formatShortDate(r.data_evento)
  const temValorSinal = Number(r.valor_sinal ?? 0) > 0
  const temValorEspaco = Number(r.valor_espaco ?? 0) > 0
  const faltaReceber = valorFaltaReceber(r)

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <div className="text-base font-semibold tracking-tight text-neutral-900">
              {localLabel} <span className="text-neutral-300">•</span> {dataCurta}
            </div>
            <Pill tone={statusTone(r.status)}>{statusBadgeText(r.status)}</Pill>
          </div>

          <div className="mt-3 space-y-2">
            <div className="text-base font-medium text-neutral-900">{r.nome}</div>
            <div className="text-sm text-neutral-600">{r.telefone}</div>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <Pill tone="blue">{labelTipo(r.tipo)}</Pill>
            {modeloPrecoText ? <Pill tone="blue">Modelo: {modeloPrecoText}</Pill> : null}
            {temValorEspaco ? <Pill tone="blue">Valor: {formatCurrencyBR(r.valor_espaco)}</Pill> : null}
            {temValorSinal ? <Pill tone="green">Sinal: {formatCurrencyBR(r.valor_sinal)}</Pill> : null}
            {normLower(r.status) === 'aprovado_venda' ? <Pill tone="yellow">Falta: {formatCurrencyBR(faltaReceber)}</Pill> : null}
            <Pill tone="blue">Resp: {solicitanteNome ?? (r.user_id ? r.user_id.slice(0, 8) : '—')}</Pill>
            {hasObsText ? <Pill>Observação</Pill> : null}
            {hasFile ? <Pill>Anexo</Pill> : null}
            {r.created_at ? <Pill tone="yellow">Pedido: {formatarDataHora(r.created_at)}</Pill> : null}
          </div>

          {!compact && (hasObsText || hasFile || temValorSinal || temValorEspaco) ? (
            <div className="mt-3 space-y-2">
              {temValorEspaco ? (
                <div className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2">
                  <div className="text-xs text-blue-700">Valor da mesa/camarote</div>
                  <div className="mt-1 text-sm font-semibold text-blue-900">{formatCurrencyBR(r.valor_espaco)}</div>
                </div>
              ) : null}

              {temValorSinal ? (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2">
                  <div className="text-xs text-emerald-700">Valor de sinal adiantado</div>
                  <div className="mt-1 text-sm font-semibold text-emerald-900">{formatCurrencyBR(r.valor_sinal)}</div>
                </div>
              ) : null}

              {normLower(r.status) === 'aprovado_venda' ? (
                <div className="rounded-xl border border-yellow-200 bg-yellow-50 px-3 py-2">
                  <div className="text-xs text-yellow-700">Falta receber na hora</div>
                  <div className="mt-1 text-sm font-semibold text-yellow-900">{formatCurrencyBR(faltaReceber)}</div>
                </div>
              ) : null}

              {hasObsText ? (
                <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2">
                  <div className="text-xs text-neutral-500">Observação</div>
                  <div className="mt-1 whitespace-pre-wrap break-words text-sm text-neutral-800">{r.observacao}</div>
                </div>
              ) : null}

              {hasFile ? (
                <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2">
                  <div className="text-xs text-neutral-500">Anexo</div>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <div className="truncate text-sm text-neutral-700">{r.comprovante_url}</div>
                    <button
                      type="button"
                      onClick={onVerComprovante}
                      disabled={disabled}
                      className="text-sm font-medium text-neutral-900 underline underline-offset-4 hover:text-neutral-700 disabled:opacity-50"
                    >
                      Ver / Baixar
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="flex shrink-0 flex-row gap-2 md:flex-col md:items-stretch">
          {onVerDetalhes ? (
            <button
              type="button"
              onClick={onVerDetalhes}
              className="rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm font-semibold text-neutral-700 hover:bg-neutral-50"
            >
              Detalhes
            </button>
          ) : null}

          <button
            type="button"
            onClick={() => {
              if (!link) return alert('Telefone inválido/ausente para enviar WhatsApp.')
              window.open(link, '_blank', 'noopener,noreferrer')
            }}
            className="rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm font-semibold text-neutral-700 hover:bg-neutral-50"
          >
            WhatsApp
          </button>

          {onVerComprovante && hasFile ? (
            <button
              type="button"
              onClick={onVerComprovante}
              disabled={disabled}
              className="rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm font-semibold text-neutral-700 hover:bg-neutral-50 disabled:opacity-55"
            >
              Anexo
            </button>
          ) : null}

          {onCancelar ? (
            <button
              onClick={onCancelar}
              disabled={disabled}
              className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-55"
            >
              {disabled ? 'Salvando…' : 'Cancelar'}
            </button>
          ) : null}

          {onAprovar ? (
            <button
              onClick={onAprovar}
              disabled={disabled}
              className={`rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-55 ${
                normLower(r.tipo) === 'venda' ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-orange-500 hover:bg-orange-400'
              }`}
            >
              {disabled ? 'Salvando…' : normLower(r.tipo) === 'venda' ? 'Aprovar venda' : 'Aprovar cortesia'}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  )
}

export default function AdminPage() {
  const router = useRouter()

  const [mainTab, setMainTab] = useState<'pendentes' | 'relatorios' | 'financeiro'>('pendentes')
  const [relatorioStatus, setRelatorioStatus] = useState<'todas' | 'pendentes' | 'aprovadas' | 'canceladas'>('todas')

  const [reservas, setReservas] = useState<ReservaRow[]>([])
  const [pendentesGlobais, setPendentesGlobais] = useState<ReservaRow[]>([])
  const [loading, setLoading] = useState(true)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [erroUi, setErroUi] = useState<string | null>(null)

  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [authChecking, setAuthChecking] = useState(true)

  const [profiles, setProfiles] = useState<ProfileRow[]>([])
  const profileNameById = useMemo(() => {
    const m = new Map<string, string>()
    profiles.forEach((p) => {
      const nm = String(p.full_name ?? '').trim()
      m.set(p.id, nm || p.id.slice(0, 8))
    })
    return m
  }, [profiles])

  const [dataInicial, setDataInicial] = useState<string>(todayISO())
  const [dataFinal, setDataFinal] = useState<string>(todayISO())
  const [tipoFiltro, setTipoFiltro] = useState<'todas' | 'venda' | 'cortesia' | 'aniversario'>('todas')
  const [userFiltro, setUserFiltro] = useState<'todos' | string>('todos')
  const [espacoTipoFiltro, setEspacoTipoFiltro] = useState<'todos' | 'mesa' | 'camarote'>('todos')
  const [busca, setBusca] = useState('')

  const [modalOpen, setModalOpen] = useState(false)
  const [modalTitle, setModalTitle] = useState<string>('')
  const [modalUrl, setModalUrl] = useState<string | null>(null)
  const [modalPath, setModalPath] = useState<string | null>(null)
  const [modalLoading, setModalLoading] = useState(false)

  const [detailsOpen, setDetailsOpen] = useState(false)
  const [reservaSelecionada, setReservaSelecionada] = useState<ReservaRow | null>(null)
  const [logsReserva, setLogsReserva] = useState<ReservaLogRow[]>([])
  const [loadingLogs, setLoadingLogs] = useState(false)

  const [editMode, setEditMode] = useState(false)
  const [editNome, setEditNome] = useState('')
  const [editTelefone, setEditTelefone] = useState('')
  const [editTipo, setEditTipo] = useState<Tipo>('venda')
  const [editStatus, setEditStatus] = useState<Status>('pendente')
  const [editModeloPreco, setEditModeloPreco] = useState('')
  const [editValorEspaco, setEditValorEspaco] = useState('')
  const [editValorSinal, setEditValorSinal] = useState('')
  const [editObservacao, setEditObservacao] = useState('')
  const [addSinalValor, setAddSinalValor] = useState('')

  const periodoLabel = useMemo(() => formatPeriodoLabel(dataInicial, dataFinal), [dataInicial, dataFinal])

  useEffect(() => {
    async function checkAccess() {
      const { data } = await supabase.auth.getUser()
      const user = data.user

      if (!user) {
        router.push('/login?next=/admin')
        return
      }

      setUserEmail(user.email ?? null)

      const { data: adminRow, error: adminErr } = await supabase
        .from('admins')
        .select('user_id')
        .eq('user_id', user.id)
        .maybeSingle()

      if (adminErr || !adminRow) {
        alert('Seu usuário não tem permissão de ADMIN para acessar este painel.')
        await supabase.auth.signOut()
        router.push('/login?next=/admin')
        return
      }

      setAuthChecking(false)
    }

    checkAccess()
  }, [router])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login?next=/admin')
  }

  async function fetchProfiles() {
    const { data, error } = await supabase.from('profiles').select('id,full_name,role').order('full_name', { ascending: true })
    if (error) {
      console.warn('Erro ao buscar profiles:', error)
      return
    }
    setProfiles((data ?? []) as ProfileRow[])
  }

  function applyTipoToQuery(q: any) {
    if (tipoFiltro === 'todas') return q
    return q.eq('tipo', tipoFiltro)
  }

  function applyUserToQuery(q: any) {
    if (userFiltro === 'todos') return q
    return q.eq('user_id', userFiltro)
  }

  function applyBuscaToQuery(q: any) {
    const s = busca.trim()
    if (!s) return q

    const digits = onlyDigits(s)
    if (digits.length >= 6) {
      return q.or(`telefone.ilike.%${digits}%,nome.ilike.%${s}%,espaco_id.ilike.%${s}%`)
    }
    return q.or(`nome.ilike.%${s}%,espaco_id.ilike.%${s}%`)
  }

  function applyEspacoTipoToQuery(q: any) {
    if (espacoTipoFiltro === 'todos') return q
    if (espacoTipoFiltro === 'mesa') return q.ilike('espaco_id', 'M%')
    return q.or('espaco_id.ilike.C%,espaco_id.eq.NUVEM')
  }

  async function fetchReservas() {
    setErroUi(null)

    if (dataInicial && dataFinal && dataInicial > dataFinal) {
      setErroUi('A data inicial não pode ser maior que a data final.')
      setReservas([])
      setPendentesGlobais([])
      setLoading(false)
      return
    }

    setLoading(true)

    try {
      let qFiltrada = supabase.from('reservas').select('*').order('created_at', { ascending: false })

      if (dataInicial) qFiltrada = qFiltrada.gte('data_evento', dataInicial)
      if (dataFinal) qFiltrada = qFiltrada.lte('data_evento', dataFinal)

      qFiltrada = applyTipoToQuery(qFiltrada)
      qFiltrada = applyUserToQuery(qFiltrada)
      qFiltrada = applyEspacoTipoToQuery(qFiltrada)
      qFiltrada = applyBuscaToQuery(qFiltrada)

      const qPendentes = supabase
        .from('reservas')
        .select('*')
        .eq('status', 'pendente')
        .order('created_at', { ascending: true })

      const [{ data: dataFiltrada, error: errorFiltrada }, { data: dataPendentes, error: errorPendentes }] = await Promise.all([
        qFiltrada,
        qPendentes,
      ])

      if (errorFiltrada) {
        console.error('Erro ao buscar reservas filtradas:', errorFiltrada)
        setErroUi(`Erro ao buscar reservas: ${errorFiltrada.message}`)
        setReservas([])
      } else {
        setReservas(((dataFiltrada as ReservaRow[]) || []) as ReservaRow[])
      }

      if (errorPendentes) {
        console.error('Erro ao buscar fila de pendentes:', errorPendentes)
        setErroUi((prev) => prev ?? `Erro ao buscar pendentes: ${errorPendentes.message}`)
        setPendentesGlobais([])
      } else {
        setPendentesGlobais(((dataPendentes as ReservaRow[]) || []) as ReservaRow[])
      }
    } finally {
      setLoading(false)
    }
  }

  async function carregarLogsReserva(reservaId: string) {
    setLoadingLogs(true)

    const { data, error } = await supabase
      .from('reservas_log')
      .select('*')
      .eq('reserva_id', reservaId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Erro ao carregar histórico da reserva:', error)
      setLogsReserva([])
      setLoadingLogs(false)
      return
    }

    setLogsReserva((data || []) as ReservaLogRow[])
    setLoadingLogs(false)
  }

  function popularFormularioEdicao(r: ReservaRow) {
    setEditNome(String(r.nome ?? ''))
    setEditTelefone(String(r.telefone ?? ''))
    setEditTipo((normLower(r.tipo) || 'venda') as Tipo)
    setEditStatus((normLower(r.status) || 'pendente') as Status)
    setEditModeloPreco(String(r.modelo_preco ?? ''))
    setEditValorEspaco(r.valor_espaco != null ? String(r.valor_espaco) : '')
    setEditValorSinal(r.valor_sinal != null ? String(r.valor_sinal) : '')
    setEditObservacao(String(r.observacao ?? ''))
    setAddSinalValor('')
  }

  async function abrirDetalhesReserva(r: ReservaRow) {
    setReservaSelecionada(r)
    setDetailsOpen(true)
    setEditMode(false)
    popularFormularioEdicao(r)
    await carregarLogsReserva(String(r.id))
  }

  function fecharDetalhesReserva() {
    setDetailsOpen(false)
    setReservaSelecionada(null)
    setLogsReserva([])
    setEditMode(false)
    setAddSinalValor('')
  }

  useEffect(() => {
    if (authChecking) return
    fetchProfiles()
    fetchReservas()
  }, [authChecking])

  useEffect(() => {
    if (authChecking) return
    fetchReservas()
  }, [dataInicial, dataFinal, tipoFiltro, userFiltro, espacoTipoFiltro, busca, authChecking])

  useEffect(() => {
    if (authChecking) return
    const channel = supabase
      .channel('admin-reservas-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reservas' }, () => fetchReservas())
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [authChecking, dataInicial, dataFinal, tipoFiltro, userFiltro, espacoTipoFiltro, busca])

  async function aprovarReserva(r: ReservaRow) {
    setErroUi(null)
    const idStr = String(r.id)
    const novoStatus = destinoStatusPorTipo(r.tipo)
    setUpdatingId(idStr)

    try {
      const upd = await supabase.from('reservas').update({ status: novoStatus }).eq('id', r.id).select('id,status')
      if (upd.error) {
        console.error('Erro update:', upd.error)
        setErroUi(`Falha ao aprovar: ${upd.error.message}`)
        return
      }
      await fetchReservas()

      const atualizada = { ...r, status: novoStatus }
      if (reservaSelecionada && String(reservaSelecionada.id) === idStr) {
        setReservaSelecionada(atualizada)
        popularFormularioEdicao(atualizada)
        await carregarLogsReserva(idStr)
      }
    } finally {
      setUpdatingId(null)
    }
  }

  async function cancelarReserva(r: ReservaRow) {
    const localLabel = `${isMesa(r.espaco_id) ? 'Mesa' : 'Camarote'} ${displayLocal(r.espaco_id)}`
    const confirmar = window.confirm(`Tem certeza que deseja cancelar a reserva de ${localLabel} para ${r.nome}?`)

    if (!confirmar) return

    setErroUi(null)
    const idStr = String(r.id)
    setUpdatingId(idStr)

    try {
      const upd = await supabase.from('reservas').update({ status: 'cancelado' }).eq('id', r.id).select('id,status')
      if (upd.error) {
        console.error('Erro cancel:', upd.error)
        setErroUi(`Falha ao cancelar: ${upd.error.message}`)
        return
      }
      await fetchReservas()

      const atualizada = { ...r, status: 'cancelado' }
      if (reservaSelecionada && String(reservaSelecionada.id) === idStr) {
        setReservaSelecionada(atualizada)
        popularFormularioEdicao(atualizada)
        await carregarLogsReserva(idStr)
      }
    } finally {
      setUpdatingId(null)
    }
  }

  async function salvarEdicaoReserva() {
    if (!reservaSelecionada) return

    const nome = editNome.trim()
    const telefone = onlyDigits(editTelefone)
    const tipo = normLower(editTipo)
    let status = normLower(editStatus)
    const modeloPreco = editModeloPreco.trim() || null
    const observacao = editObservacao.trim() || null

    if (!nome) {
      alert('Preencha o nome.')
      return
    }

    if (telefone.length < 10) {
      alert('Telefone inválido.')
      return
    }

    let valorEspaco: number | null = null
    let valorSinal: number | null = null

    if (tipo === 'venda') {
      const espacoNum = editValorEspaco.trim() === '' ? NaN : Number(editValorEspaco.replace(',', '.'))
      const sinalNum = editValorSinal.trim() === '' ? 0 : Number(editValorSinal.replace(',', '.'))

      if (!Number.isFinite(espacoNum) || espacoNum <= 0) {
        alert('Informe um valor da mesa/camarote válido.')
        return
      }

      if (!Number.isFinite(sinalNum) || sinalNum < 0) {
        alert('Informe um valor de sinal válido.')
        return
      }

      if (sinalNum > espacoNum) {
        alert('O valor do sinal não pode ser maior que o valor total.')
        return
      }

      valorEspaco = espacoNum
      valorSinal = sinalNum

      if (status !== 'pendente' && status !== 'aprovado_venda' && status !== 'cancelado') {
        status = 'aprovado_venda'
      }
    } else {
      valorEspaco = null
      valorSinal = null

      if (status === 'aprovado_venda') {
        status = 'aprovado_cortesia'
      }
      if (status !== 'pendente' && status !== 'aprovado_cortesia' && status !== 'cancelado') {
        status = 'aprovado_cortesia'
      }
    }

    setErroUi(null)
    const idStr = String(reservaSelecionada.id)
    setUpdatingId(idStr)

    try {
      const payload = {
        nome,
        telefone,
        tipo,
        status,
        modelo_preco: tipo === 'venda' ? modeloPreco : null,
        valor_espaco: tipo === 'venda' ? valorEspaco : null,
        valor_sinal: tipo === 'venda' ? valorSinal : null,
        observacao,
      }

      const { data, error } = await supabase.from('reservas').update(payload).eq('id', reservaSelecionada.id).select('*').single()

      if (error) {
        console.error('Erro ao editar reserva:', error)
        setErroUi(`Falha ao editar reserva: ${error.message}`)
        return
      }

      const atualizada = data as ReservaRow
      setReservaSelecionada(atualizada)
      popularFormularioEdicao(atualizada)
      setEditMode(false)
      await fetchReservas()
      await carregarLogsReserva(idStr)
      alert('Reserva atualizada com sucesso.')
    } finally {
      setUpdatingId(null)
    }
  }

  async function adicionarAoSinalReserva() {
    if (!reservaSelecionada) return

    if (normLower(reservaSelecionada.tipo) !== 'venda') {
      alert('Só é possível adicionar sinal em reservas de venda.')
      return
    }

    const adicional = Number(addSinalValor.replace(',', '.'))
    const atual = Number(reservaSelecionada.valor_sinal ?? 0)
    const valorTotal = Number(reservaSelecionada.valor_espaco ?? 0)

    if (!Number.isFinite(adicional) || adicional <= 0) {
      alert('Informe um valor válido para adicionar ao sinal.')
      return
    }

    const novoSinal = atual + adicional

    if (valorTotal > 0 && novoSinal > valorTotal) {
      alert('O novo sinal não pode ultrapassar o valor total da reserva.')
      return
    }

    setErroUi(null)
    const idStr = String(reservaSelecionada.id)
    setUpdatingId(idStr)

    try {
      const { data, error } = await supabase
        .from('reservas')
        .update({ valor_sinal: novoSinal })
        .eq('id', reservaSelecionada.id)
        .select('*')
        .single()

      if (error) {
        console.error('Erro ao adicionar ao sinal:', error)
        setErroUi(`Falha ao atualizar sinal: ${error.message}`)
        return
      }

      const atualizada = data as ReservaRow
      setReservaSelecionada(atualizada)
      popularFormularioEdicao(atualizada)
      setAddSinalValor('')
      await fetchReservas()
      await carregarLogsReserva(idStr)
      alert('Valor do sinal atualizado com sucesso.')
    } finally {
      setUpdatingId(null)
    }
  }

  async function abrirComprovante(r: ReservaRow) {
    if (!r.comprovante_url) return
    setModalOpen(true)
    setModalTitle(`${isMesa(r.espaco_id) ? 'Mesa' : 'Camarote'} ${displayLocal(r.espaco_id)} • ${r.data_evento}`)
    setModalPath(r.comprovante_url)
    setModalUrl(null)
    setModalLoading(true)

    try {
      const url = await getSignedUrl(r.comprovante_url)
      setModalUrl(url)
    } catch (e: any) {
      console.error(e)
      setErroUi(`Erro ao gerar link do comprovante: ${e?.message ?? e}`)
      setModalUrl(null)
    } finally {
      setModalLoading(false)
    }
  }

  const computed = useMemo(() => {
    const pendentesPeriodo = reservas.filter((r) => isPendente(r.status))
    const aprovadas = reservas.filter((r) => isAprovado(r.status))
    const canceladas = reservas.filter((r) => isCancelado(r.status))

    const vendasAprovadas = aprovadas.filter((r) => normLower(r.status) === 'aprovado_venda')
    const cortesiasAprovadas = aprovadas.filter((r) => normLower(r.status) === 'aprovado_cortesia')

    const reservasVenda = reservas.filter((r) => normLower(r.tipo) === 'venda')
    const reservasVendaAprovadas = reservas.filter((r) => normLower(r.status) === 'aprovado_venda')

    const totalSinal = reservasVendaAprovadas.reduce((acc, r) => acc + Number(r.valor_sinal ?? 0), 0)

    const totalFaltaReceber = reservasVendaAprovadas.reduce((acc, r) => {
      return acc + valorFaltaReceber(r)
    }, 0)

    const porEventoMap = new Map<
      string,
      {
        data_evento: string
        totalSinais: number
        totalFaltaReceber: number
        reservasVenda: number
      }
    >()

    reservasVendaAprovadas.forEach((r) => {
      const key = r.data_evento
      const atual = porEventoMap.get(key) ?? {
        data_evento: key,
        totalSinais: 0,
        totalFaltaReceber: 0,
        reservasVenda: 0,
      }

      const sinal = Number(r.valor_sinal ?? 0)
      const falta = valorFaltaReceber(r)

      atual.totalSinais += sinal
      atual.totalFaltaReceber += falta
      atual.reservasVenda += 1

      porEventoMap.set(key, atual)
    })

    const financeiroPorEvento = Array.from(porEventoMap.values()).sort((a, b) => a.data_evento.localeCompare(b.data_evento))

    const pendentesFila = [...pendentesGlobais].sort((a, b) => {
      const ta = a.created_at ? new Date(a.created_at).getTime() : 0
      const tb = b.created_at ? new Date(b.created_at).getTime() : 0
      return ta - tb
    })

    const pendentesFilaMesas = pendentesFila.filter((r) => r.espaco_id && isMesa(r.espaco_id))
    const pendentesFilaCamarotes = pendentesFila.filter((r) => r.espaco_id && isCamarote(r.espaco_id))

    const cobrancaRecepcao = [...reservasVendaAprovadas].sort((a, b) => {
      const dateCmp = String(a.data_evento).localeCompare(String(b.data_evento))
      if (dateCmp !== 0) return dateCmp

      const aMesa = isMesa(a.espaco_id)
      const bMesa = isMesa(b.espaco_id)

      if (aMesa && bMesa) return ordenarMesas(a, b)
      if (!aMesa && !bMesa) return ordenarCamarotes(a, b)
      if (!aMesa && bMesa) return -1
      return 1
    })

    return {
      pendentesPeriodo,
      aprovadas,
      canceladas,
      vendasAprovadas,
      cortesiasAprovadas,
      totalSinal,
      totalFaltaReceber,
      financeiroPorEvento,
      reservasVenda,
      reservasVendaAprovadas,
      pendentesFila,
      pendentesFilaMesas,
      pendentesFilaCamarotes,
      cobrancaRecepcao,
    }
  }, [reservas, pendentesGlobais])

  const totalPeriodo = reservas.length

  const rankingUsers = useMemo(() => {
    const map = new Map<string, number>()
    reservas.forEach((r) => {
      if (!r.user_id) return
      map.set(r.user_id, (map.get(r.user_id) ?? 0) + 1)
    })
    return Array.from(map.entries())
      .map(([uid, count]) => ({ uid, count, name: profileNameById.get(uid) ?? uid.slice(0, 8) }))
      .sort((a, b) => b.count - a.count)
  }, [reservas, profileNameById])

  const listaRelatorio = useMemo(() => {
    if (relatorioStatus === 'todas') return reservas
    if (relatorioStatus === 'pendentes') return reservas.filter((r) => isPendente(r.status))
    if (relatorioStatus === 'aprovadas') return reservas.filter((r) => isAprovado(r.status))
    return reservas.filter((r) => isCancelado(r.status))
  }, [reservas, relatorioStatus])

  function exportarRelatorioCobranca() {
    if (computed.cobrancaRecepcao.length === 0) {
      alert('Não há reservas aprovadas de venda para exportar no período selecionado.')
      return
    }

    const rows = computed.cobrancaRecepcao.map((r) => [
      formatBRDate(r.data_evento),
      displayEspacoCompleto(r.espaco_id),
      r.nome,
      formatTelefoneRelatorio(r.telefone),
      Number(r.valor_sinal ?? 0).toFixed(2).replace('.', ','),
      Number(r.valor_espaco ?? 0).toFixed(2).replace('.', ','),
      valorFaltaReceber(r).toFixed(2).replace('.', ','),
    ])

    const filename =
      dataInicial && dataFinal && dataInicial === dataFinal
        ? `relatorio-cobranca-${dataInicial}.csv`
        : `relatorio-cobranca-${dataInicial || 'inicio'}-${dataFinal || 'fim'}.csv`

    downloadCsv(
      filename,
      [
        'Data do evento',
        'Espaço',
        'Nome do cliente',
        'Telefone',
        'Valor sinal antecipado',
        'Valor total',
        'Falta receber na hora',
      ],
      rows
    )
  }

  if (authChecking) {
    return <div className="min-h-screen bg-neutral-50 p-8 text-neutral-700">Verificando permissão…</div>
  }

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900">
      <div className="sticky top-0 z-40 border-b border-neutral-200 bg-white/85 backdrop-blur">
        <div className="mx-auto max-w-6xl px-6 py-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">Admin — Looby Reservas</h1>
              <p className="mt-1 text-sm text-neutral-500">
                Logado como: <span className="font-semibold text-neutral-900">{userEmail ?? '—'}</span>{' '}
                <span className="text-neutral-400">(ADMIN)</span>
              </p>
              {erroUi ? <p className="mt-3 text-sm text-red-600">{erroUi}</p> : null}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => router.push('/')}
                className="rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm font-semibold text-neutral-700 hover:bg-neutral-50"
              >
                Ver mapa
              </button>
              <button
                onClick={fetchReservas}
                className="rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm font-semibold text-neutral-700 hover:bg-neutral-50"
              >
                Atualizar
              </button>
              <button onClick={handleLogout} className="rounded-xl bg-neutral-900 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-800">
                Sair
              </button>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              onClick={() => setMainTab('pendentes')}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                mainTab === 'pendentes' ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
              }`}
            >
              Pendentes
            </button>

            <button
              onClick={() => setMainTab('relatorios')}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                mainTab === 'relatorios' ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
              }`}
            >
              Relatórios
            </button>

            <button
              onClick={() => setMainTab('financeiro')}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                mainTab === 'financeiro' ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
              }`}
            >
              Financeiro
            </button>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-12">
            <div className="md:col-span-3">
              <label className="text-xs text-neutral-500">Data inicial</label>
              <input
                type="date"
                value={dataInicial}
                onChange={(e) => setDataInicial(e.target.value)}
                className="mt-1 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:border-neutral-400"
              />
            </div>

            <div className="md:col-span-3">
              <label className="text-xs text-neutral-500">Data final</label>
              <input
                type="date"
                value={dataFinal}
                onChange={(e) => setDataFinal(e.target.value)}
                className="mt-1 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:border-neutral-400"
              />
            </div>

            <div className="md:col-span-3">
              <label className="text-xs text-neutral-500">Usuário</label>
              <select
                value={userFiltro}
                onChange={(e) => setUserFiltro(e.target.value as any)}
                className="mt-1 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:border-neutral-400"
              >
                <option value="todos">Todos</option>
                {profiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {(p.full_name ?? p.id.slice(0, 8)).toString()}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-3">
              <label className="text-xs text-neutral-500">Tipo</label>
              <select
                value={tipoFiltro}
                onChange={(e) => setTipoFiltro(e.target.value as any)}
                className="mt-1 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:border-neutral-400"
              >
                <option value="todas">Todos</option>
                <option value="aniversario">Aniversário</option>
                <option value="cortesia">Cortesia</option>
                <option value="venda">Venda</option>
              </select>
            </div>

            <div className="md:col-span-6">
              <label className="text-xs text-neutral-500">Espaço</label>
              <select
                value={espacoTipoFiltro}
                onChange={(e) => setEspacoTipoFiltro(e.target.value as any)}
                className="mt-1 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:border-neutral-400"
              >
                <option value="todos">Mesa + Camarote</option>
                <option value="mesa">Somente Mesas</option>
                <option value="camarote">Somente Camarotes</option>
              </select>
            </div>

            <div className="md:col-span-6">
              <label className="text-xs text-neutral-500">Busca</label>
              <input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Ex: João, 45999…, C4, M13…"
                className="mt-1 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:border-neutral-400"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl space-y-6 px-6 py-8">
        {loading ? (
          <div className="rounded-3xl border border-neutral-200 bg-white p-10 text-neutral-600 shadow-sm">Carregando…</div>
        ) : (
          <>
            {mainTab === 'pendentes' ? (
              <Section
                title={`Fila de pendentes (${computed.pendentesFila.length})`}
                subtitle="Fila global independente de data e filtros. A ordem abaixo respeita a sequência de solicitação: a mais antiga sempre aparece primeiro."
                right={
                  <div className="flex flex-wrap gap-2">
                    <Pill tone="yellow">Total: {computed.pendentesFila.length}</Pill>
                    <Pill tone="blue">Camarotes: {computed.pendentesFilaCamarotes.length}</Pill>
                    <Pill tone="blue">Mesas: {computed.pendentesFilaMesas.length}</Pill>
                  </div>
                }
              >
                <div className="space-y-3">
                  {computed.pendentesFila.length === 0 ? (
                    <EmptyState text="Nenhuma reserva pendente no momento." />
                  ) : (
                    computed.pendentesFila.map((r, index) => (
                      <div key={String(r.id)} className="rounded-3xl border border-yellow-200 bg-yellow-50/60 p-3">
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2">
                            <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-full bg-neutral-900 px-2 text-xs font-bold text-white">
                              {index + 1}
                            </span>
                            <span className="text-sm font-semibold text-neutral-800">Ordem da fila</span>
                          </div>

                          <div className="text-xs text-neutral-500">
                            {r.created_at ? `Solicitado em ${formatarDataHora(r.created_at)}` : 'Data de solicitação indisponível'}
                          </div>
                        </div>

                        <ReservationCard
                          r={r}
                          disabled={updatingId === String(r.id)}
                          onAprovar={() => aprovarReserva(r)}
                          onCancelar={() => cancelarReserva(r)}
                          onVerComprovante={() => abrirComprovante(r)}
                          onVerDetalhes={() => abrirDetalhesReserva(r)}
                          solicitanteNome={r.user_id ? profileNameById.get(r.user_id) : undefined}
                        />
                      </div>
                    ))
                  )}
                </div>
              </Section>
            ) : null}

            {mainTab === 'relatorios' ? (
              <>
                <Section title={`Relatórios — ${periodoLabel}`} subtitle="Resumo operacional do período conforme filtros aplicados.">
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
                    <StatCard title="Reservas" value={totalPeriodo} />
                    <StatCard title="Pendentes" value={computed.pendentesPeriodo.length} />
                    <StatCard title="Aprovadas" value={computed.aprovadas.length} />
                    <StatCard title="Canceladas" value={computed.canceladas.length} />
                    <StatCard title="Vendas" value={computed.vendasAprovadas.length} />
                    <StatCard title="Cortesias" value={computed.cortesiasAprovadas.length} />
                  </div>

                  <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                      <div className="flex items-center justify-between">
                        <h3 className="font-semibold text-neutral-900">Ranking de operadores</h3>
                        <Pill tone="blue">{rankingUsers.length}</Pill>
                      </div>

                      <div className="mt-3 space-y-2">
                        {rankingUsers.length === 0 ? (
                          <EmptyState text="Sem dados no período atual." />
                        ) : (
                          rankingUsers.map((it, idx) => (
                            <div key={it.uid} className="flex items-center justify-between rounded-xl border border-neutral-200 bg-white px-3 py-2">
                              <div className="min-w-0">
                                <div className="truncate text-sm font-semibold text-neutral-900">
                                  {idx + 1}. {it.name}
                                </div>
                              </div>
                              <Pill tone="green">{it.count}</Pill>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                      <div className="flex items-center justify-between">
                        <h3 className="font-semibold text-neutral-900">Filtro da lista</h3>
                        <select
                          value={relatorioStatus}
                          onChange={(e) => setRelatorioStatus(e.target.value as any)}
                          className="rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:border-neutral-400"
                        >
                          <option value="todas">Todas</option>
                          <option value="pendentes">Pendentes</option>
                          <option value="aprovadas">Aprovadas</option>
                          <option value="canceladas">Canceladas</option>
                        </select>
                      </div>

                      <div className="mt-3 text-sm text-neutral-600">A lista abaixo muda conforme esse status.</div>
                    </div>
                  </div>
                </Section>

                <Section title="Lista de reservas" subtitle={`Visualização limpa das reservas de ${periodoLabel}.`}>
                  <div className="space-y-3">
                    {listaRelatorio.length === 0 ? (
                      <EmptyState text="Nenhuma reserva encontrada com os filtros atuais." />
                    ) : (
                      listaRelatorio.map((r) => (
                        <ReservationCard
                          key={String(r.id)}
                          r={r}
                          disabled={updatingId === String(r.id)}
                          onCancelar={!isCancelado(r.status) ? () => cancelarReserva(r) : undefined}
                          onVerComprovante={() => abrirComprovante(r)}
                          onVerDetalhes={() => abrirDetalhesReserva(r)}
                          solicitanteNome={r.user_id ? profileNameById.get(r.user_id) : undefined}
                          compact
                        />
                      ))
                    )}
                  </div>
                </Section>
              </>
            ) : null}

            {mainTab === 'financeiro' ? (
              <>
                <Section
                  title={`Financeiro — ${periodoLabel}`}
                  subtitle="Resumo financeiro das reservas aprovadas de venda no período."
                  right={
                    <button
                      onClick={exportarRelatorioCobranca}
                      className="rounded-xl bg-neutral-900 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-800"
                    >
                      Exportar relatório de cobrança
                    </button>
                  }
                >
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                    <StatCard title="Reservas de venda aprovadas" value={computed.reservasVendaAprovadas.length} />
                    <StatCard title="Total de sinais" value={formatCurrencyBR(computed.totalSinal)} />
                    <StatCard title="Falta receber na hora" value={formatCurrencyBR(computed.totalFaltaReceber)} />
                  </div>
                </Section>

                <Section
                  title="Recepção / cobrança"
                  subtitle="Lista operacional para cobrar o valor restante na entrada. A exportação usa estes mesmos dados."
                >
                  <div className="overflow-x-auto rounded-2xl border border-neutral-200">
                    <table className="min-w-full bg-white text-sm">
                      <thead className="bg-neutral-50">
                        <tr className="text-left text-neutral-600">
                          <th className="px-4 py-3 font-semibold">Data</th>
                          <th className="px-4 py-3 font-semibold">Espaço</th>
                          <th className="px-4 py-3 font-semibold">Nome</th>
                          <th className="px-4 py-3 font-semibold">Telefone</th>
                          <th className="px-4 py-3 font-semibold">Sinal</th>
                          <th className="px-4 py-3 font-semibold">Valor total</th>
                          <th className="px-4 py-3 font-semibold">Falta receber</th>
                        </tr>
                      </thead>
                      <tbody>
                        {computed.cobrancaRecepcao.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="px-4 py-6 text-center text-neutral-500">
                              Nenhuma reserva aprovada de venda no período atual.
                            </td>
                          </tr>
                        ) : (
                          computed.cobrancaRecepcao.map((r) => (
                            <tr key={String(r.id)} className="border-t border-neutral-200">
                              <td className="px-4 py-3">{formatBRDate(r.data_evento)}</td>
                              <td className="px-4 py-3 font-medium text-neutral-900">{displayEspacoCompleto(r.espaco_id)}</td>
                              <td className="px-4 py-3">{r.nome}</td>
                              <td className="px-4 py-3">{formatTelefoneRelatorio(r.telefone)}</td>
                              <td className="px-4 py-3 text-emerald-700">{formatCurrencyBR(r.valor_sinal)}</td>
                              <td className="px-4 py-3 text-blue-700">{formatCurrencyBR(r.valor_espaco)}</td>
                              <td className="px-4 py-3 font-semibold text-yellow-700">{formatCurrencyBR(valorFaltaReceber(r))}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </Section>

                <Section
                  title="Financeiro por evento/data"
                  subtitle="Mostra apenas o total de sinais e o total que falta receber no evento."
                >
                  <div className="space-y-3">
                    {computed.financeiroPorEvento.length === 0 ? (
                      <EmptyState text="Nenhum dado financeiro encontrado no período atual." />
                    ) : (
                      computed.financeiroPorEvento.map((item) => (
                        <div key={item.data_evento} className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                            <div>
                              <div className="text-base font-semibold text-neutral-900">{formatBRDate(item.data_evento)}</div>
                              <div className="mt-1 text-sm text-neutral-500">{item.reservasVenda} reserva(s) de venda aprovada</div>
                            </div>

                            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                                <div className="text-xs text-emerald-700">Total de sinais do evento</div>
                                <div className="mt-1 text-lg font-semibold text-emerald-900">{formatCurrencyBR(item.totalSinais)}</div>
                              </div>

                              <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3">
                                <div className="text-xs text-blue-700">Falta receber na hora</div>
                                <div className="mt-1 text-lg font-semibold text-blue-900">{formatCurrencyBR(item.totalFaltaReceber)}</div>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </Section>
              </>
            ) : null}
          </>
        )}
      </div>

      {detailsOpen && reservaSelecionada && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <button className="absolute inset-0 bg-black/40" onClick={fecharDetalhesReserva} aria-label="Fechar" />

          <div className="relative max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-3xl border border-neutral-200 bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="text-lg font-semibold tracking-tight text-neutral-900">
                  {isMesa(reservaSelecionada.espaco_id) ? 'Mesa' : 'Camarote'} {displayLocal(reservaSelecionada.espaco_id)} •{' '}
                  {formatBRDate(reservaSelecionada.data_evento)}
                </h3>
                <p className="mt-1 text-sm text-neutral-500">
                  {reservaSelecionada.nome} • {reservaSelecionada.telefone}
                </p>
              </div>

              <div className="flex items-center gap-2">
                {reservaSelecionada.comprovante_url ? (
                  <button
                    onClick={() => abrirComprovante(reservaSelecionada)}
                    className="rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm font-semibold text-neutral-700 hover:bg-neutral-50"
                  >
                    Ver anexo
                  </button>
                ) : null}

                <button
                  onClick={fecharDetalhesReserva}
                  className="rounded-xl bg-neutral-900 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-800"
                >
                  Fechar
                </button>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-3">
              <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4 xl:col-span-1">
                <div className="mb-4 flex items-center justify-between">
                  <h4 className="text-sm font-semibold uppercase tracking-[0.18em] text-neutral-500">Dados da reserva</h4>

                  <button
                    onClick={() => {
                      setEditMode((v) => !v)
                      popularFormularioEdicao(reservaSelecionada)
                    }}
                    className="rounded-xl border border-neutral-200 bg-white px-3 py-2 text-xs font-semibold text-neutral-700 hover:bg-neutral-50"
                  >
                    {editMode ? 'Fechar edição' : 'Editar reserva'}
                  </button>
                </div>

                {!editMode ? (
                  <div className="space-y-3 text-sm">
                    <div>
                      <div className="text-neutral-500">Status</div>
                      <div className="mt-1">
                        <Pill tone={statusTone(reservaSelecionada.status)}>{statusBadgeText(reservaSelecionada.status)}</Pill>
                      </div>
                    </div>

                    <div>
                      <div className="text-neutral-500">Tipo</div>
                      <div className="mt-1 font-medium text-neutral-900">{labelTipo(reservaSelecionada.tipo)}</div>
                    </div>

                    <div>
                      <div className="text-neutral-500">Solicitante</div>
                      <div className="mt-1 font-medium text-neutral-900">
                        {reservaSelecionada.user_id ? profileNameById.get(reservaSelecionada.user_id) ?? reservaSelecionada.user_id.slice(0, 8) : '—'}
                      </div>
                    </div>

                    <div>
                      <div className="text-neutral-500">Modelo de preço</div>
                      <div className="mt-1 font-medium text-neutral-900">{String(reservaSelecionada.modelo_preco ?? '').trim() || '—'}</div>
                    </div>

                    <div>
                      <div className="text-neutral-500">Valor da mesa/camarote</div>
                      <div className="mt-1 rounded-xl border border-blue-200 bg-blue-50 p-3 font-semibold text-blue-900">
                        {Number(reservaSelecionada.valor_espaco ?? 0) > 0 ? formatCurrencyBR(reservaSelecionada.valor_espaco) : '—'}
                      </div>
                    </div>

                    <div>
                      <div className="text-neutral-500">Valor do sinal adiantado</div>
                      <div className="mt-1 rounded-xl border border-emerald-200 bg-emerald-50 p-3 font-semibold text-emerald-900">
                        {Number(reservaSelecionada.valor_sinal ?? 0) > 0 ? formatCurrencyBR(reservaSelecionada.valor_sinal) : '—'}
                      </div>
                    </div>

                    <div>
                      <div className="text-neutral-500">Falta receber</div>
                      <div className="mt-1 rounded-xl border border-yellow-200 bg-yellow-50 p-3 font-semibold text-yellow-900">
                        {normLower(reservaSelecionada.tipo) === 'venda' ? formatCurrencyBR(valorFaltaReceber(reservaSelecionada)) : '—'}
                      </div>
                    </div>

                    <div>
                      <div className="text-neutral-500">Observação</div>
                      <div className="mt-1 whitespace-pre-wrap break-words rounded-xl border border-neutral-200 bg-white p-3 text-neutral-800">
                        {String(reservaSelecionada.observacao ?? '').trim() || 'Sem observação'}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3 text-sm">
                    <div>
                      <label className="text-neutral-500">Nome</label>
                      <input
                        value={editNome}
                        onChange={(e) => setEditNome(e.target.value)}
                        className="mt-1 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 outline-none focus:border-neutral-400"
                      />
                    </div>

                    <div>
                      <label className="text-neutral-500">Telefone</label>
                      <input
                        value={editTelefone}
                        onChange={(e) => setEditTelefone(e.target.value)}
                        className="mt-1 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 outline-none focus:border-neutral-400"
                      />
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div>
                        <label className="text-neutral-500">Tipo</label>
                        <select
                          value={editTipo}
                          onChange={(e) => setEditTipo(e.target.value as Tipo)}
                          className="mt-1 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 outline-none focus:border-neutral-400"
                        >
                          <option value="aniversario">Aniversário</option>
                          <option value="cortesia">Cortesia</option>
                          <option value="venda">Venda</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-neutral-500">Status</label>
                        <select
                          value={editStatus}
                          onChange={(e) => setEditStatus(e.target.value as Status)}
                          className="mt-1 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 outline-none focus:border-neutral-400"
                        >
                          <option value="pendente">Pendente</option>
                          <option value="aprovado_venda">Aprovado venda</option>
                          <option value="aprovado_cortesia">Aprovado cortesia</option>
                          <option value="cancelado">Cancelado</option>
                        </select>
                      </div>
                    </div>

                    {normLower(editTipo) === 'venda' ? (
                      <>
                        <div>
                          <label className="text-neutral-500">Modelo de preço</label>
                          <input
                            value={editModeloPreco}
                            onChange={(e) => setEditModeloPreco(e.target.value)}
                            className="mt-1 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 outline-none focus:border-neutral-400"
                          />
                        </div>

                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                          <div>
                            <label className="text-neutral-500">Valor total</label>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={editValorEspaco}
                              onChange={(e) => setEditValorEspaco(e.target.value)}
                              className="mt-1 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 outline-none focus:border-neutral-400"
                            />
                          </div>

                          <div>
                            <label className="text-neutral-500">Valor do sinal</label>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={editValorSinal}
                              onChange={(e) => setEditValorSinal(e.target.value)}
                              className="mt-1 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 outline-none focus:border-neutral-400"
                            />
                          </div>
                        </div>
                      </>
                    ) : null}

                    <div>
                      <label className="text-neutral-500">Observação</label>
                      <textarea
                        value={editObservacao}
                        onChange={(e) => setEditObservacao(e.target.value)}
                        rows={4}
                        className="mt-1 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 outline-none focus:border-neutral-400"
                      />
                    </div>

                    <div className="flex flex-wrap gap-2 pt-2">
                      <button
                        onClick={salvarEdicaoReserva}
                        disabled={updatingId === String(reservaSelecionada.id)}
                        className="rounded-xl bg-neutral-900 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-800 disabled:opacity-55"
                      >
                        {updatingId === String(reservaSelecionada.id) ? 'Salvando…' : 'Salvar edição'}
                      </button>

                      <button
                        onClick={() => {
                          popularFormularioEdicao(reservaSelecionada)
                          setEditMode(false)
                        }}
                        className="rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm font-semibold text-neutral-700 hover:bg-neutral-50"
                      >
                        Cancelar edição
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4 xl:col-span-1">
                <h4 className="text-sm font-semibold uppercase tracking-[0.18em] text-neutral-500">Complementar sinal</h4>

                <div className="mt-4 space-y-3">
                  <div className="rounded-xl border border-neutral-200 bg-white p-3">
                    <div className="text-xs text-neutral-500">Tipo da reserva</div>
                    <div className="mt-1 font-medium text-neutral-900">{labelTipo(reservaSelecionada.tipo)}</div>
                  </div>

                  <div className="rounded-xl border border-blue-200 bg-blue-50 p-3">
                    <div className="text-xs text-blue-700">Valor total</div>
                    <div className="mt-1 font-semibold text-blue-900">
                      {Number(reservaSelecionada.valor_espaco ?? 0) > 0 ? formatCurrencyBR(reservaSelecionada.valor_espaco) : '—'}
                    </div>
                  </div>

                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                    <div className="text-xs text-emerald-700">Sinal atual</div>
                    <div className="mt-1 font-semibold text-emerald-900">
                      {Number(reservaSelecionada.valor_sinal ?? 0) > 0 ? formatCurrencyBR(reservaSelecionada.valor_sinal) : formatCurrencyBR(0)}
                    </div>
                  </div>

                  <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-3">
                    <div className="text-xs text-yellow-700">Falta receber</div>
                    <div className="mt-1 font-semibold text-yellow-900">
                      {normLower(reservaSelecionada.tipo) === 'venda' ? formatCurrencyBR(valorFaltaReceber(reservaSelecionada)) : '—'}
                    </div>
                  </div>

                  {normLower(reservaSelecionada.tipo) === 'venda' ? (
                    <>
                      <div>
                        <label className="text-neutral-500">Adicionar valor ao sinal</label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={addSinalValor}
                          onChange={(e) => setAddSinalValor(e.target.value)}
                          placeholder="Ex: 200.00"
                          className="mt-1 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 outline-none focus:border-neutral-400"
                        />
                      </div>

                      <button
                        onClick={adicionarAoSinalReserva}
                        disabled={updatingId === String(reservaSelecionada.id)}
                        className="w-full rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-55"
                      >
                        {updatingId === String(reservaSelecionada.id) ? 'Salvando…' : 'Adicionar ao sinal'}
                      </button>
                    </>
                  ) : (
                    <div className="rounded-xl border border-neutral-200 bg-white p-3 text-sm text-neutral-500">
                      O complemento de sinal só fica disponível para reservas do tipo venda.
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4 xl:col-span-1">
                <div className="mb-3 flex items-center justify-between">
                  <h4 className="text-sm font-semibold uppercase tracking-[0.18em] text-neutral-500">Histórico de ações</h4>

                  {loadingLogs ? (
                    <span className="text-xs text-neutral-400">Carregando...</span>
                  ) : (
                    <span className="text-xs text-neutral-400">
                      {logsReserva.length} {logsReserva.length === 1 ? 'registro' : 'registros'}
                    </span>
                  )}
                </div>

                {loadingLogs ? (
                  <div className="rounded-2xl border border-neutral-200 bg-white p-4 text-sm text-neutral-500">Carregando histórico...</div>
                ) : logsReserva.length === 0 ? (
                  <div className="rounded-2xl border border-neutral-200 bg-white p-4 text-sm text-neutral-500">
                    Nenhum histórico encontrado para esta reserva.
                  </div>
                ) : (
                  <div className="relative space-y-3">
                    {logsReserva.map((log, index) => (
                      <div key={log.id} className="relative pl-6">
                        <div className={`absolute left-0 top-1.5 h-2.5 w-2.5 rounded-full ${getCorAcao(log.acao)}`} />
                        {index !== logsReserva.length - 1 && (
                          <div className="absolute left-[4px] top-4 h-[calc(100%+0.75rem)] w-px bg-neutral-200" />
                        )}

                        <div className="rounded-2xl border border-neutral-200 bg-white p-3">
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                              <p className="text-sm font-medium text-neutral-900">{traduzAcao(log.acao)}</p>

                              <p className="mt-1 text-xs text-neutral-500">Por: {log.user_nome || 'Usuário não identificado'}</p>

                              {(log.status_anterior || log.status_novo) && (
                                <p className="mt-1 text-xs text-neutral-400">
                                  {log.status_anterior || '—'} → {log.status_novo || '—'}
                                </p>
                              )}

                              {log.detalhes?.espaco_id ? (
                                <p className="mt-1 text-xs text-neutral-400">Espaço: {log.detalhes.espaco_id}</p>
                              ) : null}
                            </div>

                            <span className="text-xs text-neutral-400">{formatarDataHora(log.created_at)}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              {isPendente(reservaSelecionada.status) ? (
                <button
                  onClick={() => aprovarReserva(reservaSelecionada)}
                  disabled={updatingId === String(reservaSelecionada.id)}
                  className={`rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-55 ${
                    normLower(reservaSelecionada.tipo) === 'venda'
                      ? 'bg-emerald-600 hover:bg-emerald-500'
                      : 'bg-orange-500 hover:bg-orange-400'
                  }`}
                >
                  {updatingId === String(reservaSelecionada.id)
                    ? 'Salvando…'
                    : normLower(reservaSelecionada.tipo) === 'venda'
                      ? 'Aprovar venda'
                      : 'Aprovar cortesia'}
                </button>
              ) : null}

              {!isCancelado(reservaSelecionada.status) ? (
                <button
                  onClick={() => cancelarReserva(reservaSelecionada)}
                  disabled={updatingId === String(reservaSelecionada.id)}
                  className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-55"
                >
                  {updatingId === String(reservaSelecionada.id) ? 'Salvando…' : 'Cancelar'}
                </button>
              ) : null}

              <button
                type="button"
                onClick={() => {
                  const link = waLink(reservaSelecionada.telefone, whatsappMessage(reservaSelecionada))
                  if (!link) return alert('Telefone inválido/ausente para enviar WhatsApp.')
                  window.open(link, '_blank', 'noopener,noreferrer')
                }}
                className="rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm font-semibold text-neutral-700 hover:bg-neutral-50"
              >
                WhatsApp
              </button>
            </div>
          </div>
        </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <button
            className="absolute inset-0 bg-black/50"
            onClick={() => {
              setModalOpen(false)
              setModalUrl(null)
              setModalPath(null)
            }}
            aria-label="Fechar"
          />

          <div className="relative w-full max-w-4xl rounded-3xl border border-neutral-200 bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="text-lg font-semibold tracking-tight text-neutral-900">{modalTitle}</h3>
                <p className="mt-1 break-all text-xs text-neutral-500">{modalPath ?? '—'}</p>
              </div>

              <div className="flex items-center gap-2">
                {modalUrl ? (
                  <a
                    href={modalUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm font-semibold text-neutral-700 hover:bg-neutral-50"
                  >
                    Abrir em nova aba
                  </a>
                ) : null}

                <button
                  onClick={() => {
                    setModalOpen(false)
                    setModalUrl(null)
                    setModalPath(null)
                  }}
                  className="rounded-xl bg-neutral-900 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-800"
                >
                  Fechar
                </button>
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-neutral-200 bg-neutral-50 p-3">
              {modalLoading ? (
                <div className="p-10 text-neutral-600">Carregando comprovante…</div>
              ) : !modalUrl ? (
                <div className="p-10 text-neutral-500">Não foi possível gerar o link do comprovante.</div>
              ) : modalPath && isPdf(modalPath) ? (
                <iframe src={modalUrl} className="h-[70vh] w-full rounded-xl bg-white" title="Comprovante PDF" />
              ) : (
                <img src={modalUrl} alt="Comprovante" className="max-h-[70vh] w-full rounded-xl object-contain" />
              )}
            </div>

            <div className="mt-3 text-xs text-neutral-500">Link assinado válido por ~10 minutos.</div>
          </div>
        </div>
      )}
    </div>
  )
}