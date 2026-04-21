import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import LoginForm from '@/components/auth/login-form'

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle>Welcome back</CardTitle>
          <CardDescription>Sign in to your Podium account</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <LoginForm />
          <p className="text-center text-sm text-muted-foreground">
            New to Podium?{' '}
            <Link href="/auth/signup" className="font-medium text-foreground hover:underline">
              Create an account
            </Link>
          </p>
        </CardContent>
      </Card>
    </main>
  )
}
