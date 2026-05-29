import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const { email } = await req.json()
    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    const normalizedEmail = email.trim().toLowerCase()

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false }
    })

    let page = 1
    let exists = false
    let hasMore = true

    // Scan authentication database securely
    while (hasMore && !exists) {
      const { data, error } = await supabase.auth.admin.listUsers({
        page,
        perPage: 1000
      })

      if (error) {
        throw error
      }

      if (!data || !data.users || data.users.length === 0) {
        hasMore = false
        break
      }

      exists = data.users.some(user => user.email?.toLowerCase() === normalizedEmail)
      
      if (data.users.length < 1000) {
        hasMore = false
      } else {
        page++
      }
    }

    return NextResponse.json({ exists })
  } catch (error: any) {
    console.error('Error checking email existence:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
