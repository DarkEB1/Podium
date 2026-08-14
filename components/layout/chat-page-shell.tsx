import { cn } from '@/lib/utils'

/**
 * ChatPageShell — root container for full-height chat pages.
 *
 * `h-[calc(100dvh-4rem)]` fits the page between the sticky 64px (4rem) header so
 * the composer stays on-screen instead of overflowing like a raw `h-screen`.
 * `pb-16` clears the fixed mobile bottom nav; `md:pb-0` drops that padding once
 * the bottom nav is gone at desktop widths.
 *
 * This is a flex column, so its immediate scrolling child (the ChatWindow /
 * messages container) MUST be given `min-h-0` by the page — a flex child's
 * default `min-height: auto` refuses to shrink below its content, which would
 * push the composer off-screen and scroll the whole page instead of scrolling
 * the message list internally.
 */
export default function ChatPageShell({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'mx-auto flex h-[calc(100dvh-4rem)] max-w-2xl flex-col px-6 pb-16 md:px-16 md:pb-0',
        className,
      )}
    >
      {children}
    </div>
  )
}
