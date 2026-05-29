import { createBrowserClient } from '@supabase/ssr'

// ✅ Only public client (safe for browser)
export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// We will create admin functions later using Server Components / API Routes