import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'

// Cliente ÚNICO do Supabase. Só arquivos de src/repositories/ importam isto
// (AGENTS.md §3, regra 2). As variáveis vêm do .env.local e são públicas.
const EnvSchema = z.object({
  VITE_SUPABASE_URL: z.url(),
  VITE_SUPABASE_ANON_KEY: z.string().min(20),
})

const env = EnvSchema.safeParse(import.meta.env)
if (!env.success) {
  throw new Error(
    'VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY precisam estar no .env.local (veja .env.example).',
  )
}

export const supabase = createClient(env.data.VITE_SUPABASE_URL, env.data.VITE_SUPABASE_ANON_KEY)
