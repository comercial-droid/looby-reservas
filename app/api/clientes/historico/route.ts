import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabaseClient'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const telefoneRaw = searchParams.get('telefone') || ''
    const nomeRaw = searchParams.get('nome') || ''

    if (!telefoneRaw && !nomeRaw) {
      return NextResponse.json({ error: 'Telefone ou Nome obrigatórios' }, { status: 400 })
    }

    const telefone = telefoneRaw.replace(/\D/g, '')

    // Data de 30 dias atrás
    const hoje = new Date()
    const trintaDiasAtras = new Date()
    trintaDiasAtras.setDate(hoje.getDate() - 30)
    const trintaDiasAtrasISO = trintaDiasAtras.toISOString().split('T')[0]

    // 1. Buscar histórico dos últimos 30 dias (não canceladas)
    let query30Dias = supabase
      .from('reservas')
      .select('id, data_evento, status')
      .neq('status', 'cancelado')
      .gte('data_evento', trintaDiasAtrasISO)
      .order('data_evento', { ascending: false })

    if (telefone) {
      query30Dias = query30Dias.eq('telefone', telefone) 
    } else {
      query30Dias = query30Dias.ilike('nome', `%${nomeRaw}%`)
    }

    const { data: reservas30Dias, error: err30 } = await query30Dias

    if (err30) throw err30

    const total30Dias = reservas30Dias?.length || 0
    const ultimaReserva = reservas30Dias && reservas30Dias.length > 0 ? reservas30Dias[0].data_evento : null

    // 2. Buscar benefício de aniversário (em todo o histórico)
    // Consideramos usado se:
    // - A coluna usouBeneficioAniversario for true OR
    // - O tipo da reserva for 'aniversario' (para compatibilidade com reservas antigas)
    // Ignoramos reservas canceladas.
    let queryBeneficio = supabase
      .from('reservas')
      .select('id, data_evento, usouBeneficioAniversario, tipo')
      .neq('status', 'cancelado')
      .or('usouBeneficioAniversario.eq.true, tipo.ilike.aniversario')
      .order('data_evento', { ascending: false })
      .limit(1)

    if (telefone) {
      queryBeneficio = queryBeneficio.eq('telefone', telefone)
    } else {
      queryBeneficio = queryBeneficio.ilike('nome', `%${nomeRaw}%`)
    }

    const { data: beneficioData, error: errBen } = await queryBeneficio

    if (errBen) throw errBen

    const jaUsouBeneficio = beneficioData && beneficioData.length > 0
    const dataUltimoBeneficio = jaUsouBeneficio ? beneficioData[0].data_evento : null

    // Formatação de mensagens
    const formatDateBR = (isoDate: string | null) => {
      if (!isoDate) return ''
      const [y, m, d] = isoDate.split('-')
      return `${d}/${m}/${y}`
    }

    const mensagemHistorico = `Este cliente realizou ${total30Dias} reserva${total30Dias !== 1 ? 's' : ''} nos últimos 30 dias. ${
      ultimaReserva ? `Última reserva registrada em ${formatDateBR(ultimaReserva)}.` : ''
    }`

    let mensagemBeneficio = null
    if (jaUsouBeneficio) {
      mensagemBeneficio = `Este cliente já utilizou benefício de aniversariante anteriormente. Última utilização registrada em ${formatDateBR(
        dataUltimoBeneficio
      )}. Verifique antes de liberar novo camarote cortesia.`
    }

    return NextResponse.json({
      clienteEncontrado: total30Dias > 0 || jaUsouBeneficio,
      reservasUltimos30Dias: total30Dias,
      dataUltimaReserva: ultimaReserva,
      jaUsouBeneficioAniversario: jaUsouBeneficio,
      dataUltimoBeneficio: dataUltimoBeneficio,
      mensagemHistorico,
      mensagemBeneficio
    })
  } catch (error: any) {
    console.error('Erro no historico:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
