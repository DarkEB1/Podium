import { describe, it, expect, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

// globals.css is a side-effect import in layout.tsx; stub it so vite's PostCSS/Tailwind
// pipeline doesn't run inside the jsdom test environment.
vi.mock('./globals.css', () => ({}))

// next/font/google can't execute under jsdom — mock each font loader to return a
// deterministic CSS-variable class so we can assert the <body> font wiring (plan §1.2).
vi.mock('next/font/google', () => ({
  Geist: () => ({ variable: 'font-geist-var' }),
  DM_Sans: () => ({ variable: 'font-dm-sans-var' }),
  Geist_Mono: () => ({ variable: 'font-geist-mono-var' }),
}))

// next-themes ThemeProvider + Toaster are interactivity-only; render them as passthroughs.
vi.mock('next-themes', () => ({
  ThemeProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))
vi.mock('@/components/ui/sonner', () => ({
  Toaster: () => null,
}))

// Imported after the mocks above (vi.mock is hoisted, so static import is safe).
import RootLayout from './layout'

describe('T1 RootLayout', () => {
  it('applies the Geist heading-font variable class to <body>', () => {
    // RootLayout renders the document <html><body>; jsdom can't nest those in a
    // container, so render to static markup and assert the <body> class wiring.
    const html = renderToStaticMarkup(
      <RootLayout>
        <div>child</div>
      </RootLayout>,
    )
    const bodyTag = html.match(/<body[^>]*class="([^"]*)"/)
    expect(bodyTag).not.toBeNull()
    const bodyClass = bodyTag?.[1] ?? ''
    expect(bodyClass).toContain('font-geist-var')
    expect(bodyClass).toContain('font-dm-sans-var')
    expect(bodyClass).toContain('antialiased')
  })
})
