import type { NextConfig } from "next";

const DEFAULT_SUPABASE_URL = 'https://lnlrjaezfcbksjcbwvto.supabase.co';
const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseUrl = (!rawUrl || rawUrl.includes('placeholder') || rawUrl.includes('aqvpwhubbytjzcdsfvhc'))
  ? DEFAULT_SUPABASE_URL
  : rawUrl;

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: '/_supabase/:path*',
        destination: `${supabaseUrl}/:path*`,
      },
    ];
  },
};

export default nextConfig;
