import { createClient } from '@supabase/supabase-js'

export const DEFAULT_SUPABASE_URL = 'https://lnlrjaezfcbksjcbwvto.supabase.co'
export const DEFAULT_SUPABASE_ANON_KEY = 'sb_publishable_gJ-T4a9HBBgs_jMOVzQ68A_KFWxulKC'

// Ignore stale/offline old project URL or placeholder if still set in Vercel environment
const isStaleUrl = (url?: string) => !url || url.includes('placeholder') || url.includes('aqvpwhubbytjzcdsfvhc')
const isStaleAnon = (key?: string) => !key || key.includes('placeholder') || key.includes('jFj58eOTCt8Wx4CVsCjvIw')

const supabaseUrl = isStaleUrl(process.env.NEXT_PUBLIC_SUPABASE_URL) 
  ? DEFAULT_SUPABASE_URL 
  : process.env.NEXT_PUBLIC_SUPABASE_URL!

const supabaseAnonKey = isStaleAnon(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
  ? DEFAULT_SUPABASE_ANON_KEY
  : process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Resolve local domain proxy if running in a client browser to bypass DNS blocks
const resolvedUrl = typeof window !== 'undefined' 
  ? `${window.location.origin}/_supabase` 
  : supabaseUrl

// Explicitly use the real project ref derived from standard Supabase URL
const projectRef = 'lnlrjaezfcbksjcbwvto'

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

export const supabase = client

// ✅ Raw Supabase client for real-time WebSocket connections (bypasses Next.js rewrites which block WebSockets)
export const supabaseRaw = createClient(
  supabaseUrl,
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

export function getServiceSupabase() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  return createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false }
  });
}

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

/**
 * Safely inserts notification records. If the database schema is missing the 'link' column,
 * it catches the exception and retries the insert without the 'link' field to ensure
 * notifications are still delivered.
 */
// Helper to trigger push notifications asynchronously in the background
const triggerPush = (payloads: any[]) => {
  try {
    const baseUrl = typeof window !== 'undefined'
      ? window.location.origin
      : (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000')

    fetch(`${baseUrl}/api/notifications/send-push`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ payloads })
    }).catch(err => {
      console.warn('Background web push dispatch failed:', err)
    })
  } catch (err) {
    console.warn('Failed to trigger send-push API:', err)
  }
}

/**
 * Safely inserts notification records. If the database schema is missing the 'link' column,
 * it catches the exception and retries the insert without the 'link' field to ensure
 * notifications are still delivered.
 */
export const safeInsertNotifications = async (payloads: any | any[]) => {
  const normalized = Array.isArray(payloads) ? payloads : [payloads]
  if (normalized.length === 0) return { data: [], error: null }

  // Attempt 1: Full insert with 'link' column
  const { data, error } = await supabase
    .from('notifications')
    .insert(normalized)

  if (error) {
    // Check for missing 'link' column error (Postgres error code '42703' or message check)
    const isMissingLink = error.code === '42703' || 
      (error.message && error.message.toLowerCase().includes("'link'") && error.message.toLowerCase().includes("column"))

    if (isMissingLink) {
      console.warn("Database is missing the 'link' column in public.notifications. Falling back to inserting without link column.")
      
      // Strip 'link' key from all payload items
      const strippedPayloads = normalized.map(({ link, ...rest }) => rest)
      
      // Attempt 2: Insert without 'link' column
      const result = await supabase
        .from('notifications')
        .insert(strippedPayloads)

      if (!result.error) {
        triggerPush(normalized)
      }
      return result
    }
  }

  if (!error) {
    triggerPush(normalized)
  }

  return { data, error }
}