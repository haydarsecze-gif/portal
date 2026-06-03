import { NextResponse } from 'next/server'

export async function GET() {
  const publicVapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || null
  const privateVapidKey = process.env.VAPID_PRIVATE_KEY || null

  return NextResponse.json({
    hasPublicVapidKey: !!publicVapidKey,
    hasPrivateVapidKey: !!privateVapidKey,
    publicVapidKey: publicVapidKey,
    message: (!publicVapidKey || !privateVapidKey)
      ? "VAPID keys are missing from environment variables. Please check your Vercel Dashboard Project Settings."
      : "VAPID keys are successfully configured on the server."
  })
}
