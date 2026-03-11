'use client'

import { supabase } from '@/lib/supabaseClient'
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

type EspacoTipo = 'MESA' | 'CAMAROTE'
type Espaco = { id: string; nome: string; tipo: EspacoTipo }

type ReservaTipo = 'ANIVERSARIO' | 'CORTESIA' | 'VENDA' | 'NA_HORA'

type ReservaRow = {
  id: string | number
  user_id: string | null
  data_evento: string
  espaco_id: string
  modelo_preco?: string | null
  valor_espaco?: number | null
  valor_sinal?: number | null
  nome: string
  telefone: string
  tipo: string
  status: string
  comprovante_url: string | null
  observacao: string | null
  created_at?: string
}

function todayISO() {
  const d = new Date()
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function dateToISO(d: Date) {
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function isPastDateISO(dateISO: string) {
  return String(dateISO || '') < todayISO()
}

function onlyDigits(s: string) {
  return (s || '').replace(/\D/g, '')
}

function normStatus(s?: string | null) {
  return (s ?? '').toString().trim().toLowerCase()
}

function normTipo(s?: string | null) {
  return (s ?? '').toString().trim().toLowerCase()
}

function safeFileName(name: string) {
  return name.replace(/[^\w.\-]+/g, '_')
}

function getExt(name: string) {
  const p = name.split('.')
  if (p.length <= 1) return 'bin'
  return (p.pop() || 'bin').toLowerCase()
}

function isAllowedFile(file: File) {
  return (
    file.type.startsWith('image/') ||
    file.type === 'application/pdf' ||
    file.name.toLowerCase().endsWith('.pdf')
  )
}

function formatBRPhoneMasked(raw: string) {
  const d = onlyDigits(raw || '')
  if (d.length < 4) return '••••'
  const last4 = d.slice(-4)
  return `(**) *****-${last4}`
}

function formatCurrencyBR(value?: number | null) {
  const n = Number(value ?? 0)
  return n.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })
}

function parseValorBaseModeloPreco(modeloPreco?: string | null) {
  const raw = String(modeloPreco ?? '').trim()
  if (!raw) return ''

  const match = raw.match(/(\d+(?:[.,]\d+)?)/)
  if (!match) return ''

  const n = Number(match[1].replace(',', '.'))
  if (!Number.isFinite(n)) return ''

  return String(n)
}

function getSvgElByKnownId(svgEl: SVGSVGElement, raw: string): SVGGraphicsElement | null {
  const variants = [raw, raw.toLowerCase(), raw.toUpperCase()]

  for (const v of variants) {
    try {
      const found = svgEl.querySelector(`#${CSS.escape(v)}`) as SVGGraphicsElement | null
      if (found) return found
    } catch {
      const found = svgEl.querySelector(`#${v}`) as SVGGraphicsElement | null
      if (found) return found
    }
  }

  return null
}

function getNowBrasil(): Date {
  return new Date(
    new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' })
  )
}

function isJanelaVendaNaHora(now?: Date) {
  const current = now ?? getNowBrasil()
  const h = current.getHours()
  return h >= 23 || h < 7
}

function getDataEventoOperacional(now?: Date) {
  const d = new Date(now ?? getNowBrasil())

  if (d.getHours() < 7) {
    d.setDate(d.getDate() - 1)
  }

  return dateToISO(d)
}

const PRECOS_CAMAROTE = [
  'Camarote 3000/1600 consumação',
  'Camarote 4000/2500 consumação',
  'Camarote 2000/1000 consumação',
  'Camarote 1500/1000 consumação',
  'Camarote 1300/1000 consumação',
]

const PRECOS_MESA = [
  'Mesa Vip 1500/900 consumação',
  'Mesa vip 1000/570 consumação',
  'Mesa vip 870/570 consumação',
  'Mesa vip 700/570 consumação',
]

const RED_CARD =
  'rounded-2xl border border-red-900/60 bg-gradient-to-br from-[#5b1019] via-[#741824] to-[#3f0b12] p-4 shadow-[0_18px_40px_rgba(0,0,0,0.28)]'
const RED_CARD_LIGHT =
  'rounded-2xl border border-red-900/60 bg-gradient-to-br from-[#5b1019] via-[#741824] to-[#3f0b12] p-6 shadow-[0_18px_40px_rgba(0,0,0,0.28)]'
const RED_INNER =
  'rounded-xl border border-white/10 bg-white/8 backdrop-blur-sm'
const INPUT_CLASS =
  'mt-1 w-full rounded-xl border border-red-950/40 bg-white/95 px-3 py-2 text-neutral-900 outline-none transition focus:border-red-700 focus:ring-2 focus:ring-red-700/20'
const LABEL_CLASS = 'text-sm font-medium text-red-50/88'
const MUTED_TEXT = 'text-red-50/70'
const SOFT_TEXT = 'text-red-50/85'
const PRIMARY_BTN =
  'rounded-xl bg-red-900 px-3 py-2 text-sm font-semibold text-white transition hover:bg-red-800'
const SECONDARY_BTN =
  'rounded-lg border border-white/15 bg-white/10 px-3 py-2 text-sm font-semibold text-red-50 transition hover:bg-white/15'
const GHOST_BTN =
  'rounded-lg border border-white/12 bg-white/5 px-2 py-1 text-xs text-red-50/90 transition hover:bg-white/10'

export default function Home() {
  const router = useRouter()

  const [authChecking, setAuthChecking] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)

  const [step, setStep] = useState<'DATA' | 'MAPA'>('DATA')
  const [now, setNow] = useState<Date>(new Date())
  const [dataEvento, setDataEvento] = useState<string>(todayISO())

  const [modalOpen, setModalOpen] = useState(false)
  const [nomeCompleto, setNomeCompleto] = useState('')
  const [telefone, setTelefone] = useState('')
  const [tipoReserva, setTipoReserva] = useState<ReservaTipo>('ANIVERSARIO')
  const [modeloPreco, setModeloPreco] = useState('')
  const [valorEspaco, setValorEspaco] = useState('')
  const [valorSinal, setValorSinal] = useState('')
  const [observacao, setObservacao] = useState('')
  const [anexoObs, setAnexoObs] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)

  const [reservasDia, setReservasDia] = useState<ReservaRow[]>([])
  const [loadingReservas, setLoadingReservas] = useState(false)

  const [selecionadoId, setSelecionadoId] = useState<string | null>(null)
  const [highlightedId, setHighlightedId] = useState<string | null>(null)
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null)

  const [mapScale, setMapScale] = useState(1)
  const [mapOffset, setMapOffset] = useState({ x: 0, y: 0 })
  const [dragging, setDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })

  const [svgMarkup, setSvgMarkup] = useState<string>('')
  const svgWrapRef = useRef<HTMLDivElement | null>(null)
  const svgHostRef = useRef<HTMLDivElement | null>(null)
  const [mapReady, setMapReady] = useState(false)

  const [showLegend, setShowLegend] = useState(true)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [detailsReserva, setDetailsReserva] = useState<ReservaRow | null>(null)

  const [isTouchDevice, setIsTouchDevice] = useState(false)

  const vendaNaHoraAtiva = useMemo(() => isJanelaVendaNaHora(now), [now])
  const dataEventoOperacional = useMemo(() => getDataEventoOperacional(now), [now])

  const isReadOnlyHistorico = useMemo(() => {
    if (vendaNaHoraAtiva && dataEvento === dataEventoOperacional) return false
    return isPastDateISO(dataEvento)
  }, [dataEvento, vendaNaHoraAtiva, dataEventoOperacional])

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(new Date())
    }, 30_000)

    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    if (vendaNaHoraAtiva) {
      setDataEvento(dataEventoOperacional)
    }
  }, [vendaNaHoraAtiva, dataEventoOperacional])

  useEffect(() => {
    if (vendaNaHoraAtiva) {
      setTipoReserva('NA_HORA')
    }
  }, [vendaNaHoraAtiva])

  useEffect(() => {
    if (typeof document === 'undefined') return

    const algumModalAberto = modalOpen || detailsOpen
    const originalOverflow = document.body.style.overflow

    if (algumModalAberto) {
      document.body.style.overflow = 'hidden'
    }

    return () => {
      document.body.style.overflow = originalOverflow
    }
  }, [modalOpen, detailsOpen])

  const VALID_IDS = useMemo(() => {
    const mesas = [
      'vip-125',
      'vip-120',
      'vip-117',
      'm01',
      'm02',
      'm03',
      'm04',
      'm05',
      'm06',
      'm07',
      'm08',
      'm09',
      'm10',
      'm11',
      'm12',
      'm13',
      'm14',
      'm15',
      'm16',
      'm17',
      'm18',
      'm19',
      'pista20',
      'pista21',
      'pista22',
      'pista23',
      'pista24',
      'pista25',
      'pista26',
      'pista27',
      'pista28',
      'pista29',
      'pista30',
      'pista31',
      'pista32',
      'pista33',
      'pista34',
      'pista35',
      'pista36',
      'pista37',
      'pista38',
      'pista39',
      'pista40',
      'pista41',
      'pista42',
      'pista43',
      'pista51',
      'pista52',
      'pista53',
      'pista54',
      'pista55',
      'pista56',
      'pista65',
      'pista66',
      'pista67',
      'pista68',
      'pista69',
      'pista70',
      'pista79',
      'pista80',
      'pista81',
      'pista82',
      'pista83',
      'pista84',
      'pista93',
      'pista94',
      'pista95',
      'pista96',
      'pista97',
      'pista98',
    ]

    const cams = ['c1', 'c2', 'nuvem', 'c3', 'c4', 'c5', 'c6', 'c7', 'c8', 'c9', 'c10', 'c11', 'c12', 'c13', 'c14']

    return [...mesas, ...cams]
  }, [])

  function tipoPorId(id: string): EspacoTipo {
    const x = (id || '').toLowerCase()
    if (x === 'nuvem') return 'CAMAROTE'
    if (x.startsWith('c')) return 'CAMAROTE'
    return 'MESA'
  }

  const selecionado: Espaco | null = useMemo(() => {
    if (!selecionadoId) return null
    const id = selecionadoId.toLowerCase()
    return { id, nome: id, tipo: tipoPorId(id) }
  }, [selecionadoId])

  const isCamarote = selecionado?.tipo === 'CAMAROTE'
  const tipoFinanceiro = tipoReserva === 'VENDA' || tipoReserva === 'NA_HORA'
  const modeloPrecoObrigatorio = tipoFinanceiro
  const valorSinalObrigatorio = tipoFinanceiro

  useEffect(() => {
    let active = true

    async function check() {
      const { data } = await supabase.auth.getUser()
      const u = data.user

      if (!u) {
        router.push('/login?next=/')
        return
      }

      if (!active) return

      setUserId(u.id)

      const { data: adminRow } = await supabase
        .from('admins')
        .select('user_id')
        .eq('user_id', u.id)
        .maybeSingle()

      if (!active) return

      setIsAdmin(!!adminRow)
      setAuthChecking(false)
    }

    check()

    return () => {
      active = false
    }
  }, [router])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const touch =
      'ontouchstart' in window ||
      navigator.maxTouchPoints > 0 ||
      window.matchMedia('(pointer: coarse)').matches
    setIsTouchDevice(touch)
  }, [])

  useEffect(() => {
    let cancelled = false
    setMapReady(false)

    fetch('/mapa-looby.svg')
      .then((r) => r.text())
      .then((txt) => {
        if (!cancelled) setSvgMarkup(txt)
      })
      .catch((err) => console.error('Erro ao carregar SVG:', err))

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!tipoFinanceiro) {
      setModeloPreco('')
      setValorEspaco('')
      setValorSinal('')
    }
  }, [tipoFinanceiro])

  useEffect(() => {
    if (!tipoFinanceiro) return
    const sugerido = parseValorBaseModeloPreco(modeloPreco)
    setValorEspaco(sugerido)
  }, [modeloPreco, tipoFinanceiro])

  async function carregarReservasDoDia(dateISO: string) {
    setLoadingReservas(true)

    const { data, error } = await supabase
      .from('reservas')
      .select('*')
      .eq('data_evento', dateISO)

    if (error) {
      console.error(error)
      alert('Erro ao buscar reservas do dia.')
      setLoadingReservas(false)
      return
    }

    setReservasDia((data ?? []) as ReservaRow[])
    setLoadingReservas(false)
  }

  useEffect(() => {
    if (step !== 'MAPA') return
    carregarReservasDoDia(dataEvento)
  }, [step, dataEvento])

  useEffect(() => {
    if (authChecking) return
    if (step !== 'MAPA') return

    const ch = supabase
      .channel('mapa-reservas-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reservas' }, () => {
        carregarReservasDoDia(dataEvento)
      })
      .subscribe()

    return () => {
      supabase.removeChannel(ch)
    }
  }, [authChecking, step, dataEvento])

  const reservaPorEspaco = useMemo(() => {
    const map = new Map<string, ReservaRow>()

    reservasDia.forEach((r) => {
      if (normStatus(r.status) === 'cancelado') return
      const key = String(r.espaco_id || '').trim().toLowerCase()
      if (!key) return
      map.set(key, r)
    })

    return map
  }, [reservasDia])

  const reservasAtivasDia = useMemo(() => {
    return reservasDia.filter((r) => normStatus(r.status) !== 'cancelado')
  }, [reservasDia])

  const totalReservasDia = useMemo(() => reservasAtivasDia.length, [reservasAtivasDia])

  const pendentesCount = useMemo(
    () => reservasAtivasDia.filter((r) => normStatus(r.status) === 'pendente').length,
    [reservasAtivasDia]
  )

  const aprovadoVendaCount = useMemo(
    () => reservasAtivasDia.filter((r) => normStatus(r.status) === 'aprovado_venda').length,
    [reservasAtivasDia]
  )

  const aprovadoNaHoraCount = useMemo(
    () => reservasAtivasDia.filter((r) => normStatus(r.status) === 'aprovado_na_hora').length,
    [reservasAtivasDia]
  )

  const aprovadoCortesiaCount = useMemo(
    () => reservasAtivasDia.filter((r) => normStatus(r.status) === 'aprovado_cortesia').length,
    [reservasAtivasDia]
  )

  const mesasReservadasCount = useMemo(() => {
    return reservasAtivasDia.filter((r) => {
      const x = (r.espaco_id || '').toLowerCase()
      return !x.startsWith('c') && x !== 'nuvem'
    }).length
  }, [reservasAtivasDia])

  const camarotesReservadosCount = useMemo(() => {
    return reservasAtivasDia.filter((r) => {
      const x = (r.espaco_id || '').toLowerCase()
      return x.startsWith('c') || x === 'nuvem'
    }).length
  }, [reservasAtivasDia])

  const hoveredReserva = useMemo(() => {
    if (!hoveredId) return null
    return reservaPorEspaco.get(hoveredId) ?? null
  }, [hoveredId, reservaPorEspaco])

  const hoveredStatusText = useMemo(() => {
    if (!hoveredId) return ''

    const r = reservaPorEspaco.get(hoveredId)
    const st = normStatus(r?.status)

    if (!r) return 'LIVRE'
    if (st === 'pendente') return 'AGUARDANDO CONFIRMAÇÃO'
    if (st === 'aprovado_cortesia') return 'CORTESIA / ANIVERSÁRIO'
    if (st === 'aprovado_venda') return 'VENDA ANTECIPADA'
    if (st === 'aprovado_na_hora') return 'VENDA NA HORA'
    return (r?.status ?? 'RESERVADO').toString().toUpperCase()
  }, [hoveredId, reservaPorEspaco])

  const hoveredTipoEspaco = useMemo(() => {
    if (!hoveredId) return ''
    return tipoPorId(hoveredId) === 'CAMAROTE' ? 'Camarote' : 'Mesa'
  }, [hoveredId])

  function statusLabel(espacoId: string) {
    const r = reservaPorEspaco.get(espacoId.toLowerCase())
    const st = normStatus(r?.status)

    if (!r) return 'LIVRE'
    if (st === 'pendente') return 'AGUARDANDO CONFIRMAÇÃO'
    if (st === 'aprovado_cortesia') return 'CORTESIA / ANIVERSÁRIO'
    if (st === 'aprovado_venda') return 'VENDA ANTECIPADA'
    if (st === 'aprovado_na_hora') return 'VENDA NA HORA'
    return (r?.status ?? 'RESERVADO').toString().toUpperCase()
  }

  function tipoLabel(r: ReservaRow) {
    const t = normTipo(r?.tipo)
    if (t === 'venda') return 'Venda antecipada'
    if (t === 'na_hora') return 'Venda na hora'
    if (t === 'cortesia') return 'Cortesia'
    if (t === 'aniversario') return 'Aniversário'
    return (r?.tipo ?? '').toString()
  }

  function nomeEspacoLabel(id: string) {
    const lower = (id || '').toLowerCase()

    if (lower === 'nuvem') return 'Camarote Nuvem'
    if (lower.startsWith('vip-')) return `Mesa VIP ${lower.replace('vip-', '')}`
    if (lower.startsWith('m')) return `Mesa ${lower.replace('m', '')}`
    if (lower.startsWith('pista')) return `Mesa ${lower.replace('pista', '')}`
    if (lower.startsWith('c')) return `Camarote ${lower.replace('c', '').toUpperCase()}`

    return lower.toUpperCase()
  }

  function getStatusPaint(status?: string | null, highlighted = false) {
    const st = normStatus(status)

    let fill = ''
    let fillOpacity = '1'
    let stroke = ''
    let strokeWidth = '3'

    if (st === 'pendente') {
      fill = '#facc15'
      stroke = '#a16207'
      fillOpacity = '0.88'
    } else if (st === 'aprovado_cortesia') {
      fill = '#f97316'
      stroke = '#9a3412'
      fillOpacity = '0.88'
    } else if (st === 'aprovado_venda') {
      fill = '#22c55e'
      stroke = '#166534'
      fillOpacity = '0.88'
    } else if (st === 'aprovado_na_hora') {
      fill = '#93c5fd'
      stroke = '#3b82f6'
      fillOpacity = '0.92'
    }

    if (highlighted) {
      stroke = '#ffffff'
      strokeWidth = '4'
      if (!fill) fill = 'rgba(255,255,255,0.08)'
    }

    return { fill, fillOpacity, stroke, strokeWidth }
  }

  function clearSvgNode(node: Element) {
    const tag = node.tagName.toLowerCase()
    if (!['circle', 'rect', 'path', 'ellipse', 'polygon'].includes(tag)) return

    if (node.hasAttribute('data-original-fill')) {
      const value = node.getAttribute('data-original-fill') || ''
      if (value) node.setAttribute('fill', value)
      else node.removeAttribute('fill')
    }

    if (node.hasAttribute('data-original-fill-opacity')) {
      const value = node.getAttribute('data-original-fill-opacity') || ''
      if (value) node.setAttribute('fill-opacity', value)
      else node.removeAttribute('fill-opacity')
    } else {
      node.removeAttribute('fill-opacity')
    }

    if (node.hasAttribute('data-original-stroke')) {
      const value = node.getAttribute('data-original-stroke') || ''
      if (value) node.setAttribute('stroke', value)
      else node.removeAttribute('stroke')
    }

    if (node.hasAttribute('data-original-stroke-width')) {
      const value = node.getAttribute('data-original-stroke-width') || ''
      if (value) node.setAttribute('stroke-width', value)
      else node.removeAttribute('stroke-width')
    }
  }

  function paintSvgNode(
    node: Element,
    paint: { fill: string; fillOpacity: string; stroke: string; strokeWidth: string }
  ) {
    const tag = node.tagName.toLowerCase()
    if (!['circle', 'rect', 'path', 'ellipse', 'polygon'].includes(tag)) return

    if (!node.hasAttribute('data-original-fill')) {
      node.setAttribute('data-original-fill', node.getAttribute('fill') || '')
    }
    if (!node.hasAttribute('data-original-fill-opacity')) {
      node.setAttribute('data-original-fill-opacity', node.getAttribute('fill-opacity') || '')
    }
    if (!node.hasAttribute('data-original-stroke')) {
      node.setAttribute('data-original-stroke', node.getAttribute('stroke') || '')
    }
    if (!node.hasAttribute('data-original-stroke-width')) {
      node.setAttribute('data-original-stroke-width', node.getAttribute('stroke-width') || '')
    }

    const hasFill = node.hasAttribute('fill')
    const hasStroke = node.hasAttribute('stroke')

    if (paint.fill && hasFill) {
      node.setAttribute('fill', paint.fill)
      node.setAttribute('fill-opacity', paint.fillOpacity)
    }

    if (paint.stroke && hasStroke) {
      node.setAttribute('stroke', paint.stroke)
      node.setAttribute('stroke-width', paint.strokeWidth)
    }
  }

  function clearElementPaint(el: SVGGraphicsElement) {
    clearSvgNode(el)
    el.querySelectorAll('circle, rect, path, ellipse, polygon').forEach((child) => {
      clearSvgNode(child)
    })
  }

  function paintElementById(svg: SVGSVGElement, id: string, reserva: ReservaRow | null, highlighted: boolean) {
    const el = getSvgElByKnownId(svg, id)
    if (!el) return

    clearElementPaint(el)

    const hasReserva = !!reserva
    if (!hasReserva && !highlighted) return

    const paint = getStatusPaint(reserva?.status, highlighted)
    const tag = el.tagName.toLowerCase()

    const isMesaPequena = id.startsWith('m') || id.startsWith('pista') || id.startsWith('vip-')

    if (tag !== 'g') {
      if (isMesaPequena) {
        const fillOnly = { ...paint, stroke: '', strokeWidth: paint.strokeWidth }
        paintSvgNode(el, fillOnly)
      } else {
        const fillOnly = { ...paint, stroke: '', strokeWidth: paint.strokeWidth }
        paintSvgNode(el, fillOnly)

        if (highlighted) {
          el.setAttribute('stroke', '#ffffff')
          el.setAttribute('stroke-width', '6')
        }
      }
      return
    }

    const children = Array.from(el.querySelectorAll('circle, rect, path, ellipse, polygon'))
    if (children.length === 0) return

    if (isMesaPequena) {
      const fillNode = children.find((child) => child.hasAttribute('fill'))
      const strokeNode = children.find((child) => child.hasAttribute('stroke'))

      if (fillNode) {
        const fillOnly = { ...paint, stroke: '', strokeWidth: paint.strokeWidth }
        paintSvgNode(fillNode, fillOnly)
      }

      if (highlighted && strokeNode) {
        strokeNode.setAttribute('stroke', '#ffffff')
        strokeNode.setAttribute('stroke-width', '4')
      }

      return
    }

    const fillNode = children.find((child) => child.hasAttribute('fill'))
    const strokeNode = children.find((child) => child.hasAttribute('stroke'))

    if (fillNode) {
      const fillOnly = { ...paint, stroke: '', strokeWidth: paint.strokeWidth }
      paintSvgNode(fillNode, fillOnly)
    }

    if (strokeNode) {
      strokeNode.setAttribute('stroke', highlighted ? '#ffffff' : '#000000')
      strokeNode.setAttribute(
        'stroke-width',
        highlighted ? '6' : strokeNode.getAttribute('data-original-stroke-width') || '3'
      )
    }
  }

  function zoomIn() {
    setMapScale((prev) => Math.min(2.2, +(prev + 0.15).toFixed(2)))
  }

  function zoomOut() {
    setMapScale((prev) => Math.max(0.7, +(prev - 0.15).toFixed(2)))
  }

  function resetMapView() {
    setMapScale(1)
    setMapOffset({ x: 0, y: 0 })
  }

  function handleZoom(ev: React.WheelEvent<HTMLDivElement>) {
    if (isTouchDevice) return
    ev.preventDefault()
    const delta = ev.deltaY * -0.001
    const nextScale = Math.min(2.2, Math.max(0.7, mapScale + delta))
    setMapScale(nextScale)
  }

  function handlePointerDown(ev: React.PointerEvent<HTMLDivElement>) {
    const target = ev.target as HTMLElement
    const nodeData = target.closest('[data-espaco-id]')
    const nodeId = target.closest('[id]')

    if (nodeData || nodeId) return

    setDragging(true)
    setDragStart({
      x: ev.clientX - mapOffset.x,
      y: ev.clientY - mapOffset.y,
    })
  }

  function handlePointerMove(ev: React.PointerEvent<HTMLDivElement>) {
    if (dragging) {
      setMapOffset({
        x: ev.clientX - dragStart.x,
        y: ev.clientY - dragStart.y,
      })
    }

    if (isTouchDevice) {
      setHoveredId(null)
      setTooltipPos(null)
      return
    }

    const target = ev.target as HTMLElement

    const nodeData = target.closest('[data-espaco-id]') as HTMLElement | null
    if (nodeData) {
      const id = (nodeData.getAttribute('data-espaco-id') || '').trim().toLowerCase()
      if (id && VALID_IDS.includes(id)) {
        const rect = (ev.currentTarget as HTMLDivElement).getBoundingClientRect()
        setHoveredId(id)
        setTooltipPos({
          x: ev.clientX - rect.left,
          y: ev.clientY - rect.top,
        })
        return
      }
    }

    const nodeWithId = target.closest('[id]') as HTMLElement | null
    if (nodeWithId) {
      const rawId = nodeWithId.getAttribute('id')
      if (rawId) {
        const id = rawId.trim().toLowerCase()
        if (VALID_IDS.includes(id)) {
          const rect = (ev.currentTarget as HTMLDivElement).getBoundingClientRect()
          setHoveredId(id)
          setTooltipPos({
            x: ev.clientX - rect.left,
            y: ev.clientY - rect.top,
          })
          return
        }
      }
    }

    setHoveredId(null)
    setTooltipPos(null)
  }

  function handlePointerUp() {
    setDragging(false)
  }

  function statusChip(r: ReservaRow) {
    const st = normStatus(r?.status)

    if (st === 'aprovado_venda') {
      return {
        label: 'Aprovado (Venda antecipada)',
        cls: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      }
    }

    if (st === 'aprovado_na_hora') {
      return {
        label: 'Aprovado (Venda na hora)',
        cls: 'bg-sky-50 text-sky-700 border-sky-200',
      }
    }

    if (st === 'aprovado_cortesia') {
      return {
        label: 'Aprovado (Cortesia/Aniversário)',
        cls: 'bg-orange-50 text-orange-700 border-orange-200',
      }
    }

    if (st === 'pendente') {
      return {
        label: 'Pendente',
        cls: 'bg-yellow-50 text-yellow-700 border-yellow-200',
      }
    }

    return {
      label: (r?.status ?? 'Status').toString(),
      cls: 'bg-neutral-100 text-neutral-700 border-neutral-200',
    }
  }

  function openReservaModal(espacoId: string) {
    if (isReadOnlyHistorico) {
      alert('Data passada: modo histórico. Não é possível solicitar reservas.')
      return
    }

    setHighlightedId(espacoId.toLowerCase())
    setSelecionadoId(espacoId.toLowerCase())
    setNomeCompleto('')
    setTelefone('')
    setTipoReserva(vendaNaHoraAtiva ? 'NA_HORA' : 'ANIVERSARIO')
    setModeloPreco('')
    setValorEspaco('')
    setValorSinal('')
    setObservacao('')
    setAnexoObs(null)
    setModalOpen(true)
  }

  function closeReservaModal() {
    setModalOpen(false)
  }

  function openDetailsModal(reserva: ReservaRow) {
    setHighlightedId((reserva.espaco_id || '').toLowerCase())
    setDetailsReserva(reserva)
    setDetailsOpen(true)
  }

  function closeDetailsModal() {
    setDetailsOpen(false)
    setDetailsReserva(null)
  }

  function handleClickEspaco(eid: string) {
    const id = (eid || '').toLowerCase()
    setHighlightedId(id)

    const r = reservaPorEspaco.get(id)
    const reservado = !!r

    if (isReadOnlyHistorico) {
      if (reservado) openDetailsModal(r)
      else alert('Espaço livre (histórico).')
      return
    }

    if (reservado) {
      openDetailsModal(r)
      return
    }

    openReservaModal(id)
  }

  useEffect(() => {
    const host = svgHostRef.current
    if (!host) return

    host.innerHTML = ''
    if (!svgMarkup) return

    host.innerHTML = svgMarkup
    setMapReady(false)

    const raf = requestAnimationFrame(() => {
      const svg = host.querySelector('svg') as SVGSVGElement | null
      if (!svg) return

      svg.style.width = '100%'
      svg.style.height = 'auto'
      svg.style.display = 'block'
      svg.style.maxWidth = '920px'
      svg.style.margin = '0 auto'
      svg.style.overflow = 'visible'
      svg.setAttribute('preserveAspectRatio', 'xMinYMin meet')

      VALID_IDS.forEach((raw) => {
        const id = raw.toLowerCase()
        const el = getSvgElByKnownId(svg, raw)
        if (!el) return

        el.setAttribute('data-espaco-id', id)
        el.querySelectorAll('*').forEach((node) => {
          ;(node as Element).setAttribute('data-espaco-id', id)
        })
      })

      VALID_IDS.forEach((raw) => {
        const id = raw.toLowerCase()
        const reserva = reservaPorEspaco.get(id) ?? null
        const highlighted = highlightedId === id
        paintElementById(svg, raw, reserva, highlighted)
      })

      setMapReady(true)
    })

    return () => cancelAnimationFrame(raf)
  }, [svgMarkup, reservaPorEspaco, highlightedId, VALID_IDS])

  async function submitReserva(e: React.FormEvent) {
    e.preventDefault()

    if (isReadOnlyHistorico) {
      alert('Data passada: não é possível solicitar reserva.')
      return
    }

    if (!selecionado) return
    if (!userId) {
      alert('Faça login novamente.')
      return
    }

    const tipoFinal: ReservaTipo = vendaNaHoraAtiva ? 'NA_HORA' : tipoReserva
    const dataEventoFinal = vendaNaHoraAtiva ? dataEventoOperacional : dataEvento
    const tipoFinanceiroFinal = tipoFinal === 'VENDA' || tipoFinal === 'NA_HORA'

    if (!nomeCompleto.trim()) {
      alert('Preencha o nome completo.')
      return
    }

    const tel = onlyDigits(telefone)
    if (tel.length < 10) {
      alert('Telefone inválido (DDD + número).')
      return
    }

    if (tipoFinanceiroFinal && !modeloPreco) {
      alert('Selecione o modelo de preço.')
      return
    }

    const valorEspacoNumber =
      tipoFinanceiroFinal
        ? Number(String(valorEspaco).replace(',', '.'))
        : null

    if (!valorEspaco.trim() && tipoFinanceiroFinal) {
      alert('Não foi possível identificar o valor da mesa/camarote a partir do modelo selecionado.')
      return
    }

    if (!Number.isFinite(valorEspacoNumber) && tipoFinanceiroFinal) {
      alert('Valor automático da mesa/camarote inválido.')
      return
    }

    if (valorEspacoNumber !== null && valorEspacoNumber <= 0 && tipoFinanceiroFinal) {
      alert('Valor automático da mesa/camarote inválido.')
      return
    }

    const valorSinalNumber =
      tipoFinanceiroFinal
        ? Number(String(valorSinal).replace(',', '.'))
        : null

    if (tipoFinanceiroFinal) {
      if (!valorSinal.trim()) {
        alert('Preencha o valor do sinal adiantado.')
        return
      }

      if (!Number.isFinite(valorSinalNumber) || valorSinalNumber === null || valorSinalNumber < 0) {
        alert('Informe um valor de sinal válido.')
        return
      }
    }

    if (
      tipoFinanceiroFinal &&
      valorEspacoNumber !== null &&
      valorSinalNumber !== null &&
      valorSinalNumber > valorEspacoNumber
    ) {
      alert('O valor do sinal não pode ser maior que o valor da mesa/camarote.')
      return
    }

    if (!observacao.trim() && !anexoObs) {
      alert('A observação é obrigatória: preencha o texto OU anexe um arquivo.')
      return
    }

    if (reservaPorEspaco.get(selecionado.id)) {
      alert(`Esse espaço já está reservado: ${statusLabel(selecionado.id)}.`)
      return
    }

    if (anexoObs) {
      const MAX_MB = 10
      const maxBytes = MAX_MB * 1024 * 1024

      if (!isAllowedFile(anexoObs)) {
        alert('Anexo inválido. Envie imagem ou PDF.')
        return
      }

      if (anexoObs.size > maxBytes) {
        alert(`Arquivo muito grande. Máximo: ${MAX_MB}MB.`)
        return
      }
    }

    let uploadedPath: string | null = null

    try {
      setSaving(true)

      if (anexoObs) {
        const ext = getExt(anexoObs.name)
        const uuid = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`
        const fileName = safeFileName(`${uuid}.${ext}`)
        const path = `observacoes/${dataEventoFinal}/${selecionado.id}/${fileName}`

        const { data: upData, error: upErr } = await supabase.storage
          .from('comprovantes')
          .upload(path, anexoObs, {
            upsert: false,
            cacheControl: '3600',
            contentType: anexoObs.type || undefined,
          })

        if (upErr) {
          console.error('UPLOAD ERROR:', upErr)
          alert(`Erro ao anexar arquivo: ${upErr.message}`)
          return
        }

        uploadedPath = upData?.path ?? path
      }

      const payload = {
        user_id: userId,
        data_evento: dataEventoFinal,
        espaco_id: selecionado.id.toLowerCase().trim(),
        nome: nomeCompleto.trim(),
        telefone: tel,
        tipo: tipoFinal.toLowerCase(),
        modelo_preco: tipoFinanceiroFinal ? modeloPreco : null,
        valor_espaco: tipoFinanceiroFinal ? valorEspacoNumber : null,
        valor_sinal: tipoFinanceiroFinal ? valorSinalNumber : null,
        status: 'pendente',
        observacao: observacao.trim(),
        comprovante_url: uploadedPath,
      }

      console.log('PAYLOAD RESERVA:', payload)

      const { error } = await supabase.from('reservas').insert(payload)

      if (error) {
        console.error('DB INSERT ERROR FULL:', {
          message: error?.message,
          details: error?.details,
          hint: error?.hint,
          code: error?.code,
          full: error,
        })

        if (uploadedPath) {
          const rm = await supabase.storage.from('comprovantes').remove([uploadedPath])
          if (rm.error) console.warn('Falha ao remover arquivo órfão:', rm.error)
        }

        const msg = String(error?.message ?? '')
        const details = String(error?.details ?? '')
        const code = String(error?.code ?? '')

        const isReservaDuplicada =
          msg.includes('reservas_unicas_por_espaco_data') ||
          details.includes('reservas_unicas_por_espaco_data') ||
          code === '23505'

        if (isReservaDuplicada) {
          alert('Este espaço acabou de ser reservado por outro usuário.')
        } else {
          alert(
            `Erro ao salvar a reserva.\n\nMensagem: ${error?.message ?? 'sem mensagem'}\nCódigo: ${error?.code ?? 'sem código'}`
          )
        }

        return
      }

      closeReservaModal()
      await carregarReservasDoDia(dataEventoFinal)
      alert('Solicitação enviada! Status: aguardando confirmação (amarelo).')
    } finally {
      setSaving(false)
    }
  }

  async function sair() {
    await supabase.auth.signOut()
    router.push('/login?next=/')
  }

  if (authChecking) {
    return <div className="min-h-screen bg-[#1a0b0f] p-6 text-red-50/80">Verificando login...</div>
  }

  if (step === 'DATA') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,#4f111a_0%,#18090c_55%,#090406_100%)] p-6 text-red-50">
        <div className={`w-full max-w-xl ${RED_CARD_LIGHT}`}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold text-white">Reservas — Looby</h1>
              <p className={`mt-2 ${SOFT_TEXT}`}>
                {vendaNaHoraAtiva ? (
                  <>
                    Janela operacional ativa. As solicitações feitas agora entram como{' '}
                    <b className="text-white">venda na hora</b> vinculada ao evento de{' '}
                    <b className="text-white">{dataEventoOperacional}</b>.
                  </>
                ) : (
                  <>
                    Escolha a <b className="text-white">data do evento</b> e depois selecione o espaço no mapa.
                  </>
                )}
              </p>
            </div>

            <button onClick={sair} className={PRIMARY_BTN}>
              Sair
            </button>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button onClick={() => router.push('/minhas-reservas')} className={SECONDARY_BTN}>
              Meu relatório
            </button>

            {isAdmin ? (
              <button onClick={() => router.push('/admin')} className={SECONDARY_BTN}>
                Admin
              </button>
            ) : null}
          </div>

          <div className="mt-6 space-y-2">
            <label className={LABEL_CLASS}>Data do evento</label>
            <input
              type="date"
              value={dataEvento}
              onChange={(e) => {
                if (vendaNaHoraAtiva) return
                setDataEvento(e.target.value)
              }}
              disabled={vendaNaHoraAtiva}
              className={`${INPUT_CLASS} ${vendaNaHoraAtiva ? 'cursor-not-allowed opacity-70' : ''}`}
            />

            {vendaNaHoraAtiva ? (
              <p className="mt-2 text-xs text-sky-200">
                ℹ️ Das 23:00 até 07:00, o sistema usa automaticamente a data operacional do evento para reservas na hora.
              </p>
            ) : isPastDateISO(dataEvento) ? (
              <p className="mt-2 text-xs text-amber-200">
                ⚠️ Data passada: você pode visualizar o mapa como histórico, mas não poderá solicitar reservas.
              </p>
            ) : null}
          </div>

          <button
            onClick={() => setStep('MAPA')}
            className="mt-6 w-full rounded-xl bg-white py-2 font-semibold text-[#5b1019] transition hover:bg-red-50"
          >
            Avançar para o mapa
          </button>

          <p className="mt-4 text-xs text-red-50/55">(O mapa busca reservas dessa data no Supabase.)</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#4f111a_0%,#18090c_45%,#090406_100%)] p-4 text-red-50 sm:p-6">
      <div className="mx-auto max-w-[1400px]">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-6 border-b border-white/10 pb-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="flex items-center gap-3 text-2xl font-bold">
                <img src="/logo-looby.png" alt="Looby" className="h-12 w-auto" />
                Mapa de Reservas
              </h1>

              <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs text-red-50/85">
                {dataEvento}
              </span>

              {vendaNaHoraAtiva ? (
                <span className="rounded-full border border-sky-300/30 bg-sky-400/15 px-3 py-1 text-xs text-sky-100">
                  Janela: venda na hora
                </span>
              ) : null}
            </div>

            <p className="mt-2 text-sm text-red-50/70">
              Clique em um espaço para solicitar reserva ou visualizar detalhes.
            </p>

            <button
              onClick={() => setStep('DATA')}
              className="mt-2 text-sm text-red-50/70 underline underline-offset-4 hover:text-white"
            >
              ← Escolher outra data
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button onClick={() => router.push('/minhas-reservas')} className={SECONDARY_BTN}>
              Meu relatório
            </button>

            {isAdmin ? (
              <button onClick={() => router.push('/admin')} className={SECONDARY_BTN}>
                Voltar Admin
              </button>
            ) : null}

            <button onClick={sair} className={PRIMARY_BTN}>
              Sair
            </button>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 items-start gap-4 lg:grid-cols-[290px_minmax(0,1fr)]">
          <div className="order-2 space-y-4 lg:order-1">
            <div className={RED_CARD}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="font-semibold text-white">Legenda</div>
                  <div className="text-xs text-red-50/65">Status dos espaços no mapa</div>
                </div>

                <button className={GHOST_BTN} onClick={() => setShowLegend((v) => !v)}>
                  {showLegend ? 'Ocultar' : 'Mostrar'}
                </button>
              </div>

              {showLegend ? (
                <div className="mt-3 space-y-2 text-sm text-red-50/90">
                  <div className="flex items-center gap-2">
                    <span className="h-3.5 w-3.5 rounded border border-white/20 bg-white/30" />
                    <span>Livre</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="h-3.5 w-3.5 rounded border border-yellow-300 bg-yellow-400/90" />
                    <span>Pendente</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="h-3.5 w-3.5 rounded border border-orange-300 bg-orange-500/90" />
                    <span>Aprovado (Cortesia/Aniversário)</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="h-3.5 w-3.5 rounded border border-emerald-300 bg-green-500/90" />
                    <span>Aprovado (Venda antecipada)</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="h-3.5 w-3.5 rounded border border-sky-300 bg-sky-300/90" />
                    <span>Aprovado (Venda na hora)</span>
                  </div>

                  <div className="pt-2 text-xs text-red-50/55">Cancelado não pinta.</div>
                </div>
              ) : null}
            </div>

            <div className={RED_CARD}>
              <div className="font-semibold text-white">Resumo do dia</div>
              <div className="mt-1 text-xs text-red-50/65">Quantidade e tipo das reservas</div>

              <div className="mt-3 space-y-2 text-sm">
                <div className={`${RED_INNER} flex items-center justify-between px-3 py-2`}>
                  <span className="text-red-50/88">Total de reservas</span>
                  <b className="text-white">{loadingReservas ? '...' : totalReservasDia}</b>
                </div>

                <div className={`${RED_INNER} flex items-center justify-between px-3 py-2`}>
                  <span className="text-red-50/88">Pendentes</span>
                  <b className="text-white">{loadingReservas ? '...' : pendentesCount}</b>
                </div>

                <div className={`${RED_INNER} flex items-center justify-between px-3 py-2`}>
                  <span className="text-red-50/88">Aprovadas (Venda antecipada)</span>
                  <b className="text-white">{loadingReservas ? '...' : aprovadoVendaCount}</b>
                </div>

                <div className={`${RED_INNER} flex items-center justify-between px-3 py-2`}>
                  <span className="text-red-50/88">Aprovadas (Venda na hora)</span>
                  <b className="text-white">{loadingReservas ? '...' : aprovadoNaHoraCount}</b>
                </div>

                <div className={`${RED_INNER} flex items-center justify-between px-3 py-2`}>
                  <span className="text-red-50/88">Aprovadas (Cortesia/Aniversário)</span>
                  <b className="text-white">{loadingReservas ? '...' : aprovadoCortesiaCount}</b>
                </div>

                <div className={`${RED_INNER} flex items-center justify-between px-3 py-2`}>
                  <span className="text-red-50/88">Mesas reservadas</span>
                  <b className="text-white">{loadingReservas ? '...' : mesasReservadasCount}</b>
                </div>

                <div className={`${RED_INNER} flex items-center justify-between px-3 py-2`}>
                  <span className="text-red-50/88">Camarotes reservados</span>
                  <b className="text-white">{loadingReservas ? '...' : camarotesReservadosCount}</b>
                </div>
              </div>

              <div className={`mt-4 ${RED_INNER} p-3`}>
                <div className="mb-1 text-xs text-red-50/60">Descrição</div>
                <div className="text-sm leading-6 text-red-50/88">
                  {totalReservasDia === 0 ? (
                    'Nenhuma reserva registrada para esta data.'
                  ) : (
                    <>
                      Este dia possui <b className="text-white">{totalReservasDia}</b> reserva(s), sendo{' '}
                      <b className="text-white">{pendentesCount}</b> pendente(s),{' '}
                      <b className="text-white">{aprovadoVendaCount}</b> aprovada(s) por venda antecipada,{' '}
                      <b className="text-white">{aprovadoNaHoraCount}</b> aprovada(s) por venda na hora e{' '}
                      <b className="text-white">{aprovadoCortesiaCount}</b> aprovada(s) por cortesia/aniversário.
                      <br />
                      Entre elas, há <b className="text-white">{mesasReservadasCount}</b> mesa(s) e{' '}
                      <b className="text-white">{camarotesReservadosCount}</b> camarote(s).
                    </>
                  )}
                </div>
              </div>

              <div className="mt-4 text-xs text-red-50/55">
                Clique no mapa para solicitar uma reserva ou visualizar detalhes.
              </div>
            </div>
          </div>

          <div className="order-1 min-w-0 lg:order-2">
            <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/6 p-3 shadow-[0_18px_40px_rgba(0,0,0,0.28)] backdrop-blur-sm">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <div className="text-xs text-red-50/70">
                  {isTouchDevice
                    ? 'No celular: toque nos espaços e use os botões + / - para zoom.'
                    : 'No desktop: use o mouse para hover, roda para zoom e clique para interagir.'}
                </div>

                <div className="flex items-center gap-2">
                  <button type="button" onClick={zoomOut} className={GHOST_BTN} aria-label="Diminuir zoom">
                    −
                  </button>
                  <button type="button" onClick={zoomIn} className={GHOST_BTN} aria-label="Aumentar zoom">
                    +
                  </button>
                  <button type="button" onClick={resetMapView} className={GHOST_BTN} aria-label="Resetar mapa">
                    Reset
                  </button>
                </div>
              </div>

              {!mapReady && (
                <div className="mx-auto w-full max-w-[920px] rounded-xl border border-white/10 bg-white/10 p-6">
                  <div className="text-sm text-red-50/80">Carregando mapa...</div>
                  <div className="mt-3 h-2 w-full rounded bg-white/15" />
                  <div className="mt-2 h-2 w-5/6 rounded bg-white/15" />
                  <div className="mt-2 h-2 w-4/6 rounded bg-white/15" />
                </div>
              )}

              <div className="w-full overflow-x-auto">
                <div className="relative mx-auto w-full max-w-[920px]">
                  <div
                    ref={svgWrapRef}
                    className={`relative w-full rounded-xl ${dragging ? 'cursor-grabbing' : 'cursor-default'}`}
                    style={{
                      display: mapReady ? 'block' : 'none',
                      transform: `translate(${mapOffset.x}px, ${mapOffset.y}px) scale(${mapScale})`,
                      transformOrigin: 'center',
                      touchAction: 'none',
                    }}
                    onWheel={handleZoom}
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    onPointerCancel={handlePointerUp}
                    onPointerLeave={() => {
                      handlePointerUp()
                      if (!isTouchDevice) {
                        setHoveredId(null)
                        setTooltipPos(null)
                      }
                    }}
                    onClick={(ev) => {
                      const target = ev.target as HTMLElement

                      const nodeData = target.closest('[data-espaco-id]') as HTMLElement | null
                      if (nodeData) {
                        const id = (nodeData.getAttribute('data-espaco-id') || '').trim().toLowerCase()
                        if (id && VALID_IDS.includes(id)) {
                          handleClickEspaco(id)
                          return
                        }
                      }

                      const nodeWithId = target.closest('[id]') as HTMLElement | null
                      if (!nodeWithId) return

                      const rawId = nodeWithId.getAttribute('id')
                      if (!rawId) return

                      const id = rawId.trim().toLowerCase()
                      if (!VALID_IDS.includes(id)) return

                      handleClickEspaco(id)
                    }}
                  >
                    <div ref={svgHostRef} />
                  </div>

                  {!isTouchDevice && hoveredId && tooltipPos ? (
                    <div
                      className="pointer-events-none absolute z-20 min-w-[190px] rounded-xl border border-red-950/30 bg-white px-3 py-2 shadow-2xl"
                      style={{
                        left: tooltipPos.x,
                        top: tooltipPos.y,
                        transform: 'translate(6px, 6px)',
                      }}
                    >
                      <div className="text-sm font-semibold text-[#5b1019]">{nomeEspacoLabel(hoveredId)}</div>
                      <div className="mt-1 text-xs text-neutral-700">Tipo: {hoveredTipoEspaco}</div>
                      <div className="mt-1 text-xs text-neutral-700">Status: {hoveredStatusText}</div>

                      {hoveredReserva ? (
                        <div className="mt-1 text-xs text-neutral-500">Reserva: {tipoLabel(hoveredReserva)}</div>
                      ) : (
                        <div className="mt-1 text-xs text-neutral-500">Disponível para solicitação</div>
                      )}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </div>

        {detailsOpen && detailsReserva ? (
          <div className="fixed inset-0 z-50" role="dialog" aria-modal="true">
            <button className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" onClick={closeDetailsModal} aria-label="Fechar" />

            <div className="fixed inset-0 flex items-center justify-center p-4">
              <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-red-900/60 bg-gradient-to-br from-[#5b1019] via-[#741824] to-[#3f0b12] text-red-50 shadow-2xl">
                <div className="max-h-[85vh] overflow-y-auto overscroll-contain p-5 sm:p-6">
                  <div className="mb-5 flex items-start justify-between gap-4">
                    <div>
                      <h2 className="text-xl font-semibold text-white">Detalhes da reserva</h2>
                      <p className="mt-1 text-sm text-red-50/75">
                        Data: <b className="text-white">{dataEvento}</b> • Espaço:{' '}
                        <b className="text-white">{detailsReserva.espaco_id}</b>
                      </p>
                    </div>

                    <button onClick={closeDetailsModal} className={PRIMARY_BTN}>
                      Fechar
                    </button>
                  </div>

                  <div className="space-y-3 text-sm">
                    {(() => {
                      const chip = statusChip(detailsReserva)
                      return (
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`rounded-full border px-2 py-1 text-[12px] ${chip.cls}`}>
                            {chip.label}
                          </span>
                          <span className="text-red-50/35">•</span>
                          <span className="text-red-50/85">
                            Tipo: <b className="text-white">{tipoLabel(detailsReserva)}</b>
                          </span>
                        </div>
                      )
                    })()}

                    <div className="space-y-2 rounded-xl border border-white/10 bg-white/8 p-3">
                      <div className="flex justify-between gap-3">
                        <span className="text-red-50/60">Reservado por</span>
                        <span className="text-right font-semibold text-white">{detailsReserva.nome}</span>
                      </div>

                      <div className="flex justify-between gap-3">
                        <span className="text-red-50/60">Telefone</span>
                        <span className="text-right text-white">
                          {isAdmin ? detailsReserva.telefone : formatBRPhoneMasked(detailsReserva.telefone)}
                        </span>
                      </div>

                      {(detailsReserva.tipo?.toLowerCase() === 'venda' || detailsReserva.tipo?.toLowerCase() === 'na_hora') ? (
                        <>
                          <div className="flex justify-between gap-3">
                            <span className="text-red-50/60">Valor da mesa/camarote</span>
                            <span className="text-right text-white">
                              {formatCurrencyBR(detailsReserva.valor_espaco)}
                            </span>
                          </div>

                          <div className="flex justify-between gap-3">
                            <span className="text-red-50/60">Sinal adiantado</span>
                            <span className="text-right text-white">
                              {formatCurrencyBR(detailsReserva.valor_sinal)}
                            </span>
                          </div>
                        </>
                      ) : null}

                      <div className="pt-2">
                        <div className="mb-1 text-red-50/60">Observação</div>
                        <div className="whitespace-pre-wrap break-words text-white">
                          {isAdmin
                            ? detailsReserva.observacao || '-'
                            : detailsReserva.observacao
                              ? '•••• (oculto)'
                              : '-'}
                        </div>
                      </div>
                    </div>

                    <div className="text-xs text-red-50/55">
                      * Em usuário comum, telefone e observação ficam protegidos. No admin você vê tudo.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {modalOpen && selecionado && !isReadOnlyHistorico ? (
          <div className="fixed inset-0 z-50" role="dialog" aria-modal="true">
            <button className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" onClick={closeReservaModal} aria-label="Fechar" />

            <div className="fixed inset-0 flex items-center justify-center p-4">
              <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-red-900/60 bg-gradient-to-br from-[#5b1019] via-[#741824] to-[#3f0b12] text-red-50 shadow-2xl">
                <div className="max-h-[85vh] overflow-y-auto overscroll-contain p-5 sm:p-6">
                  <div className="mb-5 flex items-start justify-between gap-4">
                    <div>
                      <h2 className="text-xl font-semibold text-white">Solicitar reserva</h2>
                      <p className="mt-1 text-sm text-red-50/75">
                        Data:{' '}
                        <b className="text-white">{vendaNaHoraAtiva ? dataEventoOperacional : dataEvento}</b> • Espaço:{' '}
                        <b className="text-white">
                          {selecionado.nome} ({selecionado.tipo})
                        </b>
                      </p>
                    </div>

                    <button onClick={closeReservaModal} className={PRIMARY_BTN}>
                      Fechar
                    </button>
                  </div>

                  {vendaNaHoraAtiva ? (
                    <div className="mb-4 rounded-xl border border-sky-300/25 bg-sky-400/10 p-3 text-sm text-sky-100">
                      Esta solicitação será registrada como <b>venda na hora</b> para o evento de{' '}
                      <b>{dataEventoOperacional}</b>.
                    </div>
                  ) : null}

                  <form className="space-y-4" onSubmit={submitReserva}>
                    <div>
                      <label className={LABEL_CLASS}>Nome completo</label>
                      <input
                        value={nomeCompleto}
                        onChange={(e) => setNomeCompleto(e.target.value)}
                        className={INPUT_CLASS}
                      />
                    </div>

                    <div>
                      <label className={LABEL_CLASS}>Telefone (WhatsApp)</label>
                      <input
                        value={telefone}
                        onChange={(e) => setTelefone(e.target.value)}
                        className={INPUT_CLASS}
                      />
                    </div>

                    <div>
                      <label className={LABEL_CLASS}>Tipo</label>
                      <select
                        value={tipoReserva}
                        onChange={(e) => {
                          if (vendaNaHoraAtiva) return
                          setTipoReserva(e.target.value as ReservaTipo)
                        }}
                        disabled={vendaNaHoraAtiva}
                        className={`${INPUT_CLASS} ${vendaNaHoraAtiva ? 'cursor-not-allowed opacity-70' : ''}`}
                      >
                        {vendaNaHoraAtiva ? (
                          <option value="NA_HORA">Venda na hora</option>
                        ) : (
                          <>
                            <option value="ANIVERSARIO">Aniversário</option>
                            <option value="CORTESIA">Cortesia</option>
                            <option value="VENDA">Venda antecipada</option>
                          </>
                        )}
                      </select>
                    </div>

                    {modeloPrecoObrigatorio ? (
                      <div>
                        <label className={LABEL_CLASS}>Modelo de preço</label>
                        <select
                          value={modeloPreco}
                          onChange={(e) => setModeloPreco(e.target.value)}
                          className={INPUT_CLASS}
                        >
                          <option value="">Selecione</option>

                          {(isCamarote ? PRECOS_CAMAROTE : PRECOS_MESA).map((p) => (
                            <option key={p} value={p}>
                              {p}
                            </option>
                          ))}
                        </select>
                      </div>
                    ) : null}

                    {valorSinalObrigatorio ? (
                      <div>
                        <label className={LABEL_CLASS}>Valor do sinal adiantado</label>
                        <input
                          type="number"
                          inputMode="decimal"
                          min="0"
                          step="0.01"
                          value={valorSinal}
                          onChange={(e) => setValorSinal(e.target.value)}
                          className={INPUT_CLASS}
                          placeholder="Ex: 300.00"
                        />
                        <p className={`mt-1 text-xs ${MUTED_TEXT}`}>
                          Informe apenas o valor já pago antecipadamente.
                        </p>
                      </div>
                    ) : null}

                    <div>
                      <label className={LABEL_CLASS}>Observação (obrigatório)</label>
                      <textarea
                        value={observacao}
                        onChange={(e) => setObservacao(e.target.value.slice(0, 200))}
                        maxLength={200}
                        className="mt-1 min-h-[90px] w-full rounded-xl border border-red-950/40 bg-white/95 px-3 py-2 text-neutral-900 outline-none transition focus:border-red-700 focus:ring-2 focus:ring-red-700/20"
                        placeholder="Até 200 caracteres (ou anexe um arquivo)."
                      />
                      <p className={`mt-1 text-xs ${MUTED_TEXT}`}>{observacao.length}/200</p>
                    </div>

                    <div>
                      <label className={LABEL_CLASS}>Anexo da observação (opcional)</label>
                      <input
                        type="file"
                        accept="image/*,application/pdf"
                        onChange={(e) => setAnexoObs(e.target.files?.[0] ?? null)}
                        className="mt-2 block w-full text-sm text-red-50/80 file:mr-4 file:rounded-lg file:border-0 file:bg-white file:px-4 file:py-2 file:font-semibold file:text-[#5b1019] hover:file:bg-red-50"
                      />

                      {anexoObs ? (
                        <p className={`mt-2 text-xs ${MUTED_TEXT}`}>
                          Arquivo: <b className="text-white">{anexoObs.name}</b>
                        </p>
                      ) : null}
                    </div>

                    <button
                      type="submit"
                      disabled={saving}
                      className={`w-full rounded-xl py-2 font-semibold transition ${
                        saving ? 'bg-white/20 text-red-50/50' : 'bg-white text-[#5b1019] hover:bg-red-50'
                      }`}
                    >
                      {saving ? 'Salvando...' : 'Enviar solicitação (aguardando confirmação)'}
                    </button>
                  </form>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}