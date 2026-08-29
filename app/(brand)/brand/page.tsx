import { redirect } from 'next/navigation'
import { ROLE_DASHBOARD } from '@/lib/routes'

// The role root has no content of its own; its home is the dashboard. Without
// this a typed or linked `/brand` fell through to the bare 404.
export default function BrandRootPage() {
  redirect(ROLE_DASHBOARD.brand)
}
