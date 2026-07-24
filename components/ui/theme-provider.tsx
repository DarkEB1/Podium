"use client"

import * as React from "react"
import { ThemeProvider as NextThemesProvider } from "next-themes"

export type ThemeProviderProps = React.ComponentProps<typeof NextThemesProvider>

/**
 * ThemeProvider — the single mount point for next-themes.
 *
 * NX-2: dark mode was dead because (a) the root layout pinned
 * `forcedTheme="light"`, and (b) Tailwind 4 resolves `dark:` from
 * prefers-color-scheme unless the variant is rebound to a class (done in
 * app/globals.css). This wrapper fixes the provider half:
 *
 * - `attribute="class"` writes `class="dark"` onto <html>, which is what the
 *   `@custom-variant dark (&:where(.dark, .dark *))` rule matches.
 * - `disableTransitionOnChange` stops every transitioned property in the tree
 *   from animating during a theme swap.
 * - next-themes injects a blocking inline script that reads localStorage before
 *   first paint, so there is no flash of the wrong theme. The root <html> must
 *   carry `suppressHydrationWarning` (it already does).
 */
export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      storageKey="podium-theme"
      {...props}
    >
      {children}
    </NextThemesProvider>
  )
}

export default ThemeProvider
