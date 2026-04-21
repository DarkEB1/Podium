import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import UpdatePasswordForm from '@/components/auth/update-password-form'

export default function UpdatePasswordPage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle>Set new password</CardTitle>
          <CardDescription>Choose a strong password for your account</CardDescription>
        </CardHeader>
        <CardContent>
          <UpdatePasswordForm />
        </CardContent>
      </Card>
    </main>
  )
}
