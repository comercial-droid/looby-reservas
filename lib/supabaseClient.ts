import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Variáveis do Supabase não carregadas. Verifique o .env.local e reinicie o npm run dev.'
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)