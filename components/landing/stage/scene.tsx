'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { ContactShadows } from '@react-three/drei'
import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js'
import { useStage, type StageApi } from './stage'
import { PIECES, ASSEMBLY_WINDOWS, atSeg, candidateTheta, trackXVw } from './track-map'
import { panelHover } from './hover-store'

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
        // Sheen is white, so it lifts the blue channel of a saturated green
        // fastest. Kept low so the moulded face reads as the same #C1EC2F the
        // headline chip is painted with (verified by sampling the render).
        specularIntensity: 0.3,
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
  // The bevel grows the shape outward on every side, so the piece's true
  // bottom sits at -fillet. Lift it so the moulded edge lands ON the floor
  // line rather than a few pixels under it.
  geo.translate(0, fillet, -depth / 2)
  return geo
}

// Load choreography (founder direction 2026-08-10): the bars APPEAR — they
// pop into place from nothing and wobble a moment on their base, the way a
// dropped plastic block settles. Nothing rises from the floor. Driven by
// performance.now so a paused r3f clock can never freeze it.
const POP_DELAY = [0.15, 0.32, 0.49]
const POP_DUR = 0.42
const WOBBLE_DEG = 3.4
const WOBBLE_HZ = 4.2
const WOBBLE_DECAY = 4.6
// The idle rock that invites the first push.
const IDLE_PERIOD = 3.4
const IDLE_LEAN_DEG = 4.5

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

    // Candidate angles come from the scroll scrub alone; the load entrance is
    // a scale pop plus a decaying wobble applied on top (see below).
    const HALF_PI = Math.PI / 2
    const cand = [0, 1, 2].map((i) =>
      Math.min((candidateTheta(p, i as 0 | 1 | 2) * Math.PI) / 180, HALF_PI)
    )

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
      if (!g) return
      // Entrance: scale pop about the ground pivot, then a damped wobble that
      // dies out. Both are pure decoration on top of the contact solve.
      const e = (performance.now() / 1000 - loadT.current!) - POP_DELAY[i]!
      const t = Math.min(Math.max(e / POP_DUR, 0), 1)
      g.scale.setScalar(Math.max(0.0001, easeOutBack(t)))
      const wobble =
        e > 0 && e < 2.4
          ? ((WOBBLE_DEG * Math.PI) / 180) *
            Math.exp(-WOBBLE_DECAY * e) *
            Math.sin(2 * Math.PI * WOBBLE_HZ * e)
          : 0
      // Idle invitation: until the visitor scrolls, the front piece rocks
      // toward its neighbour every few seconds. It says "these fall" far more
      // directly than any label can.
      let idle = 0
      if (i === 0 && p < 0.004 && e > 1.6) {
        const phase = ((e - 1.6) % IDLE_PERIOD) / IDLE_PERIOD
        if (phase < 0.3) idle = ((IDLE_LEAN_DEG * Math.PI) / 180) * Math.sin((phase / 0.3) * Math.PI)
      }
      g.rotation.z = -(s[i]! + wobble + idle)
    })
  })

  return (
    <>
      {pieces.map((p, i) => (
        <group key={i} ref={(el) => { groups.current[i] = el }} position={[p.pivotX, 0, 0]} scale={0.0001}>
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

// ——— panel set pieces ————————————————————————————————————————————————————
// The corridor is one continuous 3D stage: every panel has plastic furniture
// standing on the same floor, passed by the same camera. Positions are in
// panel-local vw (panel index n starts at track x = n·100vw).
type SetPiece = {
  id?: string
  panel: number
  centerVw: number
  wVw: number
  hVh: number
  window: [number, number]
  entrance: 'assemble' | 'grow'
  /** assembly parts only: which side the part swings in from */
  tilt?: number
  tone: 'lime' | 'tint1' | 'tint2'
  bobPhase?: number
}

const SET_PIECES: SetPiece[] = [
  // 03 What we do — three parts drop into their footprints and click home,
  // palest to full lime. Windows come from track-map so the DOM copy riding
  // on each part lands on the same frame.
  { id: 'what-0', panel: 2, centerVw: 20, wVw: 16, hVh: 26, window: [...ASSEMBLY_WINDOWS[0]!] as [number, number], entrance: 'assemble', tilt: 0.16, tone: 'tint2' },
  { id: 'what-1', panel: 2, centerVw: 45, wVw: 16, hVh: 32, window: [...ASSEMBLY_WINDOWS[1]!] as [number, number], entrance: 'assemble', tilt: -0.13, tone: 'tint1' },
  { id: 'what-2', panel: 2, centerVw: 70, wVw: 16, hVh: 38, window: [...ASSEMBLY_WINDOWS[2]!] as [number, number], entrance: 'assemble', tilt: 0.11, tone: 'lime' },
  // 04 Who's on the podium — the podium grows out of the floor, 1st in lime.
  // 04 Your spot — a filling podium crowd, gently alive, one gap at 76vw
  // (the DOM draws the reserved slot there). Timed as fractions of the last
  // crossing (atSeg) so they all stand well before the rest that ends the page.
  { panel: 3, centerVw: 52, wVw: 6.5, hVh: 22, window: [atSeg(2, 0.51), atSeg(2, 0.7)], entrance: 'grow', tone: 'lime', bobPhase: 0 },
  { panel: 3, centerVw: 60, wVw: 6.5, hVh: 34, window: [atSeg(2, 0.57), atSeg(2, 0.76)], entrance: 'grow', tone: 'lime', bobPhase: 1.3 },
  { panel: 3, centerVw: 68, wVw: 6.5, hVh: 28, window: [atSeg(2, 0.63), atSeg(2, 0.81)], entrance: 'grow', tone: 'lime', bobPhase: 2.6 },
  { panel: 3, centerVw: 84, wVw: 6.5, hVh: 26, window: [atSeg(2, 0.6), atSeg(2, 0.79)], entrance: 'grow', tone: 'lime', bobPhase: 3.9 },
  { panel: 3, centerVw: 92, wVw: 6.5, hVh: 31, window: [atSeg(2, 0.65), atSeg(2, 0.84)], entrance: 'grow', tone: 'lime', bobPhase: 5.2 },
]

function easeOutCubic(u: number): number {
  return 1 - Math.pow(1 - u, 3)
}
function easeOutBack(u: number): number {
  const c1 = 1.70158
  return 1 + (c1 + 1) * Math.pow(u - 1, 3) + c1 * Math.pow(u - 1, 2)
}

// A progression toward the brand green, not a fade to white: without tone
// mapping the old pale tints rendered almost colourless. Each step still reads
// as the same plastic, just less concentrated.
const TONES = { lime: '#C1EC2F', tint1: '#CFEF6B', tint2: '#DCF29B' } as const

function SetPieces({ stage, vpW, vpH }: { stage: StageApi; vpW: number; vpH: number }) {
  const aspect = vpW / vpH
  const unitsPerVw = (10 * aspect) / 100
  const groups = useRef<(THREE.Group | null)[]>([])
  const lifts = useRef<number[]>(SET_PIECES.map(() => 0))

  const materials = useMemo(() => {
    const make = (hex: string) =>
      new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(hex),
        metalness: 0,
        roughness: 0.3,
        clearcoat: 1.0,
        clearcoatRoughness: 0.12,
        ior: 1.45,
        specularIntensity: 0.55,
      })
    return { lime: make(TONES.lime), tint1: make(TONES.tint1), tint2: make(TONES.tint2) }
  }, [])

  const built = useMemo(
    () =>
      SET_PIECES.map((sp) => {
        const w = sp.wVw * unitsPerVw
        const h = sp.hVh * 0.1
        return {
          sp,
          w,
          h,
          pivotX: (sp.panel * 100 + sp.centerVw - 50) * unitsPerVw + w / 2,
          geo: glyphGeometry(w, h),
        }
      }),
    [unitsPerVw]
  )
  useEffect(() => () => built.forEach((b) => b.geo.dispose()), [built])

  useFrame((state, delta) => {
    const p = stage.getP()
    const k = 1 - Math.exp(-Math.min(delta, 1 / 30) / 0.08)
    built.forEach((b, i) => {
      const g = groups.current[i]
      if (!g) return
      const [s, e] = b.sp.window
      const u = Math.min(Math.max((p - s) / (e - s), 0), 1)
      let drop = 0
      if (b.sp.entrance === 'assemble') {
        // Drops into its footprint with an overshoot, swinging level as it
        // lands: parts being fitted together, not furniture growing.
        const eased = easeOutBack(u)
        drop = (1 - eased) * 1.15
        g.rotation.z = (1 - eased) * (b.sp.tilt ?? 0.14)
        g.scale.setScalar(0.93 + 0.07 * Math.min(1, u * 1.6))
      } else {
        g.scale.y = Math.max(0.001, easeOutCubic(u))
      }
      const target = b.sp.id && panelHover.id === b.sp.id ? 0.22 : 0
      lifts.current[i] = lifts.current[i]! + (target - lifts.current[i]!) * k
      const bob =
        b.sp.bobPhase !== undefined && u >= 1
          ? 0.04 * (1 + Math.sin(state.clock.elapsedTime * 1.1 + b.sp.bobPhase))
          : 0
      g.position.y = lifts.current[i]! + bob + drop
    })
  })

  return (
    <>
      {built.map((b, i) => (
        <group key={i} ref={(el) => { groups.current[i] = el }} position={[b.pivotX, 0, 0]}>
          <mesh geometry={b.geo} material={materials[b.sp.tone]} position={[-b.w, 0, 0]} castShadow />
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
      <directionalLight position={[5, 3, 4]} intensity={0.5} />
      <HeroDominoes stage={stage} vpW={vpW} vpH={vpH} />
      <SetPieces stage={stage} vpW={vpW} vpH={vpH} />
      <FloorShadows stage={stage} vpW={vpW} vpH={vpH} />
    </>
  )
}

// The shadow catcher travels with the camera so every panel's furniture
// grounds on the floor line, not just the hero's.
function FloorShadows({ stage, vpW, vpH }: { stage: StageApi; vpW: number; vpH: number }) {
  const ref = useRef<THREE.Group>(null)
  const aspect = vpW / vpH
  const unitsPerVw = (10 * aspect) / 100
  const vhPerVw = vpH / vpW
  useFrame(() => {
    if (ref.current) ref.current.position.x = -trackXVw(stage.getP(), vhPerVw) * unitsPerVw
  })
  return (
    <group ref={ref}>
      <KeyLight />
      <ContactShadows position={[0, 0, 0]} opacity={0.3} blur={2.2} scale={24} resolution={512} frames={Infinity} />
    </group>
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
        // No tone mapping: ACES desaturates and lightens a saturated lime, so
        // the moulded bars drifted away from the brand green used by the
        // headline chip. Straight output keeps the two the same colour.
        gl={{ antialias: true, toneMapping: THREE.NoToneMapping }}
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
