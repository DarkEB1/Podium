import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'

export default function VerifyEmailPage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle>Check your email</CardTitle>
          <CardDescription>
            We sent a verification link to your email address. Click it to activate your account.
            The link expires after 24 hours.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-center text-sm text-muted-foreground">
          <p>Didn&apos;t receive it? Check your spam folder.</p>
          <Link href="/auth" className={buttonVariants({ variant: 'link' })}>Back to login</Link>
        </CardContent>
      </Card>
    </main>
  )
}
