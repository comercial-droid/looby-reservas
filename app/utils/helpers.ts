// Funções utilitárias para o projeto Looby Reservas

export function todayISO() {
  const d = new Date()
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

export function dateToISO(d: Date) {
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

export function isPastDateISO(dateISO: string) {
  return String(dateISO || '') < todayISO()
}

export function onlyDigits(s: string) {
  return (s || '').replace(/\D/g, '')
}

export function normStatus(s?: string | null) {
  return (s ?? '').toString().trim().toLowerCase()
}

export function normTipo(s?: string | null) {
  return (s ?? '').toString().trim().toLowerCase()
}

import { STATUSS_ATIVOS_RESERVA } from './constants'

export function isStatusReservaAtivo(status?: string | null) {
  return STATUSS_ATIVOS_RESERVA.includes(normStatus(status) as (typeof STATUSS_ATIVOS_RESERVA)[number])
}

export function safeFileName(name: string) {
  return name.replace(/[^\w.\-]+/g, '_')
}

export function getExt(name: string) {
  const p = name.split('.')
  if (p.length <= 1) return 'bin'
  return (p.pop() || 'bin').toLowerCase()
}

export function isAllowedFile(file: File) {
  return (
    file.type.startsWith('image/') ||
    file.type === 'application/pdf' ||
    file.name.toLowerCase().endsWith('.pdf')
  )
}

export function formatBRPhoneMasked(raw: string) {
  const d = onlyDigits(raw || '')
  if (d.length < 4) return '••••'
  const last4 = d.slice(-4)
  return `(**) *****-${last4}`
}

export function formatCurrencyBR(value?: number | null) {
  const n = Number(value ?? 0)
  return n.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })
}

export function getSvgElByKnownId(svgEl: SVGSVGElement, raw: string): SVGGraphicsElement | null {
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

export function getNowBrasil(): Date {
  return new Date(
    new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' })
  )
}

export function isJanelaVendaNaHora(now?: Date) {
  const current = now ?? getNowBrasil()
  const h = current.getHours()
  return h >= 23 || h < 7
}

export function getDataEventoOperacional(now?: Date) {
  const d = new Date(now ?? getNowBrasil())

  if (d.getHours() < 7) {
    d.setDate(d.getDate() - 1)
  }

  return dateToISO(d)
}

export function tipoPorId(id: string): 'MESA' | 'CAMAROTE' {
  const x = (id || '').toLowerCase()
  if (x === 'nuvem') return 'CAMAROTE'
  if (x.startsWith('c')) return 'CAMAROTE'
  return 'MESA'
}