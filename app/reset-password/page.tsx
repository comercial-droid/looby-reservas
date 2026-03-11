'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

export default function ResetPasswordPage() {
  const router = useRouter()

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [ready, setReady] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setReady(true)
      }
    })

    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        setReady(true)
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErro(null)
    setMsg(null)

    if (password.length < 6) {
      setErro('A senha deve ter pelo menos 6 caracteres.')
      return
    }

    if (password !== confirmPassword) {
      setErro('As senhas não coincidem.')
      return
    }

    setLoading(true)

    const { error } = await supabase.auth.updateUser({
      password,
    })

    if (error) {
      setErro(error.message)
      setLoading(false)
      return
    }

    setMsg('Senha atualizada com sucesso. Redirecionando para o login...')
    setLoading(false)

    setTimeout(() => {
      router.push('/login')
    }, 1500)
  }

  return (
    <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">
          Redefinir senha
        </h1>

        {!ready ? (
          <p className="mt-4 text-sm text-neutral-500">
            Abra esta página pelo link enviado no seu e-mail.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label className="text-xs text-neutral-500">Nova senha</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:border-neutral-400"
              />
            </div>

            <div>
              <label className="text-xs text-neutral-500">Confirmar nova senha</label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="mt-1 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:border-neutral-400"
              />
            </div>

            {erro ? <p className="text-sm text-red-600">{erro}</p> : null}
            {msg ? <p className="text-sm text-emerald-600">{msg}</p> : null}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-neutral-900 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-800 disabled:opacity-60"
            >
              {loading ? 'Salvando…' : 'Salvar nova senha'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}