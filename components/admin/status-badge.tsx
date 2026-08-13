import { cn } from '@/lib/utils'

// Semantic-token tints (mirrors components/ui/status-badges.tsx): success/
// warning/destructive/primary each carry a dark counterpart in globals.css, so
// no explicit dark: variants are needed and nothing fights the design tokens.
const STATUS_STYLES: Record<string, string> = {
  active: 'bg-success/15 text-success',
  pending_review: 'bg-warning/15 text-warning',
  pending_approval: 'bg-warning/15 text-warning',
  draft: 'bg-muted text-muted-foreground',
  deactivated: 'bg-muted text-muted-foreground',
  rejected: 'bg-destructive/15 text-destructive',
  suspended: 'bg-destructive/15 text-destructive',
  paused: 'bg-warning/15 text-warning',
  expired: 'bg-muted text-muted-foreground',
  filled: 'bg-primary/10 text-primary',
}

interface StatusBadgeProps {
  status: string
  className?: string
}

export default function StatusBadge({ status, className }: StatusBadgeProps) {
  const style = STATUS_STYLES[status] ?? 'bg-muted text-muted-foreground'
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
        style,
        className
      )}
    >
      {status.replace(/_/g, ' ')}
    </span>
  )
}
