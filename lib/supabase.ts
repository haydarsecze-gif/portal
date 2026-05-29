import { createBrowserClient } from '@supabase/ssr'

// Safe fallbacks to prevent Next.js build-time module evaluation crashes on Vercel if variables are missing
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder'

// ✅ Only public client (safe for browser)
export const supabase = createBrowserClient(
  supabaseUrl,
  supabaseAnonKey
)

// We will create admin functions later using Server Components / API Routes