import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: Request) {
  try {
    const { userId, userIds, subscription } = await req.json()
    if (!subscription) {
      return NextResponse.json({ error: 'Missing subscription' }, { status: 400 })
    }

    // Support single userId or an array of userIds
    const targets = Array.isArray(userIds)
      ? userIds
      : (userId ? [userId] : [])

    const cleanTargets = [...new Set(targets.filter(Boolean))] as string[]

    if (cleanTargets.length === 0) {
      return NextResponse.json({ error: 'Missing userIds' }, { status: 400 })
    }

    const authHeader = req.headers.get('authorization')
    const token = authHeader ? authHeader.replace('Bearer ', '') : null

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

    const supabaseAdmin = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false }
    })

    // If an authorization token is provided, verify it against the primary current user
    if (token && userId) {
      const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
      if (authError || !user || user.id !== userId) {
        return NextResponse.json({ error: 'Unauthorized user session context' }, { status: 401 })
      }
    }

    // Process all subscription targets in parallel
    const registrationPromises = cleanTargets.map(async (uId) => {
      try {
        // Attempt to select the existing subscription for deduplication
        const { data: existing, error: checkError } = await supabaseAdmin
          .from('push_subscriptions')
          .select('id')
          .eq('user_id', uId)
          .eq('subscription->>endpoint', subscription.endpoint)
          .maybeSingle()

        if (checkError) {
          if (checkError.code === '42P01') {
            console.warn(`Database table push_subscriptions does not exist yet.`)
            return { uId, status: 'error', reason: 'schema_not_ready' }
          }
          throw checkError
        }

        if (!existing) {
          const { error: insertError } = await supabaseAdmin
            .from('push_subscriptions')
            .insert({
              user_id: uId,
              subscription: subscription
            })
          if (insertError) throw insertError
        } else {
          // Update details in case keys changed
          const { error: updateError } = await supabaseAdmin
            .from('push_subscriptions')
            .update({
              subscription: subscription
            })
            .eq('id', existing.id)
          if (updateError) throw updateError
        }
        return { uId, status: 'success' }
      } catch (err: any) {
        console.error(`Failed to register subscription for user ${uId}:`, err.message || err)
        return { uId, status: 'error', error: err.message }
      }
    })

    const results = await Promise.all(registrationPromises)
    const hasSchemaError = results.some(r => r.reason === 'schema_not_ready')

    if (hasSchemaError) {
      return NextResponse.json({ error: 'Database schema not ready' }, { status: 503 })
    }

    return NextResponse.json({ success: true, results })
  } catch (err: any) {
    console.error('Error in subscribe API:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
