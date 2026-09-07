import type { Metadata } from 'next'
import { DM_Sans, Geist_Mono } from 'next/font/google'
import { ThemeProvider } from '@/components/ui/theme-provider'
import CookieBanner from '@/components/legal/cookie-banner'
import { Toaster } from '@/components/ui/sonner'
import './globals.css'
import type { ReactNode } from 'react'
import { siteUrl } from './sitemap'

// Type system: DM Sans everywhere (800 display / 500 UI / 300 secondary);
// Geist_Mono only for micro-labels.
const dmSans = DM_Sans({
  variable: '--font-dm-sans',
  subsets: ['latin'],
  weight: ['300', '500', '700', '800'],
  display: 'swap',
})
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] })

export const metadata: Metadata = {
  // WS-INFRA P2: a shared metadataBase so every page's relative `canonical` and
  // `og:image` resolve to absolute URLs on the canonical host. Individual pages
  // set their own `alternates.canonical`; without a base those would be dropped.
  metadataBase: new URL(siteUrl()),
  title: 'Podium: Sports Sponsorship Marketplace',
  description: 'The marketplace connecting athletes and teams with sponsors.',
}

/*
 * G1 — anti-FOUC. next-themes injects its own pre-hydration script, but the page
 * was still flashing a dark frame before resolving to the light default. This
 * blocking inline script runs in <head> before first paint: it reads the same
 * persisted preference (`storageKey="podium-theme"`) the ThemeProvider writes
 * and puts `.dark` (or not) on <html> synchronously, so the very first painted
 * frame already matches the resolved theme. It honours the same three states the
 * provider supports — 'light' | 'dark' | 'system' — with default (no stored
 * value) resolving to light, and sets `color-scheme` so native controls follow.
 * <html> already carries `suppressHydrationWarning`, so the class the script
 * writes never trips a hydration mismatch.
 */
const themeInitScript = `(function(){try{var e=document.documentElement;var t=localStorage.getItem('podium-theme');var d=t==='dark'||(t==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);e.classList[d?'add':'remove']('dark');e.style.colorScheme=d?'dark':'light';}catch(e){}})();`

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    // Font variables live on <html>: globals.css applies `font-sans` at the html
    // level, and a custom property declared on <body> is invisible up there —
    // which is how the whole site silently fell back to Times New Roman.
    <html lang="en" className={`${dmSans.variable} ${geistMono.variable}`} suppressHydrationWarning>
      <head>
        {/* Runs before first paint so the initial frame matches the stored theme
            (G1). Must stay in <head> and stay blocking (no async/defer). */}
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      {/* Explicit theme-token background on the shell so there is no unpainted
          frame before CSS resolves the theme (G1). */}
      <body className="antialiased bg-background text-foreground">
        {/*
          NX-2/A-1/PR-7: this previously passed `forcedTheme="light"`, which makes
          next-themes ignore every setTheme() call — the reason the ThemeToggle
          appeared to do nothing. The wrapper sets attribute="class" so the
          `.dark` token block in globals.css actually applies.
        */}
        <ThemeProvider>
          {children}
          {/* CL-2/M-7: site-wide so consent is captured before any non-essential
              cookie is set, not only on pages that happen to render the footer. */}
          <CookieBanner />
          <Toaster richColors position="top-right" />
        </ThemeProvider>
      </body>
    </html>
  )
}
