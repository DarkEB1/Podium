'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { ContactShadows } from '@react-three/drei'
import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js'
import { useStage, type StageApi } from './stage'
import { PIECES, candidateTheta, trackXVw } from './track-map'

// ————————————————————————————————————————————————————————————————————————
// The 3D stage (build spec v3 §2.6): one transparent canvas behind the DOM.
// World convention: 1 unit = 10vh; floor y=0 projects to the DOM floor line
// (var(--floor-y), 80vh); the camera x-couples 1:1 with the corridor track.
// The trio is the logo made physical: two ink bars and the tall lime one.
// ————————————————————————————————————————————————————————————————————————

const ROUND_MAJOR = 0.6 // top-left radius = 60% of width (brand glyph rule)

// ——— rigid-body contact ————————————————————————————————————————————————
// Dominoes are rigid: piece i may rotate (clockwise, about its bottom-right
// ground edge) only until its leading boundary touches piece i+1. We solve
// quasi-statically each frame: clamp each candidate angle by bisection
// against the next piece's cross-section, back to front. The floor caps
// everything at 90 degrees.
type Piece2D = { pivotX: number; w: number; h: number }

/** Local → world for a piece rotated clockwise by theta about its pivot. */
function worldPoint(piece: Piece2D, theta: number, lx: number, ly: number): [number, number] {
  const c = Math.cos(theta)
  const s = Math.sin(theta)
  return [piece.pivotX + lx * c + ly * s, -lx * s + ly * c]
}

/** Sample points along a piece's leading (right + top) boundary, in local coords. */
function leadingSamples(piece: Piece2D): [number, number][] {
  const { w, h } = piece
  const rMaj = w * ROUND_MAJOR
  const pts: [number, number][] = []
  for (let t = 1; t <= 10; t++) pts.push([0, (t / 10) * h]) // right face
  for (let t = 1; t <= 4; t++) pts.push([-(t / 4) * (w - rMaj), h]) // top edge
  for (let a = 100; a <= 180; a += 20) {
    // top-left arc (the big brand radius)
    const phi = (a * Math.PI) / 180
    pts.push([-(w - rMaj) + rMaj * Math.cos(phi), h - rMaj + rMaj * Math.sin(phi)])
  }
  return pts
}

/** Does piece a at thetaA penetrate piece b at thetaB? */
function penetrates(
  a: Piece2D,
  thetaA: number,
  samplesA: [number, number][],
  b: Piece2D,
  thetaB: number
): boolean {
  const c = Math.cos(thetaB)
  const s = Math.sin(thetaB)
  const inset = 0.005
  for (const [lx, ly] of samplesA) {
    const [wx, wy] = worldPoint(a, thetaA, lx, ly)
    const dx = wx - b.pivotX
    const dy = wy
    // inverse of the clockwise rotation
    const bx = dx * c - dy * s
    const by = dx * s + dy * c
    if (bx > -b.w + inset && bx < -inset && by > inset && by < b.h - inset) return true
  }
  return false
}

/** Largest angle ≤ candidate at which piece a does not penetrate piece b. */
function clampTheta(
  a: Piece2D,
  samplesA: [number, number][],
  candidate: number,
  b: Piece2D,
  thetaB: number
): number {
  if (!penetrates(a, candidate, samplesA, b, thetaB)) return candidate
  let lo = 0
  let hi = candidate
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2
    if (penetrates(a, mid, samplesA, b, thetaB)) hi = mid
    else lo = mid
  }
  return lo
}

// ——— material ———————————————————————————————————————————————————————————
// Injection-moulded lime plastic, one shared material for the whole trio
// (founder direction 2026-08-10: all bars lime).
function useLimePlastic(): THREE.MeshPhysicalMaterial {
  return useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: new THREE.Color('#C1EC2F'),
        metalness: 0,
        roughness: 0.3,
        clearcoat: 1.0,
        clearcoatRoughness: 0.12,
        ior: 1.45,
        specularIntensity: 0.55,
      }),
    []
  )
}

// Podium-glyph cross-section: big top-left radius (60% of width), 12% others,
// extruded to 0.55 × width with a 3%-width fillet so the clearcoat draws a
// highlight line along every edge.
function glyphGeometry(w: number, h: number): THREE.ExtrudeGeometry {
  const rMaj = w * ROUND_MAJOR
  const rMin = w * 0.12
  const fillet = w * 0.03
  const shape = new THREE.Shape()
  shape.moveTo(rMin, 0)
  shape.lineTo(w - rMin, 0)
  shape.absarc(w - rMin, rMin, rMin, -Math.PI / 2, 0, false)
  shape.lineTo(w, h - rMin)
  shape.absarc(w - rMin, h - rMin, rMin, 0, Math.PI / 2, false)
  shape.lineTo(rMaj, h)
  shape.absarc(rMaj, h - rMaj, rMaj, Math.PI / 2, Math.PI, false)
  shape.lineTo(0, rMin)
  shape.absarc(rMin, rMin, rMin, Math.PI, Math.PI * 1.5, false)
  const depth = w * 0.55
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: fillet,
    bevelSize: fillet,
    bevelSegments: 3,
    curveSegments: 24,
  })
  geo.translate(0, 0, -depth / 2)
  return geo
}

// Load choreography: the stack starts fallen and un-falls to standing, front
// to back. Driven by performance.now so a paused r3f clock can never freeze it.
const UNFALL_DELAY = [0.5, 0.75, 1.0]
const UNFALL_DUR = 0.9

function HeroDominoes({ stage, vpW, vpH }: { stage: StageApi; vpW: number; vpH: number }) {
  const material = useLimePlastic()
  const groups = useRef<(THREE.Group | null)[]>([])
  const loadT = useRef<number | null>(null)
  // Displayed angles, smoothed: the contact clamp is discontinuous at the
  // moment a corner slips off the next piece's edge, so the raw solve pops.
  const shown = useRef<[number, number, number]>([0, 0, 0])

  const aspect = vpW / vpH
  const unitsPerVw = (10 * aspect) / 100
  const unitsPerVh = 0.1

  const pieces: Piece2D[] = useMemo(
    () =>
      PIECES.map((p) => ({
        w: p.wVw * unitsPerVw,
        h: p.hVh * unitsPerVh,
        pivotX: (p.centerVw - 50) * unitsPerVw + (p.wVw * unitsPerVw) / 2,
      })),
    [unitsPerVw, unitsPerVh]
  )
  const samples = useMemo(() => pieces.map(leadingSamples), [pieces])

  const geometries = useMemo(() => pieces.map((p) => glyphGeometry(p.w, p.h)), [pieces])
  useEffect(() => () => geometries.forEach((g) => g.dispose()), [geometries])

  useFrame((_, delta) => {
    const p = stage.getP()
    if (loadT.current === null) loadT.current = performance.now() / 1000
    const sinceLoad = performance.now() / 1000 - loadT.current

    // Candidate angles: scroll scrub vs the un-fall intro, whichever is larger.
    const HALF_PI = Math.PI / 2
    const cand = [0, 1, 2].map((i) => {
      const scrub = (candidateTheta(p, i as 0 | 1 | 2) * Math.PI) / 180
      const t = Math.min(Math.max((sinceLoad - UNFALL_DELAY[i]!) / UNFALL_DUR, 0), 1)
      const settle = 1 - Math.pow(1 - t, 3)
      const unfall = HALF_PI * (1 - settle)
      return Math.min(Math.max(scrub, unfall), HALF_PI)
    })

    // Rigid resolve, back to front. The last piece stays analytic so the
    // corner-push track coupling and camera never desync. The others clamp
    // against their neighbour's DISPLAYED angle, then approach the result on
    // a short exponential so a corner slipping off an edge releases as an
    // accelerating slide instead of a pop; the hard min() keeps rigidity when
    // the neighbour rises back underneath.
    const s = shown.current
    const k = 1 - Math.exp(-Math.min(delta, 1 / 30) / 0.06)
    s[2] = cand[2]!
    for (const i of [1, 0] as const) {
      const clampMax = clampTheta(pieces[i]!, samples[i]!, cand[i]!, pieces[i + 1]!, s[i + 1]!)
      s[i] = Math.min(s[i]! + (clampMax - s[i]!) * k, clampMax)
    }

    groups.current.forEach((g, i) => {
      if (g) g.rotation.z = -s[i]!
    })
  })

  return (
    <>
      {pieces.map((p, i) => (
        <group key={i} ref={(el) => { groups.current[i] = el }} position={[p.pivotX, 0, 0]}>
          <mesh
            geometry={geometries[i]!}
            material={material}
            position={[-p.w, 0, 0]}
            castShadow
          />
        </group>
      ))}
    </>
  )
}

function Rig({ stage, vpW, vpH }: { stage: StageApi; vpW: number; vpH: number }) {
  const { camera } = useThree()
  const aspect = vpW / vpH
  const unitsPerVw = (10 * aspect) / 100
  const vhPerVw = vpH / vpW

  useFrame(() => {
    const p = stage.getP()
    // Screen center is 50vh; the floor (y=0) must project to 80vh → the camera
    // looks straight ahead from y = 3.0 units. fov 28 → distance so 10 units
    // fill 100vh.
    const dist = 5 / Math.tan(THREE.MathUtils.degToRad(14))
    const x = -trackXVw(p, vhPerVw) * unitsPerVw
    camera.position.set(x, 3.0, dist)
    camera.lookAt(x, 3.0, 0)
  })
  return null
}

function KeyLight() {
  const ref = useRef<THREE.RectAreaLight>(null)
  useEffect(() => {
    ref.current?.lookAt(0, 1, 0)
  }, [])
  return <rectAreaLight ref={ref} position={[-6, 7, 6]} width={4} height={4} intensity={2.4} />
}

function SceneInner({
  stage,
  vpW,
  vpH,
  onAlive,
}: {
  stage: StageApi
  vpW: number
  vpH: number
  onAlive: () => void
}) {
  const { gl, scene } = useThree()
  // First frame = children mounted AND the loop is running.
  const signalled = useRef(false)
  useFrame(() => {
    if (!signalled.current) {
      signalled.current = true
      onAlive()
    }
  })
  // Neutral procedural studio environment — no network fetch (CSP-safe).
  useEffect(() => {
    RectAreaLightUniformsLib.init()
    const pmrem = new THREE.PMREMGenerator(gl)
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
    scene.environment = env
    scene.environmentIntensity = 0.5
    return () => {
      pmrem.dispose()
      env.dispose()
    }
  }, [gl, scene])

  return (
    <>
      <Rig stage={stage} vpW={vpW} vpH={vpH} />
      <KeyLight />
      <directionalLight position={[5, 3, 4]} intensity={0.5} />
      <HeroDominoes stage={stage} vpW={vpW} vpH={vpH} />
      <ContactShadows
        position={[0, 0, 0]}
        opacity={0.3}
        blur={2.2}
        scale={24}
        resolution={512}
        frames={Infinity}
      />
    </>
  )
}

export default function LandingScene() {
  const stage = useStage()
  // Mount gate instead of next/dynamic: three.js only ever runs client-side,
  // and the canvas appears after first paint (SSR emits nothing here).
  const [vp, setVp] = useState<{ w: number; h: number } | null>(null)
  useEffect(() => {
    const measure = () => setVp({ w: window.innerWidth, h: window.innerHeight })
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [])
  // Cold-load watchdog: rarely the Canvas's internal root renders nothing
  // (canvas + GL context exist, first frame never runs — the inner render can
  // be starved during heavy hydration). ONE patient remount after 4s recovers
  // it; a shorter fuse is worse than the disease, because remounting during
  // the PMREM environment bake leaves a half-lit scene.
  const [epoch, setEpoch] = useState(0)
  const alive = useRef(false)
  useEffect(() => {
    if (!vp) return
    alive.current = false
    const t = setTimeout(() => {
      if (!alive.current && epoch < 1) setEpoch((e) => e + 1)
    }, 4000)
    return () => clearTimeout(t)
  }, [vp, epoch])
  if (!vp) return null
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-0">
      <Canvas
        key={epoch}
        frameloop="always"
        dpr={[1, 1.75]}
        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.0 }}
        camera={{ fov: 28, near: 0.1, far: 100 }}
      >
        <SceneInner
          stage={stage}
          vpW={vp.w}
          vpH={vp.h}
          onAlive={() => {
            alive.current = true
          }}
        />
      </Canvas>
    </div>
  )
}
