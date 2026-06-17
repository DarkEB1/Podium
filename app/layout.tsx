import type { Metadata } from 'next'
import { Inter, DM_Sans, Geist_Mono } from 'next/font/google'
import { ThemeProvider } from 'next-themes'
import { Toaster } from '@/components/ui/sonner'
import './globals.css'
import type { ReactNode } from 'react'

// Two-typeface system: Inter (Helvetica-like) for headings, DM Sans for body.
const inter = Inter({ variable: '--font-inter', subsets: ['latin'], display: 'swap' })
const dmSans = DM_Sans({ variable: '--font-dm-sans', subsets: ['latin'] })
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Podium — Sports Sponsorship Marketplace',
  description: 'The marketplace connecting athletes and teams with sponsors.',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} ${dmSans.variable} ${geistMono.variable} antialiased`}>
        <ThemeProvider attribute="class" defaultTheme="light" forcedTheme="light" enableSystem={false}>
          {children}
          <Toaster richColors position="top-right" />
        </ThemeProvider>
      </body>
    </html>
  )
}
