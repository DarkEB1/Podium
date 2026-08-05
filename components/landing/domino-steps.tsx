'use client'

import { useContext } from 'react'
import { TrackContext } from './horizontal-track'
import { dominoAngle } from '@/lib/landing/track-math'
import { BAR_RATIOS } from '@/components/brand/podium-mark'

// The hero's podium steps, standing on the baseline. During the panel 1→2
// transition they tip like dominoes about their bottom-right corners.
const WIDTH_PX = 110

export default function DominoSteps() {
  const { progress } = useContext(TrackContext)
  return (
    <div aria-hidden="true" className="flex items-end gap-3" style={{ height: 320 }}>
      {BAR_RATIOS.map((ratio, i) => (
        <div
          key={i}
          className="bg-lime"
          style={{
            width: WIDTH_PX,
            height: ratio * 320,
            // Proportional rounding: 60% / 12% of bar width (spec: shape).
            borderRadius: `${WIDTH_PX * 0.6}px ${WIDTH_PX * 0.12}px ${WIDTH_PX * 0.12}px ${WIDTH_PX * 0.12}px`,
            transform: `rotate(${dominoAngle(progress, i as 0 | 1 | 2)}deg)`,
            transformOrigin: 'bottom right',
            transition: 'transform 0.05s linear',
          }}
        />
      ))}
    </div>
  )
}
