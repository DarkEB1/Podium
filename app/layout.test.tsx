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
  // The font variables live on <html>, not <body>: globals.css applies
  // `font-sans` at the html level, so variables declared lower down are not in
  // scope when that rule resolves and the page falls back to a serif.
  it('applies the DM Sans and Geist Mono font variable classes to <html>', () => {
    // RootLayout renders the document <html><body>; jsdom can't nest those in a
    // container, so render to static markup and assert the class wiring.
    const html = renderToStaticMarkup(
      <RootLayout>
        <div>child</div>
      </RootLayout>,
    )
    const htmlTag = html.match(/<html[^>]*class="([^"]*)"/)
    expect(htmlTag).not.toBeNull()
    const htmlClass = htmlTag?.[1] ?? ''
    expect(htmlClass).toContain('font-dm-sans-var')
    expect(htmlClass).toContain('font-geist-mono-var')

    const bodyTag = html.match(/<body[^>]*class="([^"]*)"/)
    expect(bodyTag?.[1] ?? '').toContain('antialiased')
  })
})
