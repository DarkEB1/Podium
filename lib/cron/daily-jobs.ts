import type { NextRequest } from 'next/server'
import { GET as gdprDeletion } from '@/app/api/cron/gdpr-deletion/route'
import { GET as maintenance } from '@/app/api/cron/maintenance/route'
import { GET as reconcileSubscriptions } from '@/app/api/cron/reconcile-subscriptions/route'
import { GET as chatCleanup } from '@/app/api/cron/chat-cleanup/route'
import { GET as guardianConsentExpiry } from '@/app/api/cron/guardian-consent-expiry/route'
import { GET as adultTransfer } from '@/app/api/cron/adult-transfer/route'
import { GET as listingExpiry } from '@/app/api/cron/listing-expiry/route'
import { GET as dataExport } from '@/app/api/cron/data-export/route'

/**
 * Every job the consolidated /api/cron/daily runner executes, in order.
 *
 * The Vercel Hobby plan allows two daily cron slots, so instead of one
 * schedule per job the daily runner covers the whole list and vercel.json
 * schedules only it plus a second data-export pass. Each handler still
 * authenticates the forwarded request itself, so auth semantics are unchanged
 * from when the jobs were scheduled individually.
 *
 * A job listed here must not also have its own vercel.json schedule (it would
 * run twice a day) — data-export is the deliberate exception, giving export
 * fulfilment two runs a day instead of one.
 */
export const DAILY_CRON_JOBS: ReadonlyArray<{
  path: string
  run: (request: NextRequest) => Promise<Response>
}> = [
  { path: '/api/cron/gdpr-deletion', run: gdprDeletion },
  { path: '/api/cron/maintenance', run: maintenance },
  { path: '/api/cron/reconcile-subscriptions', run: reconcileSubscriptions },
  { path: '/api/cron/chat-cleanup', run: chatCleanup },
  { path: '/api/cron/guardian-consent-expiry', run: guardianConsentExpiry },
  { path: '/api/cron/adult-transfer', run: adultTransfer },
  { path: '/api/cron/listing-expiry', run: listingExpiry },
  { path: '/api/cron/data-export', run: dataExport },
]
