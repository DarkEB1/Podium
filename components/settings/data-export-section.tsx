'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { buttonVariants } from '@/components/ui/button'

interface Props {
  initialStatus: string | null
  downloadUrl: string | null
  expiresAt: string | null
}

const STATUS_LABEL: Record<string, string> = {
  pending: 'Preparing your export…',
  processing: 'Preparing your export…',
  ready: 'Your export is ready to download.',
  failed: 'The last export failed. Please try again.',
  expired: 'Your previous download link has expired.',
}

/** GDPR "download my data": request an export and download it when ready. */
export default function DataExportSection({ initialStatus, downloadUrl, expiresAt }: Props) {
  const [status, setStatus] = useState<string | null>(initialStatus)
  const [busy, setBusy] = useState(false)

  async function request() {
    setBusy(true)
    try {
      const res = await fetch('/api/account/data-export', { method: 'POST' })
      if (!res.ok) throw new Error('failed')
      setStatus('pending')
      toast.success('Export requested. We will prepare your data shortly.')
    } catch {
      toast.error('Could not request your export. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  const ready = status === 'ready' && downloadUrl
  const inProgress = status === 'pending' || status === 'processing'

  return (
    <section className="mt-12">
      <h2 className="font-heading text-large font-semibold text-foreground">Your data</h2>
      <p className="mt-3 text-medium text-muted-foreground">
        Download a copy of the personal data Podium holds about you (GDPR data portability).
      </p>

      {status && (
        <p className="mt-4 text-medium text-foreground">{STATUS_LABEL[status] ?? status}</p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        {ready && (
          <a href={downloadUrl!} className={cn(buttonVariants())} target="_blank" rel="noopener noreferrer">
            Download my data
          </a>
        )}
        <button
          type="button"
          onClick={request}
          disabled={busy || inProgress}
          className={cn(buttonVariants({ variant: ready ? 'outline' : 'default' }), (busy || inProgress) && 'opacity-60')}
        >
          {busy ? 'Requesting…' : inProgress ? 'Preparing…' : ready ? 'Request a fresh export' : 'Request my data'}
        </button>
      </div>

      {ready && expiresAt && (
        <p className="mt-2 text-small text-muted-foreground">
          Link valid until {new Date(expiresAt).toLocaleString()}.
        </p>
      )}
    </section>
  )
}
