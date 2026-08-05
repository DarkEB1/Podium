import type { Metadata } from 'next'
import { DM_Sans, Geist_Mono } from 'next/font/google'
import { ThemeProvider } from '@/components/ui/theme-provider'
import CookieBanner from '@/components/legal/cookie-banner'
import { Toaster } from '@/components/ui/sonner'
import './globals.css'
import type { ReactNode } from 'react'

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
  title: 'Podium: Sports Sponsorship Marketplace',
  description: 'The marketplace connecting athletes and teams with sponsors.',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    // Font variables live on <html>: globals.css applies `font-sans` at the html
    // level, and a custom property declared on <body> is invisible up there —
    // which is how the whole site silently fell back to Times New Roman.
    <html lang="en" className={`${dmSans.variable} ${geistMono.variable}`} suppressHydrationWarning>
      <body className="antialiased">
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
