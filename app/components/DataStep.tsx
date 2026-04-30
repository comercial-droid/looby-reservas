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
      <div className="w-full max-w-xl rounded-3xl border border-white/10 bg-black/80 p-8 shadow-[0_30px_100px_rgba(0,0,0,0.5)] backdrop-blur-xl sm:p-10">
        <div className="mb-4 flex flex-col items-center gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex justify-center sm:justify-start">
            <img src="/looby-infinity.svg" alt="Looby" className="h-[100px] w-auto drop-shadow-[0_0_20px_rgba(255,255,255,0.1)] sm:h-[120px]" />
          </div>
        </div>

        <div className="flex flex-col items-center text-center">
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-black uppercase tracking-tighter text-white sm:text-2xl">Reservas</h1>
            <p className={`mt-2 text-sm leading-relaxed sm:text-base ${SOFT_TEXT}`}>
              {vendaNaHoraAtiva ? (
                <>
                  Janela operacional ativa. Para <b className="text-white">{dataEventoOperacional}</b>, permitimos apenas venda na hora.
                </>
              ) : (
                <>
                  Escolha a <b className="text-white">data do evento</b> para acessar o mapa de espaços.
                </>
              )}
            </p>
          </div>

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

        <div className="mt-8 flex items-center justify-center gap-6">
          <button
            onClick={() => router.push('/minhas-reservas')}
            className="text-[10px] font-bold uppercase tracking-widest text-red-50/70 underline underline-offset-4 transition-colors hover:text-white"
          >
            Relatório
          </button>
          <button
            onClick={sair}
            className="text-[10px] font-bold uppercase tracking-widest text-red-400 underline underline-offset-4 transition-colors hover:text-red-200"
          >
            Sair
          </button>
        </div>

        <p className="mt-6 text-center text-[10px] leading-relaxed text-red-50/30">
          (O mapa busca reservas dessa data no Supabase.)
        </p>
      </div>
    </div>
  )
}