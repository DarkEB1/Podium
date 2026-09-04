'use client'

import Link from 'next/link'
import { useEffect, useId, useRef, useState } from 'react'
import PodiumMark from '@/components/brand/podium-mark'
import { ROUTES } from '@/lib/routes'
import { REST_POINTS } from './track-map'

// Fixed 72px nav (build spec v3 §2.3). Transparent over the hero, solid page
// white with a hairline after 40px of scroll. Never translucent, never blurred.
const SECTIONS: { label: string; p: number }[] = [
  { label: 'Marketplace', p: REST_POINTS[1]! },
  { label: 'How it works', p: REST_POINTS[2]! },
]

export type MenuItem = {
  label: string
  /** A destination link, e.g. /pricing or an in-page anchor. */
  href?: string
  /** A corridor jump (tablet) or any other action; runs, then closes the menu. */
  onSelect?: () => void
  /** The single filled call to action at the foot of the menu. */
  primary?: boolean
}

// A disclosure menu for widths below the full nav (tablet corridor and the
// phone stack). Every primary destination the header hides — Marketplace, How
// it works, Pricing — is reachable here (WS-LANDING polish: Pricing was
// unreachable from the landing on phones and tablets). Escape closes it and
// returns focus to the trigger; a click anywhere outside closes it too.
export function MobileMenu({
  items,
  className,
}: {
  items: MenuItem[]
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const menuId = useId()

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false)
        buttonRef.current?.focus()
      }
    }
    const onPointer = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onPointer)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onPointer)
    }
  }, [open])

  return (
    <div ref={rootRef} className={`relative ${className ?? ''}`}>
      <button
        ref={buttonRef}
        type="button"
        aria-label={open ? 'Close menu' : 'Open menu'}
        aria-expanded={open}
        aria-controls={menuId}
        aria-haspopup="menu"
        onClick={() => setOpen((o) => !o)}
        className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl text-foreground transition-colors duration-150 hover:bg-foreground/5"
      >
        <span aria-hidden="true" className="relative block h-4 w-5">
          <span
            className="absolute left-0 block h-[2px] w-5 bg-current transition-transform duration-200"
            style={{ top: open ? 7 : 2, transform: open ? 'rotate(45deg)' : 'none' }}
          />
          <span
            className="absolute left-0 top-[7px] block h-[2px] w-5 bg-current transition-opacity duration-200"
            style={{ opacity: open ? 0 : 1 }}
          />
          <span
            className="absolute left-0 block h-[2px] w-5 bg-current transition-transform duration-200"
            style={{ top: open ? 7 : 12, transform: open ? 'rotate(-45deg)' : 'none' }}
          />
        </span>
      </button>

      {open && (
        <div
          id={menuId}
          role="menu"
          aria-label="Menu"
          className="absolute right-0 top-[calc(100%+8px)] z-50 flex w-56 flex-col gap-1 rounded-2xl border border-foreground/10 bg-background p-2 shadow-[0_16px_40px_-16px_rgba(23,24,26,0.35)]"
        >
          {items.map((item) => {
            const base =
              'cursor-pointer rounded-xl px-3 py-2.5 text-left text-[15px] font-medium transition-colors duration-150'
            const tone = item.primary
              ? 'bg-primary text-primary-foreground hover:bg-[#1F35C8]'
              : 'text-foreground hover:bg-foreground/5'
            if (item.href) {
              return (
                <Link
                  key={item.label}
                  href={item.href}
                  role="menuitem"
                  className={`${base} ${tone}`}
                  onClick={() => setOpen(false)}
                >
                  {item.label}
                </Link>
              )
            }
            return (
              <button
                key={item.label}
                type="button"
                role="menuitem"
                className={`${base} ${tone}`}
                onClick={() => {
                  item.onSelect?.()
                  setOpen(false)
                }}
              >
                {item.label}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default function StageNav({
  solid,
  activePanel,
  onNavigate,
}: {
  solid: boolean
  activePanel: number
  onNavigate: (p: number) => void
}) {
  // Below lg the section links collapse into the disclosure menu so the
  // corridor's tablet widths (768–1023px) can still reach Marketplace, How it
  // works and Pricing.
  const menuItems: MenuItem[] = [
    ...SECTIONS.map((s) => ({ label: s.label, onSelect: () => onNavigate(s.p) })),
    { label: 'Pricing', href: '/pricing' },
    { label: 'Sign in', href: '/auth' },
  ]

  return (
    <header
      className={`absolute inset-x-0 top-0 z-30 flex h-[72px] items-center transition-colors duration-200 ${
        solid ? 'border-b border-foreground/8 bg-background' : 'bg-transparent'
      }`}
      style={{ paddingLeft: 'var(--margin-x)', paddingRight: 'var(--margin-x)' }}
    >
      <button
        type="button"
        onClick={() => onNavigate(0)}
        aria-label="Podium, back to start"
        className="flex cursor-pointer items-center gap-3 text-foreground transition-opacity duration-150 hover:opacity-70"
      >
        <PodiumMark height={28} limeTop className="text-foreground" />
        <span className="font-heading text-[18px] font-extrabold tracking-tight">Podium</span>
      </button>
      <span className="flex-1" />
      <div className="flex items-center gap-8">
        {SECTIONS.map((s, i) => (
          <button
            key={s.label}
            type="button"
            onClick={() => onNavigate(s.p)}
            className="relative hidden cursor-pointer text-[14px] font-medium text-muted-foreground transition-colors duration-150 hover:text-foreground lg:block"
          >
            {activePanel === i + 1 && (
              <span
                aria-hidden="true"
                className="absolute -left-3 top-1/2 h-1 w-1 -translate-y-1/2 bg-lime"
              />
            )}
            {s.label}
          </button>
        ))}
        <Link
          href="/pricing"
          className="hidden text-[14px] font-medium text-muted-foreground transition-colors duration-150 hover:text-foreground lg:block"
        >
          Pricing
        </Link>
        <Link
          href="/auth"
          className="hidden text-[14px] font-medium text-muted-foreground transition-colors duration-150 hover:text-foreground lg:block"
        >
          Sign in
        </Link>
        <Link
          href={ROUTES.auth.signUp}
          className="flex h-10 items-center rounded-xl bg-primary px-5 text-[14px] font-medium text-primary-foreground transition-colors duration-150 hover:bg-[#1F35C8]"
        >
          Join free
        </Link>
        {/* Below lg the section links and Pricing/Sign in live in this menu, so
            they stay reachable on the corridor's tablet widths. */}
        <MobileMenu className="lg:hidden" items={menuItems} />
      </div>
    </header>
  )
}
