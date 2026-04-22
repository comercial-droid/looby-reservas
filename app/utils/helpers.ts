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

export function mascararTelefone(telefone: string) {
  return (telefone || '').replace(/(\d{4})(?!.*\d)/, '****')
}

export function formatBRDate(dateISO: string) {
  const [y, m, d] = String(dateISO).split('-').map(Number)
  if (!y || !m || !d) return dateISO
  return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`
}

export function displayLocal(espacoId: string) {
  const id = (espacoId || '').trim().toUpperCase()
  if (id.startsWith('M')) {
    const n = id.replace('M', '')
    // Se for um número puro como '01', mantém. Se for 'M1', vira '01'.
    const num = n.replace(/\D/g, '')
    return num.padStart(2, '0')
  }
  if (id.startsWith('C')) {
    return id.replace('C', '')
  }
  return id
}

export function displayEspacoCompleto(espacoId: string) {
  return `${tipoPorId(espacoId) === 'MESA' ? 'Mesa' : 'Camarote'} ${displayLocal(espacoId)}`
}

export function getTipoLabel(tipo: string) {
  const t = (tipo || '').toUpperCase()
  if (t === 'VENDA') return 'Venda antecipada'
  if (t === 'NA_HORA') return 'Venda na hora'
  if (t === 'ANIVERSARIO') return 'Aniversário'
  if (t === 'CORTESIA') return 'Cortesia'
  return t
}

export function gerarMensagemReserva(r: any) {
  const data = formatBRDate(r.data_evento)
  const telefoneMascarado = mascararTelefone(r.telefone)
  const espacoLabel = displayEspacoCompleto(r.espaco_id)
  
  const tipoUpper = (r.tipo || '').toUpperCase()
  const tipoLabel = getTipoLabel(r.tipo)
  const isVenda = tipoUpper === 'VENDA' || tipoUpper === 'NA_HORA'

  let msg = `*SOLICITAÇÃO DE RESERVA - LOOBY*

Espaço: ${espacoLabel}
Data: ${data}
Nome completo: ${r.nome}
Telefone (WhatsApp): ${telefoneMascarado}
Tipo: ${tipoLabel}
Bebida: ${r.bebida_cortesia || '—'}
Observação: ${r.observacao || '—'}`

  if (isVenda) {
    msg += `
Modelo de preço: ${r.modelo_preco || '—'}
Valor do sinal adiantado: ${r.valor_sinal ? formatCurrencyBR(r.valor_sinal) : '—'}`
  }

  return msg
}




export function compartilharReservaWhatsApp(r: any) {
  const mensagem = gerarMensagemReserva(r)
  const mensagemCodificada = encodeURIComponent(mensagem)
  const url = `https://wa.me/?text=${mensagemCodificada}`
  window.open(url, '_blank')
}

export function toBRPhoneE164(phoneRaw: string) {
  const d = (phoneRaw || '').replace(/\D/g, '')
  if (!d) return ''
  if (d.startsWith('55')) return d
  return `55${d}`
}

export function contatarClienteWhatsApp(r: any) {
  const phone = toBRPhoneE164(r.telefone)
  if (!phone) return alert('Telefone inválido ou ausente.')
  
  const msg = `Olá, ${r.nome}!`
  const url = `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`
  window.open(url, '_blank')
}
