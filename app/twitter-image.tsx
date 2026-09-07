// WS-INFRA P2 — `twitter:image`. Next uses `opengraph-image` for `og:image` and
// `twitter-image` for `twitter:image` independently; re-exporting the OG route
// here means a single rendered card serves both without duplicating the design,
// so home's `summary_large_image` card finally has an image.
export { runtime, alt, size, contentType, default } from './opengraph-image'
