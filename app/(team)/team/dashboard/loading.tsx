// B-11 / UX-1 — streamed skeleton for this segment's server fetch, so the
// route never paints a blank screen while data resolves.
import { PageSkeleton } from '@/components/ui/page-skeleton'

export default function Loading() {
  return <PageSkeleton variant="grid" heading={true} label="Loading dashboard" />
}
