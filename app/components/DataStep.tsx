import { useRouter } from 'next/navigation'
import { isPastDateISO } from '../utils/helpers'
import { LABEL_CLASS, SOFT_TEXT, PRIMARY_BTN, SECONDARY_BTN, INPUT_CLASS, RED_CARD_LIGHT } from '../utils/constants'

interface DataStepProps {
  dataEvento: string
  setDataEvento: (value: string) => void
  vendaNaHoraAtiva: boolean
  dataEventoOperacional: string
  modoSomenteNaHora: boolean
  isAdmin: boolean
  setStep: (step: 'DATA' | 'MAPA') => void
  sair: () => void
}

export function DataStep({
  dataEvento,
  setDataEvento,
  vendaNaHoraAtiva,
  dataEventoOperacional,
  modoSomenteNaHora,
  isAdmin,
  setStep,
  sair,
}: DataStepProps) {
  const router = useRouter()

  return (
    <div className="flex min-h-svh items-center justify-center bg-[radial-gradient(circle_at_top,#4f111a_0%,#18090c_55%,#090406_100%)] px-4 py-6 text-red-50 sm:p-6">
      <div className={`w-full max-w-xl ${RED_CARD_LIGHT}`}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold text-white sm:text-3xl">Reservas — Looby</h1>
            <p className={`mt-2 text-sm leading-6 sm:text-base ${SOFT_TEXT}`}>
              {vendaNaHoraAtiva ? (
                <>
                  Janela operacional ativa. Para a data de {dataEventoOperacional}, o sistema permite apenas venda na hora. Para datas futuras, você pode fazer reserva antecipada.
                </>
              ) : (
                <>
                  Escolha a <b className="text-white">data do evento</b> e depois selecione o espaço no mapa.
                </>
              )}
            </p>
          </div>

          <button onClick={sair} className={`${PRIMARY_BTN} w-full sm:w-auto`}>
            Sair
          </button>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-2 sm:flex sm:flex-wrap">
          <button onClick={() => router.push('/minhas-reservas')} className={`${SECONDARY_BTN} w-full sm:w-auto`}>
            Meu relatório
          </button>

          {isAdmin ? (
            <button onClick={() => router.push('/admin')} className={`${SECONDARY_BTN} w-full sm:w-auto`}>
              Admin
            </button>
          ) : null}
        </div>

        <div className="mt-6 space-y-2">
          <label className={LABEL_CLASS}>Data do evento</label>
          <input
            type="date"
            value={dataEvento}
            onChange={(e) => setDataEvento(e.target.value)}
            className={INPUT_CLASS}
          />

          {isAdmin ? (
            <p className="mt-2 text-xs leading-5 text-emerald-300">
              🛡️ Modo Administrador: você pode solicitar e alterar qualquer reserva, inclusive em datas passadas.
            </p>
          ) : modoSomenteNaHora ? (
            <p className="mt-2 text-xs leading-5 text-sky-200">
              ℹ️ Para a data operacional atual, o sistema permite somente venda na hora.
            </p>
          ) : isPastDateISO(dataEvento) ? (
            <p className="mt-2 text-xs leading-5 text-amber-200">
              ⚠️ Data passada: você pode visualizar o mapa como histórico, mas não poderá solicitar reservas.
            </p>
          ) : vendaNaHoraAtiva ? (
            <p className="mt-2 text-xs leading-5 text-sky-200">
              ℹ️ Ainda é possível selecionar uma data futura para reserva antecipada.
            </p>
          ) : null}
        </div>

        <button
          onClick={() => setStep('MAPA')}
          className="mt-6 inline-flex min-h-[48px] w-full items-center justify-center rounded-xl bg-white px-4 py-3 text-base font-semibold text-[#5b1019] transition hover:bg-red-50"
        >
          Avançar para o mapa
        </button>

        <p className="mt-4 text-xs leading-5 text-red-50/55">
          (O mapa busca reservas dessa data no Supabase.)
        </p>
      </div>
    </div>
  )
}