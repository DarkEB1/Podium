'use client'

interface Props {
  password: string
}

function getStrength(pw: string): { score: number; label: string; color: string; textColor: string } {
  if (!pw) return { score: 0, label: '', color: '', textColor: '' }
  let score = 0
  if (pw.length >= 8) score++
  if (/[A-Z]/.test(pw)) score++
  if (/[0-9]/.test(pw)) score++
  if (/[^A-Za-z0-9]/.test(pw)) score++

  if (score <= 1) return { score, label: 'Weak', color: 'bg-destructive', textColor: 'text-destructive' }
  if (score === 2) return { score, label: 'Fair', color: 'bg-warning', textColor: 'text-warning' }
  if (score === 3) return { score, label: 'Good', color: 'bg-primary', textColor: 'text-primary' }
  return { score, label: 'Strong', color: 'bg-success', textColor: 'text-success' }
}

export default function PasswordStrength({ password }: Props) {
  const { score, label, color, textColor } = getStrength(password)
  if (!password) return null

  return (
    <div data-strength={score} className="mt-1 space-y-1">
      <div className="flex gap-1" aria-hidden="true">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-colors ${i <= score ? color : 'bg-muted'}`}
          />
        ))}
      </div>
      <p className={`text-small font-medium ${textColor}`}>
        {label}
      </p>
    </div>
  )
}
