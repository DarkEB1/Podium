import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'

export default function ForbiddenPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="text-4xl font-bold">403</h1>
      <p className="text-muted-foreground">You don&apos;t have permission to access this page.</p>
      <Link href="/" className={buttonVariants()}>Go home</Link>
    </main>
  )
}
