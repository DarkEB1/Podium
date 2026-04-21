import Link from 'next/link'
import { cn } from '@/lib/utils'
import type { Database } from '@/types/database'

type MatchRow = Database['public']['Tables']['matches']['Row']

interface Props {
  matches: MatchRow[]
  currentUserId: string
  basePath: string
}

export default function MatchList({ matches, currentUserId, basePath }: Props) {
  if (matches.length === 0) {
    return (
      <p className="text-center text-muted-foreground py-12">
        No conversations yet. Accept a connection request to start chatting.
      </p>
    )
  }

  return (
    <ul className="divide-y rounded-xl border">
      {matches.map((match) => {
        const otherId = match.user_a_id === currentUserId ? match.user_b_id : match.user_a_id
        return (
          <li key={match.id}>
            <Link
              href={`${basePath}/${match.id}`}
              className={cn(
                'flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors'
              )}
            >
              <div>
                <p className="font-medium text-sm">Conversation</p>
                <p className="text-xs text-muted-foreground font-mono">{otherId}</p>
              </div>
              <span className="text-xs text-muted-foreground">
                {new Date(match.matched_at).toLocaleDateString()}
              </span>
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
