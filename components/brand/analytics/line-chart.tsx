interface Point {
  x: string
  y: number
}

/**
 * LineChart, a hand-rolled SVG trend line (no chart library in the project).
 * Renders a light horizontal gridline, a filled area under the trend, and a
 * `currentColor` polyline so it picks up `text-primary` from its wrapper.
 * Degrades gracefully to an empty (but valid) `<svg>` when `data` is empty.
 */
export function LineChart({ data, height = 160 }: { data: Point[]; height?: number }) {
  const width = 480
  const pad = 24
  const maxY = Math.max(1, ...data.map((d) => d.y))
  const stepX = data.length > 1 ? (width - pad * 2) / (data.length - 1) : 0
  const coords = data.map((d, i) => {
    const x = pad + i * stepX
    const y = height - pad - (d.y / maxY) * (height - pad * 2)
    return { x, y }
  })
  const points = coords.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
  const areaPoints =
    coords.length > 0
      ? `${pad.toFixed(1)},${(height - pad).toFixed(1)} ${points} ${(pad + (data.length - 1) * stepX).toFixed(1)},${(height - pad).toFixed(1)}`
      : ''
  const baselineY = height - pad

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full text-primary"
      style={{ height }}
      role="img"
      aria-label="Trend over the billing period"
    >
      <line
        x1={pad}
        y1={baselineY}
        x2={width - pad}
        y2={baselineY}
        stroke="currentColor"
        strokeOpacity={0.15}
        strokeWidth="1"
      />
      {data.length > 0 ? (
        <>
          <polygon points={areaPoints} fill="currentColor" fillOpacity={0.08} stroke="none" />
          <polyline fill="none" stroke="currentColor" strokeWidth="2" points={points} />
          {coords.map((p, i) => (
            <circle key={data[i]?.x ?? i} cx={p.x} cy={p.y} r={2.5} fill="currentColor" />
          ))}
        </>
      ) : null}
    </svg>
  )
}
