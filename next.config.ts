import type { NextConfig } from "next";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';

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
