import { createBrowserClient } from '@supabase/ssr'

// Safe fallbacks to prevent Next.js build-time module evaluation crashes on Vercel if variables are missing
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder'

// Resolve local domain proxy if running in a client browser to bypass DNS blocks
const resolvedUrl = typeof window !== 'undefined' 
  ? `${window.location.origin}/_supabase` 
  : supabaseUrl

// ✅ Only public client (safe for browser)
export const supabase = createBrowserClient(
  resolvedUrl,
  supabaseAnonKey
)

// We will create admin functions later using Server Components / API Routes