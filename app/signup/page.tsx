'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

function cleanName(s: string) {
  return s.replace(/\s+/g, ' ').trim()
}

async function garantirProfile(user: any, fallbackName?: string) {
  if (!user?.id) return

  const nomeMeta =
    user.user_metadata?.full_name ||
    user.user_metadata?.name ||
    user.user_metadata?.nome ||
    fallbackName ||
    user.email ||
    'Usuário'

  const nomeFinal = String(nomeMeta).trim()

  const { error } = await supabase.from('profiles').upsert(
    {
      id: user.id,
      full_name: nomeFinal,
      role: 'user',
    },
    { onConflict: 'id' }
  )

  if (error) {
    console.error('Erro ao criar/atualizar profile no signup:', {
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
    })
  }
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
    async function checkUser() {
      const { data } = await supabase.auth.getUser()
      if (data.user) router.push(next)
    }

    checkUser()
  }, [router, next])

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    setErrorMsg(null)
    setInfoMsg(null)

    const name = cleanName(fullName)
    const emailClean = email.trim().toLowerCase()

    if (name.length < 2) {
      setErrorMsg('Digite seu nome completo ou pelo menos 2 caracteres.')
      return
    }

    if (!emailClean) {
      setErrorMsg('Digite seu e-mail.')
      return
    }

    if (password.length < 6) {
      setErrorMsg('Senha mínima: 6 caracteres.')
      return
    }

    setLoading(true)

    try {
      const { data, error } = await supabase.auth.signUp({
        email: emailClean,
        password,
        options: {
          data: {
            full_name: name,
          },
        },
      })

      if (error) {
        setErrorMsg(error.message)
        return
      }

      const user = data.user

      if (user) {
        await garantirProfile(user, name)
      }

      const precisaConfirmarEmail =
        !!user && !data.session

      if (precisaConfirmarEmail) {
        setInfoMsg('Conta criada com sucesso. Verifique seu e-mail para confirmar o cadastro e depois faça login.')
        return
      }

      router.push(next)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-950 p-4 sm:p-6 text-white">
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
              placeholder="Ex: Larissa Souza"
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
            className="w-full rounded-xl bg-white/10 py-2 text-sm font-semibold hover:bg-white/15"
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