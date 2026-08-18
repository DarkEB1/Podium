import { notFound } from 'next/navigation'

import DevPreviewSections from './sections'

/**
 * TEMP dev-only component preview harness (same pattern as the aesthetic-sweep
 * harness, see docs/claude/aesthetic-sweep-punchlist.md). Renders selected
 * athlete components with static mock data so they can be inspected without an
 * authenticated session. 404s outside development; middleware carries a
 * matching dev-only public path entry. Remove both before finishing.
 */
export default function DevPreviewPage() {
  if (process.env.NODE_ENV !== 'development') notFound()
  return <DevPreviewSections />
}
