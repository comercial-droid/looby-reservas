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

  useEffect(() => {
    // Redireciona para o login imediatamente
    router.push('/login')
  }, [router])

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-950 p-4 sm:p-6 text-white">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-neutral-900 p-6 shadow-[0_24px_70px_rgba(0,0,0,0.55)] text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Acesso Restrito</h1>
        <p className="mt-4 text-sm text-white/60">
          O auto cadastro está desativado. 
          <br />
          Novos usuários são criados apenas manualmente pelo administrador.
        </p>
        
        <button
          onClick={() => router.push('/login')}
          className="mt-6 w-full rounded-xl py-2 text-sm font-semibold bg-white text-black hover:bg-neutral-200"
        >
          Voltar para o Login
        </button>
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