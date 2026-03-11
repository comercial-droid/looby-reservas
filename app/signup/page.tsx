'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

function cleanName(s: string) {
  return s.replace(/\s+/g, ' ').trim()
}

function SignupContent() {
  const router = useRouter()
  const sp = useSearchParams()
  const next = sp.get('next') || '/'

  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [infoMsg, setInfoMsg] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) router.push(next)
    })
  }, [router, next])

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    setErrorMsg(null)
    setInfoMsg(null)

    const name = cleanName(fullName)
    if (name.length < 2) return setErrorMsg('Digite seu nome (mínimo 2 caracteres).')
    if (!email.trim()) return setErrorMsg('Digite seu e-mail.')
    if (password.length < 6) return setErrorMsg('Senha mínima: 6 caracteres.')

    setLoading(true)
    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: { full_name: name },
        },
      })

      if (error) {
        setErrorMsg(error.message)
        return
      }

      const user = data.user
      if (!user) {
        setInfoMsg('Conta criada. Verifique seu e-mail para confirmar o cadastro e então faça login.')
        return
      }

      const { error: pErr } = await supabase.from('profiles').upsert(
        {
          id: user.id,
          full_name: name,
          role: 'user',
        },
        { onConflict: 'id' }
      )

      if (pErr) {
        console.error('profiles upsert error:', {
          message: pErr.message,
          details: pErr.details,
          hint: pErr.hint,
          code: pErr.code,
        })
      }

      router.push(next)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-white flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-neutral-900 p-6 shadow-[0_24px_70px_rgba(0,0,0,0.55)]">
        <h1 className="text-2xl font-semibold tracking-tight">Criar conta</h1>
        <p className="mt-1 text-sm text-white/60">Cadastre seu usuário para solicitar reservas.</p>

        {errorMsg ? (
          <div className="mt-4 rounded-xl border border-red-400/20 bg-red-500/10 p-3 text-sm text-red-200">
            {errorMsg}
          </div>
        ) : null}

        {infoMsg ? (
          <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-white/70">
            {infoMsg}
          </div>
        ) : null}

        <form className="mt-6 space-y-4" onSubmit={handleSignup}>
          <div>
            <label className="text-xs text-white/60">Nome</label>
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Ex: Larissa"
              className="mt-1 w-full rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-sm outline-none focus:border-white/25"
              autoComplete="name"
            />
          </div>

          <div>
            <label className="text-xs text-white/60">E-mail</label>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seuemail@..."
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
              placeholder="mín. 6 caracteres"
              className="mt-1 w-full rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-sm outline-none focus:border-white/25"
              autoComplete="new-password"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className={`w-full rounded-xl py-2 text-sm font-semibold ${
              loading ? 'bg-neutral-700 text-neutral-300' : 'bg-white text-black hover:bg-neutral-200'
            }`}
          >
            {loading ? 'Criando...' : 'Criar conta'}
          </button>

          <button
            type="button"
            onClick={() => router.push(`/login?next=${encodeURIComponent(next)}`)}
            className="w-full rounded-xl py-2 text-sm font-semibold bg-white/10 hover:bg-white/15"
          >
            Já tem uma conta? Entrar
          </button>
        </form>
      </div>
    </div>
  )
}

export default function SignupPage() {
  return (
    <Suspense fallback={null}>
      <SignupContent />
    </Suspense>
  )
}