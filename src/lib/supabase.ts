import { createClient } from '@supabase/supabase-js'

// Klucz "publishable" jest z zalozenia publiczny – dostep chroni RLS w bazie.
const URL = (import.meta.env.VITE_SUPABASE_URL as string) || 'https://ystucohnxgfnsegugpre.supabase.co'
const KEY = (import.meta.env.VITE_SUPABASE_KEY as string) || 'sb_publishable_HiaM9M_O4j75ojfFQb3xmA_tCoHJNIA'

export const chmuraSkonfigurowana = Boolean(URL && KEY)

export const supabase = createClient(URL, KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
    storageKey: 'amico-auth',
  },
})
