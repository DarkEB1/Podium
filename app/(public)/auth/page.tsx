import Link from 'next/link'
import LoginForm from '@/components/auth/login-form'

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 py-16">
      <div className="mx-auto w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="font-heading text-display font-extrabold tracking-tight text-foreground">
            Welcome back
          </h1>
          <p className="mt-3 text-medium text-muted-foreground">
            Sign in to your Podium account
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-8 shadow-card">
          <LoginForm />
        </div>
        <p className="mt-6 text-center text-medium text-muted-foreground">
          New to Podium?{' '}
          <Link href="/auth/signup" className="font-medium text-primary hover:underline">
            Create an account
          </Link>
        </p>
      </div>
    </main>
  )
}
