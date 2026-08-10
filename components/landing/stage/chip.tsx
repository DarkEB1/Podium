// The headline chip: a word set in a plastic tile, the flat cousin of the 3D
// podium bars. One definition so the hero's rotating lime chip and the blue
// chips that close every other headline are unmistakably the same object.
//
// Alignment rule: the tile's text must sit on the same baseline as the rest of
// the sentence. That means the inner line-height matches the headline's (0.92)
// and every layer carries identical padding, so the in-flow ruler and the
// absolutely placed words share one baseline.
export const CHIP_LEADING = 0.92
export const CHIP_PAD = 'px-[0.18em] py-[0.08em]'
// The brand's bar cap, in em so it holds its proportions at every headline
// size. A pixel ceiling here flattened the tile into a generic rounded box and
// broke the rhyme with the moulded bars.
export const CHIP_RADIUS = '0.62em 0.12em 0.12em 0.12em'
// Lifted off the page like the moulded bars: a soft cast shadow plus a hard
// bottom edge that reads as the tile's thickness.
export const CHIP_SHADOW =
  '0 14px 30px -12px rgba(23, 24, 26, 0.45), 0 4px 0 -1px rgba(23, 24, 26, 0.16)'

export type ChipTone = 'lime' | 'blue'

const TONE_CLASS: Record<ChipTone, string> = {
  lime: 'bg-lime text-lime-foreground',
  blue: 'bg-primary text-primary-foreground',
}

/** A static chip: the last word of a headline, set in its tile. */
export default function Chip({
  children,
  tone = 'blue',
}: {
  children: React.ReactNode
  tone?: ChipTone
}) {
  return (
    <span
      className={`relative inline-block whitespace-nowrap align-baseline ${CHIP_PAD} ${TONE_CLASS[tone]}`}
      style={{
        borderRadius: CHIP_RADIUS,
        lineHeight: CHIP_LEADING,
        boxShadow: CHIP_SHADOW,
      }}
    >
      {children}
    </span>
  )
}
