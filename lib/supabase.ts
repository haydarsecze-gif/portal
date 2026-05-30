import { createClient } from '@supabase/supabase-js'

// Safe fallbacks to prevent Next.js build-time module evaluation crashes on Vercel if variables are missing
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder'

// Resolve local domain proxy if running in a client browser to bypass DNS blocks
const resolvedUrl = typeof window !== 'undefined' 
  ? `${window.location.origin}/_supabase` 
  : supabaseUrl

// Explicitly use the real project ref derived from standard Supabase URL
// aqvpwhubbytjzcdsfvhc is the project ref for https://aqvpwhubbytjzcdsfvhc.supabase.co
const projectRef = 'aqvpwhubbytjzcdsfvhc'

// ✅ Only public client (safe for browser) using clean localStorage-based session tracking
const client = createClient(
  resolvedUrl,
  supabaseAnonKey,
  {
    auth: {
      persistSession: true,
      storageKey: `sb-${projectRef}-auth-token`,
      autoRefreshToken: true,
      detectSessionInUrl: true
    },
    global: {
      fetch: (url, options) => {
        return fetch(url, {
          ...options,
          credentials: 'omit'
        })
      }
    }
  }
)

// Wrap the original signOut to automatically run nukeSession!
const originalSignOut = client.auth.signOut.bind(client.auth)
client.auth.signOut = async (options?: any) => {
  const res = await originalSignOut(options)
  nukeSession()
  return res
}

export const supabase = client

/**
 * Completely purges all possible Supabase session storage, cookies, and tokens
 * from the browser client to prevent cross-account session contamination.
 */
export const nukeSession = () => {
  if (typeof window === 'undefined') return
  
  // 1. Clear all localStorage keys starting with 'sb-' or containing 'supabase'
  try {
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('sb-') || key.toLowerCase().includes('supabase')) {
        localStorage.removeItem(key)
      }
    })
  } catch (e) {
    console.error('Error clearing localStorage:', e)
  }

  // 2. Clear all sessionStorage keys starting with 'sb-' or containing 'supabase'
  try {
    Object.keys(sessionStorage).forEach(key => {
      if (key.startsWith('sb-') || key.toLowerCase().includes('supabase')) {
        sessionStorage.removeItem(key)
      }
    })
  } catch (e) {
    console.error('Error clearing sessionStorage:', e)
  }

  // 3. Clear all browser cookies starting with 'sb-' or containing 'supabase'
  try {
    document.cookie.split(";").forEach((c) => {
      const name = c.trim().split("=")[0]
      if (name.startsWith("sb-") || name.toLowerCase().includes("supabase")) {
        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`
        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=${window.location.hostname};`
        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=.${window.location.hostname};`
      }
    })
  } catch (e) {
    console.error('Error clearing cookies:', e)
  }
}