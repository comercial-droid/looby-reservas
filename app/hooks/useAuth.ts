import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

export function useAuth() {
  const router = useRouter()
  const [authChecking, setAuthChecking] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    let active = true

    async function check() {
      const { data } = await supabase.auth.getUser()
      const u = data.user

      if (!u) {
        router.push('/login?next=/')
        return
      }

      if (!active) return

      setUserId(u.id)

      const { data: adminRow } = await supabase
        .from('admins')
        .select('user_id')
        .eq('user_id', u.id)
        .maybeSingle()

      if (!active) return

      setIsAdmin(!!adminRow)
      setAuthChecking(false)
    }

    check()

    return () => {
      active = false
    }
  }, [router])

  return { authChecking, userId, isAdmin }
}