import Link from 'next/link'
import SignUpForm from '@/components/auth/sign-up-form'

export default function SignUpPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 py-16">
      <div className="mx-auto w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="font-heading text-display font-extrabold tracking-tight text-foreground">
            Create your account
          </h1>
          <p className="mt-3 text-medium text-muted-foreground">
            Join Podium — free for athletes, teams &amp; agents
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-8 shadow-card">
          <SignUpForm />
        </div>
        <p className="mt-6 text-center text-medium text-muted-foreground">
          Already have an account?{' '}
          <Link href="/auth" className="font-medium text-primary hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  )
}
