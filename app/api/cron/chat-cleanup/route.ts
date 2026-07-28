import { type NextRequest } from 'next/server'
import { runCountingCronJob } from '@/lib/cron/run'

/**
 * Chat auto-clear (2.5 / spec Flow 43). Deletes messages older than an athlete
 * participant's chat_retention_days via clear_expired_chat_messages().
 */
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function handle(request: NextRequest) {
  return runCountingCronJob(request, {
    route: '/api/cron/chat-cleanup',
    job: 'chat-cleanup',
    fn: 'clear_expired_chat_messages',
    resultKey: 'messages_cleared',
  })
}

export async function GET(request: NextRequest) {
  return handle(request)
}

export async function POST(request: NextRequest) {
  return handle(request)
}
