import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import webpush from 'web-push'

const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || ''
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY || ''

if (vapidPublicKey && vapidPrivateKey) {
  try {
    webpush.setVapidDetails(
      'mailto:support@haydarsecze-gif.com',
      vapidPublicKey,
      vapidPrivateKey
    )
  } catch (e) {
    console.error('Error setting VAPID details:', e)
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { payloads } = body

    if (!payloads) {
      return NextResponse.json({ error: 'Missing payloads parameter' }, { status: 400 })
    }

    const normalized = Array.isArray(payloads) ? payloads : [payloads]
    if (normalized.length === 0) {
      return NextResponse.json({ success: true, count: 0 })
    }

    if (!vapidPublicKey || !vapidPrivateKey) {
      console.warn('VAPID keys not configured in environment variables. Web Push is disabled.')
      return NextResponse.json({ success: true, message: 'Web Push is disabled on server' })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
    const supabaseAdmin = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false }
    })

    let totalDispatched = 0
    let totalDeleted = 0

    for (const notif of normalized) {
      const { user_id, title, message, type, link } = notif

      // Fetch subscriptions. If user_id is null, it's a broadcast to all users
      let query = supabaseAdmin.from('push_subscriptions').select('id, user_id, subscription')
      if (user_id) {
        query = query.eq('user_id', user_id)
      } else {
        // Limit broad broadcast query to prevent scanning too many rows
        query = query.limit(500)
      }

      const { data: subs, error: subsError } = await query

      if (subsError) {
        if (subsError.code === '42P01') {
          console.warn('push_subscriptions table does not exist in database yet.')
          continue
        }
        throw subsError
      }

      if (!subs || subs.length === 0) {
        continue
      }

      const pushPayload = JSON.stringify({
        id: notif.id || Math.random().toString(36).substring(7),
        title: title || 'Student Portal Alert',
        message: message || '',
        type: type || 'system',
        link: link || '/'
      })

      // Send notifications concurrently using Promise.allSettled
      const sendPromises = subs.map(async (row) => {
        try {
          const subscriptionObj = typeof row.subscription === 'string'
            ? JSON.parse(row.subscription)
            : row.subscription

          await webpush.sendNotification(subscriptionObj, pushPayload)
          totalDispatched++
        } catch (err: any) {
          // Status 410 (Gone) or 404 (Not Found) means the push service has expired or deleted the token
          if (err.statusCode === 410 || err.statusCode === 404) {
            await supabaseAdmin.from('push_subscriptions').delete().eq('id', row.id)
            totalDeleted++
          } else {
            console.error(`Web Push send error for subscription ID ${row.id}:`, err.message || err)
          }
        }
      })

      await Promise.allSettled(sendPromises)
    }

    return NextResponse.json({
      success: true,
      dispatched: totalDispatched,
      pruned: totalDeleted
    })
  } catch (err: any) {
    console.error('Error in send-push API:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
