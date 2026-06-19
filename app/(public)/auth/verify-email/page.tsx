import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'

export default function VerifyEmailPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 py-16">
      <div className="mx-auto w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="font-heading text-display font-extrabold tracking-tight text-foreground">
            Check your email
          </h1>
          <p className="mt-3 text-medium text-muted-foreground">
            We sent a verification link to your email address. Click it to activate your account.
            The link expires after 24 hours.
          </p>
        </div>
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-border bg-card p-8 text-center shadow-card">
          <p className="text-medium text-muted-foreground">
            Didn&apos;t receive it? Check your spam folder.
          </p>
          <Link href="/auth" className={buttonVariants({ variant: 'outline' })}>
            Back to login
          </Link>
        </div>
      </div>
    </main>
  )
}
