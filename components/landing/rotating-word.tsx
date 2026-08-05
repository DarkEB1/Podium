'use client'

import { useEffect, useState } from 'react'

// The hero's fill-in-the-blank word. The lime block is the page's one
// full-saturation lime element (spec: colour rules); ink text on lime is 13:1.
export default function RotatingWord({
  words,
  intervalMs = 2500,
}: {
  words: string[]
  intervalMs?: number
}) {
  const [index, setIndex] = useState(0)

  useEffect(() => {
    const id = setInterval(() => setIndex((i) => (i + 1) % words.length), intervalMs)
    return () => clearInterval(id)
  }, [words.length, intervalMs])

  const list =
    words.length > 1 ? `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}` : words[0]

  return (
    <>
      <span
        aria-hidden="true"
        className="inline-block rounded-xl bg-lime px-3 text-foreground transition-all duration-300 motion-reduce:transition-none"
      >
        {words[index]}
      </span>
      <span className="sr-only">{list}</span>
    </>
  )
}
