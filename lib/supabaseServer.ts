import { createClient } from '@supabase/supabase-js';

export const DEFAULT_SUPABASE_URL = 'https://lnlrjaezfcbksjcbwvto.supabase.co';

const isStaleUrl = (url?: string) => !url || url.includes('placeholder') || url.includes('aqvpwhubbytjzcdsfvhc');

export function getServiceClient() {
  const url = isStaleUrl(process.env.NEXT_PUBLIC_SUPABASE_URL) 
    ? DEFAULT_SUPABASE_URL 
    : process.env.NEXT_PUBLIC_SUPABASE_URL!;

  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

  return createClient(url, key, { 
    auth: { persistSession: false } 
  });
}
