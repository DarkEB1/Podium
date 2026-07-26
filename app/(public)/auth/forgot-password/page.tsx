import Link from 'next/link'
import ForgotPasswordForm from '@/components/auth/forgot-password-form'

// M-1: per-route metadata. Authenticated surface: `robots.index = false`
// mirrors app/robots.ts so a signed-in page can never be indexed.
export const metadata = {
  title: 'Reset your password · Podium',
  description: 'Send yourself a password reset link for your Podium account.',
  robots: { index: false, follow: false },
}

export default function ForgotPasswordPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 py-16">
      <div className="mx-auto w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="font-heading text-display font-extrabold tracking-tight text-foreground">
            Reset your password
          </h1>
          <p className="mt-3 text-medium text-muted-foreground">
            Enter your email and we&apos;ll send a reset link
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-8 shadow-card">
          <ForgotPasswordForm />
        </div>
        <p className="mt-6 text-center text-medium text-muted-foreground">
          <Link href="/auth" className="font-medium text-primary hover:underline">
            Back to sign in
          </Link>
        </p>
      </div>
    </main>
  )
}
