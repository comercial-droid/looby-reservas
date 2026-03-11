'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setMsg(null)
    setErro(null)

    const redirectTo =
      typeof window !== 'undefined'
        ? `${window.location.origin}/reset-password`
        : undefined

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo,
    })

    if (error) {
      setErro(error.message)
    } else {
      setMsg('Se o e-mail existir, enviamos um link para redefinir a senha.')
    }

    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">
          Recuperar senha
        </h1>
        <p className="mt-2 text-sm text-neutral-500">
          Informe seu e-mail para receber o link de redefinição.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className="text-xs text-neutral-500">E-mail</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:border-neutral-400"
              placeholder="seuemail@exemplo.com"
            />
          </div>

          {erro ? <p className="text-sm text-red-600">{erro}</p> : null}
          {msg ? <p className="text-sm text-emerald-600">{msg}</p> : null}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-neutral-900 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-800 disabled:opacity-60"
          >
            {loading ? 'Enviando…' : 'Enviar link de recuperação'}
          </button>
        </form>
      </div>
    </div>
  )
}