import { NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabaseServer'

export async function POST(req: Request) {
  try {
    const { userId, endpoint } = await req.json()
    if (!userId || !endpoint) {
      return NextResponse.json({ error: 'Missing userId or endpoint' }, { status: 400 })
    }

    const supabaseAdmin = getServiceClient()

    // Delete the specific subscription record by matching user_id and subscription endpoint
    const { error } = await supabaseAdmin
      .from('push_subscriptions')
      .delete()
      .eq('user_id', userId)
      .eq('subscription->>endpoint', endpoint)

    if (error) {
      if (error.code === '42P01') {
        console.warn('push_subscriptions table does not exist in database yet.')
        return NextResponse.json({ error: 'Database schema not ready' }, { status: 503 })
      }
      throw error
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('Error in unsubscribe API:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
