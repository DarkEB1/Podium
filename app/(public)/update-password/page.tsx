import UpdatePasswordForm from '@/components/auth/update-password-form'

// M-1: per-route metadata. Authenticated surface: `robots.index = false`
// mirrors app/robots.ts so a signed-in page can never be indexed.
export const metadata = {
  title: 'Set a new password · Podium',
  description: 'Choose a new password for your Podium account.',
  robots: { index: false, follow: false },
}

export default function UpdatePasswordPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 py-16">
      <div className="mx-auto w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="font-heading text-display font-extrabold tracking-tight text-foreground">
            Set new password
          </h1>
          <p className="mt-3 text-medium text-muted-foreground">
            Choose a strong password for your account
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-8 shadow-card">
          <UpdatePasswordForm />
        </div>
      </div>
    </main>
  )
}
