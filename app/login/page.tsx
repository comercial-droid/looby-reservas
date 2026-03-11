'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

function LoginContent() {
  const router = useRouter()
  const sp = useSearchParams()
  const next = sp.get('next') || '/'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) router.push(next)
    })
  }, [router, next])

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setErrorMsg(null)
    setLoading(true)

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })

      if (error) {
        setErrorMsg(error.message)
        return
      }

      router.push(next)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-white flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-neutral-900 p-6 shadow-[0_24px_70px_rgba(0,0,0,0.55)]">
        <h1 className="text-2xl font-semibold tracking-tight">Entrar</h1>
        <p className="mt-1 text-sm text-white/60">Acesse para solicitar reservas.</p>

        {errorMsg && (
          <div className="mt-4 rounded-xl border border-red-400/20 bg-red-500/10 p-3 text-sm text-red-200">
            {errorMsg}
          </div>
        )}

        <form className="mt-6 space-y-4" onSubmit={handleLogin}>
          <div>
            <label className="text-xs text-white/60">E-mail</label>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-sm outline-none focus:border-white/25"
              autoComplete="email"
            />
          </div>

          <div>
            <label className="text-xs text-white/60">Senha</label>
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              className="mt-1 w-full rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-sm outline-none focus:border-white/25"
              autoComplete="current-password"
            />
          </div>

          <button
            type="button"
            onClick={() => router.push('/forgot-password')}
            className="text-sm text-neutral-600 underline underline-offset-4 hover:text-neutral-900"
          >
            Esqueci minha senha
          </button>

          <button
            type="submit"
            disabled={loading}
            className={`w-full rounded-xl py-2 text-sm font-semibold ${
              loading
                ? 'bg-neutral-700 text-neutral-300'
                : 'bg-white text-black hover:bg-neutral-200'
            }`}
          >
            {loading ? 'Entrando...' : 'Entrar'}
          </button>

          <button
            type="button"
            onClick={() => router.push(`/signup?next=${encodeURIComponent(next)}`)}
            className="w-full rounded-xl py-2 text-sm font-semibold bg-white/10 hover:bg-white/15"
          >
            Criar conta
          </button>
        </form>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginContent />
    </Suspense>
  )
}