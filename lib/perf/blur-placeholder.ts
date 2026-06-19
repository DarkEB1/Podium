/**
 * Default LQIP tint — a neutral light surface matching the §1.1 placeholder
 * palette (warm off-white background / white card). Shown blurred behind images
 * until the full asset loads, so the layout never flashes a dark or empty box in
 * light mode.
 */
export const DEFAULT_BLUR_RGB = "rgb(241,240,237)"

/**
 * solidBlurDataURL — builds a tiny solid-colour SVG data URL suitable for the
 * `blurDataURL` prop of the A8 `BlurImage` primitive (and as Next.js
 * `placeholder="blur"` data). Deterministic and dependency-free so it works in
 * Server Components without runtime image decoding.
 *
 * @param rgb CSS rgb() colour for the placeholder fill. Defaults to the
 *            light-mode surface tint.
 */
export function solidBlurDataURL(rgb: string = DEFAULT_BLUR_RGB): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"><rect width="8" height="8" fill="${rgb}"/></svg>`
  const base64 =
    typeof Buffer !== "undefined"
      ? Buffer.from(svg).toString("base64")
      : btoa(svg)
  return `data:image/svg+xml;base64,${base64}`
}
