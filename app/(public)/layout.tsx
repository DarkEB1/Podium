import type { ReactNode } from 'react'

export default function PublicLayout({ children }: { children: ReactNode }) {
  // marketing-light: the signed-out funnel is art-directed light to match the
  // landing, so the pre-login journey is one continuous look regardless of the
  // visitor's system theme. The signed-in app keeps its light/dark toggle.
  return <div className="marketing-light min-h-screen bg-background text-foreground">{children}</div>
}
