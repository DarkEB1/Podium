// The logo mark as geometry: three bars on a shared baseline, ascending left to
// right. One rounding rule at every scale — top-left radius = 60% of bar width,
// minor corners 12% — which is what keeps the nav mark and the hero steps
// reading as the same glyph (spec: Shape).
export const BAR_RATIOS = [0.38, 0.64, 1] as const
export const ROUND_RATIO = 0.6
export const ROUND_MINOR = 0.12

const BAR_W = 30 // viewBox units per bar at height 100
const GAP = 8

function barPath(x: number, h: number, totalH: number): string {
  const rMaj = BAR_W * ROUND_RATIO
  const rMin = BAR_W * ROUND_MINOR
  const top = totalH - h
  return [
    `M ${x} ${totalH - rMin}`,
    `L ${x} ${top + rMaj}`,
    `Q ${x} ${top} ${x + rMaj} ${top}`,
    `L ${x + BAR_W - rMin} ${top}`,
    `Q ${x + BAR_W} ${top} ${x + BAR_W} ${top + rMin}`,
    `L ${x + BAR_W} ${totalH - rMin}`,
    `Q ${x + BAR_W} ${totalH} ${x + BAR_W - rMin} ${totalH}`,
    `L ${x + rMin} ${totalH}`,
    `Q ${x} ${totalH} ${x} ${totalH - rMin}`,
    'Z',
  ].join(' ')
}

export default function PodiumMark({
  height = 24,
  limeTop = false,
  className,
}: {
  height?: number
  limeTop?: boolean
  className?: string
}) {
  const totalH = 100
  const totalW = BAR_W * 3 + GAP * 2
  return (
    <svg
      aria-hidden="true"
      viewBox={`0 0 ${totalW} ${totalH}`}
      height={height}
      width={(height * totalW) / totalH}
      className={className}
    >
      {BAR_RATIOS.map((ratio, i) => (
        <path
          key={i}
          d={barPath(i * (BAR_W + GAP), ratio * totalH, totalH)}
          fill={limeTop && i === 2 ? '#C1EC2F' : 'currentColor'}
        />
      ))}
    </svg>
  )
}
