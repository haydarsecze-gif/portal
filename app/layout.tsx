import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import PWAClient from "./components/PWAClient";
import InstallApp from "./components/InstallApp";
import GlobalErrorReporter from "./components/GlobalErrorReporter";
import { UploadProvider } from "./components/UploadContext";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Limkokwing Student Portal",
  description: "Institutional Student Portal Gateway",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Student Portal",
  },
};

export const viewport: Viewport = {
  themeColor: "#4f46e5",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <link rel="icon" href="/icon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/icon.svg" />
        <script dangerouslySetInnerHTML={{ __html: `
          (function() {
            try {
              // 1. Theme handler
              const theme = localStorage.getItem('theme') || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
              if (theme === 'dark') {
                document.documentElement.classList.add('dark');
              } else {
                document.documentElement.classList.remove('dark');
              }

              // 2. One-Time Cache and Cookie Buster
              const cacheBusterKey = 'portal_cache_buster_v3';
              if (!localStorage.getItem(cacheBusterKey)) {
                // Clear all localStorage keys except the theme
                const preservedTheme = localStorage.getItem('theme');
                localStorage.clear();
                if (preservedTheme) {
                  localStorage.setItem('theme', preservedTheme);
                }

                // Clear all sessionStorage
                sessionStorage.clear();

                // Clear all browser cookies starting with 'sb-' or containing 'supabase'
                document.cookie.split(";").forEach((c) => {
                  const name = c.trim().split("=")[0];
                  if (name.startsWith("sb-") || name.toLowerCase().includes("supabase")) {
                    document.cookie = name + "=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
                    document.cookie = name + "=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=" + window.location.hostname + ";";
                    document.cookie = name + "=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=." + window.location.hostname + ";";
                  }
                });

                // Set cache buster flag so this runs only once!
                localStorage.setItem(cacheBusterKey, 'true');
              }
            } catch (e) {}
          })();
        ` }} />
      </head>
      <body className="min-h-full flex flex-col bg-bg-portal text-text-title transition-colors duration-300">
        <GlobalErrorReporter />
        <PWAClient />
        <UploadProvider>
          {children}
        </UploadProvider>
        <InstallApp />
      </body>
    </html>
  );
}
