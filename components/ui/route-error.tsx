"use client"

import * as React from "react"
import Link from "next/link"
import { AlertTriangle } from "lucide-react"

import { cn } from "@/lib/utils"
import { captureException } from "@/lib/observability"
import { Button, buttonVariants } from "@/components/ui/button"

export interface RouteErrorProps {
  /** The error handed to a Next.js error boundary. Never rendered to the user. */
  error: Error & { digest?: string }
  /** Next.js' boundary reset — re-runs the segment's render. */
  reset: () => void
  /** Short, human, non-technical headline. */
  title?: string
  /** Human explanation. Must not contain anything from `error`. */
  description?: string
  /** Extra escape hatch alongside "Try again". */
  homeHref?: string
  className?: string
}

/**
 * RouteError — B-11 / UX-1.
 *
 * The shared body of every `error.tsx`. Two rules it enforces:
 *
 *  1. The raw error is **never** rendered. Stack traces and DB messages leak
 *     schema and infrastructure detail to whoever triggered the failure, so the
 *     user gets fixed copy and the detail goes to `console.error` (and, in
 *     production, to whatever collector is wired to it). The `digest` is shown
 *     because it is an opaque correlation id and it is what support will ask for.
 *  2. There is always a way forward — `reset()` re-renders the failed segment
 *     without a full page reload, plus a link out.
 */
export function RouteError({
  error,
  reset,
  title = "Something went wrong",
  description = "We hit a problem loading this page. It is not something you did. Try again, and if it keeps happening let us know.",
  homeHref = "/dashboard",
  className,
}: RouteErrorProps) {
  React.useEffect(() => {
    // Logged and reported, never displayed. Every app/**/error.tsx boundary
    // delegates here, so this single call is what makes all of them visible in
    // monitoring (DH-6) — previously a route could blow up for every user and
    // leave no trace beyond a browser console nobody reads.
    console.error("[route-error]", error)
    captureException(error, {
      boundary: "route",
      // Next.js attaches an opaque digest to server-side errors; it is the only
      // safe correlator between this report and the server log.
      ...(error.digest ? { digest: error.digest } : {}),
    })
  }, [error])

  return (
    <section
      role="alert"
      data-slot="route-error"
      data-testid="route-error"
      className={cn(
        "mx-auto flex w-full max-w-md flex-col items-center gap-3 px-6 py-16 text-center md:px-16",
        className
      )}
    >
      <span
        aria-hidden="true"
        className="mb-2 flex size-16 items-center justify-center rounded-full bg-destructive/10 text-destructive"
      >
        <AlertTriangle className="size-7" />
      </span>
      <h1 className="font-heading text-large text-foreground">{title}</h1>
      <p className="text-medium text-muted-foreground">{description}</p>
      {error.digest ? (
        <p className="text-small text-muted-foreground">
          Reference: <span className="font-mono">{error.digest}</span>
        </p>
      ) : null}
      <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
        <Button size="lg" onClick={() => reset()}>
          Try again
        </Button>
        <Link href={homeHref} className={buttonVariants({ variant: "outline", size: "lg" })}>
          Go back
        </Link>
      </div>
    </section>
  )
}

export default RouteError
