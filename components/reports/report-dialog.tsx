'use client'

import { useState } from 'react'
import { Flag } from 'lucide-react'
import { toast } from 'sonner'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { REPORT_DETAIL_MAX } from '@/lib/limits'
import { Constants } from '@/types/database'

/**
 * WS-ADMIN — the report API existed but nothing in the product let a user file
 * a report. This is the minimal control: a trigger button that opens a dialog
 * to pick a reason, add optional detail, and POST to `/api/reports`.
 *
 * Deliberately generic so it can sit on a profile (reportedUserId) or a message
 * (reportedMessageId). Mount it wherever a user can be seen; the API validates
 * self-reports, duplicates and unknown targets.
 */

type ReportReason = (typeof Constants.public.Enums.report_reason)[number]

const REASON_LABELS: Record<ReportReason, string> = {
  fake_profile: 'Fake or impersonating profile',
  inappropriate_content: 'Inappropriate content',
  harassment: 'Harassment or abuse',
  spam: 'Spam',
  underage_concern: 'Concern about a minor',
  other: 'Something else',
}

interface Props {
  /** The user being reported (profile report). */
  reportedUserId?: string
  /** The message being reported (message report). */
  reportedMessageId?: string
  /** Display name of what is being reported, for the dialog copy. */
  targetLabel?: string
  /** Render a compact icon-only trigger (e.g. inside a message bubble). */
  compact?: boolean
  className?: string
}

export default function ReportDialog({
  reportedUserId,
  reportedMessageId,
  targetLabel,
  compact = false,
  className,
}: Props) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState<ReportReason | ''>('')
  const [detail, setDetail] = useState('')
  const [pending, setPending] = useState(false)

  function reset() {
    setReason('')
    setDetail('')
    setPending(false)
  }

  async function submit() {
    if (!reason || pending) return
    setPending(true)
    try {
      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason,
          ...(reportedUserId ? { reported_user_id: reportedUserId } : {}),
          ...(reportedMessageId ? { reported_message_id: reportedMessageId } : {}),
          ...(detail.trim() ? { detail: detail.trim() } : {}),
        }),
      })

      if (res.ok) {
        toast.success('Thanks for the report. Our team will review it.')
        setOpen(false)
        reset()
        return
      }

      // The API returns a user-safe message for the cases a reporter can act on
      // (already reported, target gone, self-report). Fall back to a generic
      // line for anything else.
      const body = (await res.json().catch(() => ({}))) as {
        error?: { code?: string; message?: string }
      }
      const known =
        res.status === 409 || res.status === 404 || res.status === 400
      toast.error(
        known && body.error?.message
          ? body.error.message
          : 'Could not submit that report. Please try again in a moment.',
      )
      setPending(false)
    } catch {
      toast.error('Could not submit that report. Please check your connection and try again.')
      setPending(false)
    }
  }

  const title = targetLabel ? `Report ${targetLabel}` : 'Report'

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) reset()
      }}
    >
      <DialogTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size={compact ? 'icon-sm' : 'sm'}
            {...(className ? { className } : {})}
          />
        }
      >
        <Flag className="size-4" aria-hidden="true" />
        {compact ? <span className="sr-only">Report</span> : <span>Report</span>}
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Tell us what&apos;s wrong. Reports are confidential and reviewed by our
            trust team.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="report-reason">Reason</Label>
            <select
              id="report-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value as ReportReason)}
              className="flex h-10 w-full rounded-xl border border-border bg-card px-3 text-sm shadow-sm outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/40"
            >
              <option value="" disabled>
                Select a reason…
              </option>
              {Constants.public.Enums.report_reason.map((value) => (
                <option key={value} value={value}>
                  {REASON_LABELS[value]}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="report-detail">Details (optional)</Label>
            <Textarea
              id="report-detail"
              value={detail}
              maxLength={REPORT_DETAIL_MAX}
              onChange={(e) => setDetail(e.target.value)}
              placeholder="Add anything that helps us understand the problem."
              rows={4}
            />
          </div>
        </div>

        <DialogFooter showCloseButton>
          <Button type="button" onClick={submit} disabled={!reason || pending}>
            {pending ? 'Submitting…' : 'Submit report'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
