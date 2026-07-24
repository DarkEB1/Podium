"use client"

import * as React from "react"
import Image from "next/image"
import { Avatar as AvatarPrimitive } from "@base-ui/react/avatar"

import { cn } from "@/lib/utils"
import { isRemoteImageSrc } from "@/components/ui/image-src"

function Avatar({
  className,
  size = "default",
  ...props
}: AvatarPrimitive.Root.Props & {
  size?: "default" | "sm" | "lg"
}) {
  return (
    <AvatarPrimitive.Root
      data-slot="avatar"
      data-size={size}
      className={cn(
        "group/avatar relative flex size-8 shrink-0 rounded-full select-none after:absolute after:inset-0 after:rounded-full after:border after:border-border after:mix-blend-darken data-[size=lg]:size-10 data-[size=sm]:size-6 dark:after:mix-blend-lighten",
        className
      )}
      {...props}
    />
  )
}

/**
 * B-5 — never render a broken image.
 *
 * Base UI swaps in the Fallback when the image *errors*, but it will still
 * mount an <img> for a null/empty `src`, which paints the browser's broken-image
 * glyph before any error fires. Bail out early in that case so the Fallback
 * (initials, or the neutral silhouette) is what renders.
 */
function AvatarImage({ className, src, ...props }: AvatarPrimitive.Image.Props) {
  if (typeof src !== "string" || src.trim() === "") return null

  return (
    <AvatarPrimitive.Image
      data-slot="avatar-image"
      src={src}
      className={cn(
        "aspect-square size-full rounded-full object-cover",
        className
      )}
      {...props}
    />
  )
}

function AvatarFallback({
  className,
  ...props
}: AvatarPrimitive.Fallback.Props) {
  return (
    <AvatarPrimitive.Fallback
      data-slot="avatar-fallback"
      className={cn(
        "flex size-full items-center justify-center rounded-full bg-muted text-sm text-muted-foreground group-data-[size=sm]/avatar:text-xs",
        className
      )}
      {...props}
    />
  )
}

function AvatarBadge({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="avatar-badge"
      className={cn(
        "absolute right-0 bottom-0 z-10 inline-flex items-center justify-center rounded-full bg-primary text-primary-foreground bg-blend-color ring-2 ring-background select-none",
        "group-data-[size=sm]/avatar:size-2 group-data-[size=sm]/avatar:[&>svg]:hidden",
        "group-data-[size=default]/avatar:size-2.5 group-data-[size=default]/avatar:[&>svg]:size-2",
        "group-data-[size=lg]/avatar:size-3 group-data-[size=lg]/avatar:[&>svg]:size-2",
        className
      )}
      {...props}
    />
  )
}

function AvatarGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="avatar-group"
      className={cn(
        "group/avatar-group flex -space-x-2 *:data-[slot=avatar]:ring-2 *:data-[slot=avatar]:ring-background",
        className
      )}
      {...props}
    />
  )
}

function AvatarGroupCount({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="avatar-group-count"
      className={cn(
        "relative flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-sm text-muted-foreground ring-2 ring-background group-has-data-[size=lg]/avatar-group:size-10 group-has-data-[size=sm]/avatar-group:size-6 [&>svg]:size-4 group-has-data-[size=lg]/avatar-group:[&>svg]:size-5 group-has-data-[size=sm]/avatar-group:[&>svg]:size-3",
        className
      )}
      {...props}
    />
  )
}

/** Neutral on-brand silhouette shipped in /public — the last-resort avatar. */
const PLACEHOLDER_AVATAR_SRC = "/placeholder-athlete.svg"

/** "Jane Doe" -> "JD"; "cher" -> "C"; "" -> "" (caller falls back to the silhouette). */
function initialsFrom(name: string | null | undefined): string {
  if (!name) return ""
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
  return parts.map((p) => (p[0] ?? "").toUpperCase()).join("")
}

export interface UserAvatarProps
  extends Omit<AvatarPrimitive.Root.Props, "children"> {
  /** Photo URL. null/undefined/empty or a load error degrades to initials. */
  src?: string | null | undefined
  /** Display name — drives the alt text and the initials fallback. */
  name?: string | null | undefined
  size?: "default" | "sm" | "lg"
}

/**
 * UserAvatar — the safe default avatar for the whole app (B-5).
 *
 * Degrades in three steps and can never paint a broken image:
 *   photo → initials → neutral silhouette (/placeholder-athlete.svg).
 *
 * The silhouette is decorative when initials exist, so the accessible name
 * always comes from `name` when we have one.
 */
function UserAvatar({
  src,
  name,
  size = "default",
  className,
  ...props
}: UserAvatarProps) {
  // A load failure flips this and we fall through to initials/silhouette. Reset
  // whenever the src changes so a new photo gets its own chance to load.
  const [failed, setFailed] = React.useState(false)
  React.useEffect(() => setFailed(false), [src])

  const initials = initialsFrom(name)
  const hasPhoto = typeof src === "string" && src.trim() !== "" && !failed

  return (
    <Avatar size={size} className={className} data-testid="user-avatar" {...props}>
      {/* The fallback sits underneath, so even a slow-loading photo never shows
          the browser's broken-image glyph over empty space. */}
      <span
        aria-hidden={hasPhoto ? "true" : undefined}
        className="absolute inset-0 flex items-center justify-center overflow-hidden rounded-full bg-muted text-sm text-muted-foreground group-data-[size=sm]/avatar:text-xs"
      >
        {initials ? (
          <span aria-hidden={name ? undefined : "true"}>{initials}</span>
        ) : (
          /* eslint-disable-next-line @next/next/no-img-element -- static SVG from /public; the optimizer adds nothing and next/image cannot be nested here */
          <img
            src={PLACEHOLDER_AVATAR_SRC}
            alt=""
            aria-hidden="true"
            className="size-full rounded-full object-cover"
          />
        )}
      </span>
      {hasPhoto ? (
        /* A-2: `fill` inherits the Avatar root's fixed size, which already
           reserves the footprint, and adds lazy loading. Remote hosts are not
           declared in next.config.ts, so they bypass the optimizer. */
        <Image
          data-slot="avatar-image"
          // as string: `hasPhoto` has already proved src is a non-empty string.
          src={src as string}
          alt={name ?? ""}
          fill
          sizes="40px"
          loading="lazy"
          onError={() => setFailed(true)}
          unoptimized={isRemoteImageSrc(src as string)}
          className="relative aspect-square size-full rounded-full object-cover"
        />
      ) : null}
    </Avatar>
  )
}

export {
  Avatar,
  AvatarImage,
  UserAvatar,
  PLACEHOLDER_AVATAR_SRC,
  initialsFrom,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
  AvatarBadge,
}
