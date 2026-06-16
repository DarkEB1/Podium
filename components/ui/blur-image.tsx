"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

export interface BlurImageProps {
  src: string
  alt: string
  /** Tiny dominant-colour/LQIP data URL shown (blurred) until the full image loads. */
  blurDataURL?: string
  className?: string
}

/**
 * BlurImage — blur-up image. Paints the dominant-colour placeholder
 * (blurDataURL) behind the real image and cross-fades the image in once it
 * loads. WebP-friendly: renders whatever `src` resolves to via a native <img>.
 */
function BlurImage({ src, alt, blurDataURL, className }: BlurImageProps) {
  const [loaded, setLoaded] = useState(false)

  return (
    <div
      data-slot="blur-image"
      className={cn("relative overflow-hidden bg-muted", className)}
      style={
        blurDataURL
          ? {
              backgroundImage: `url(${blurDataURL})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }
          : undefined
      }
    >
      {/* Intentional native <img>: blur-up needs the raw onLoad event and a
          WebP-friendly passthrough src; next/image would obscure both and needs
          remote-host config out of scope for this primitive. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        loading="lazy"
        decoding="async"
        data-loaded={loaded}
        onLoad={() => setLoaded(true)}
        className={cn(
          "h-full w-full object-cover transition-opacity duration-500 ease-out",
          loaded ? "opacity-100" : "opacity-0"
        )}
      />
    </div>
  )
}

export { BlurImage }
