'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { ContactShadows } from '@react-three/drei'
import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js'
import { useStage, type StageApi } from './stage'

// ————————————————————————————————————————————————————————————————————————
// The 3D stage (build spec v3 §2.6): one transparent canvas behind the DOM.
// World convention: 1 unit = 10vh; floor y=0 projects to screen 72vh; the
// camera x-couples 1:1 with the track so pieces are passed by like DOM panels.
// ————————————————————————————————————————————————————————————————————————

// Hero domino plan (spec §3 P01): centers/widths in vw, heights in vh.
const PIECES = [
  { centerVw: 54, wVw: 6, hVh: 20 },
  { centerVw: 67, wVw: 6.5, hVh: 29 },
  { centerVw: 81.5, wVw: 7, hVh: 40 },
] as const

// Cascade curves (spec §4.3) — inline until lib/landing/motion-map.ts lands.
const WINDOWS: [number, number, number, number][] = [
  // [start, end, thetaMaxDeg, k]
  [0.0, 0.06, 96, 1.8],
  [0.035, 0.105, 94, 1.7],
  [0.07, 0.15, 90, 1.5],
]
function cascadeTheta(p: number, i: 0 | 1 | 2): number {
  const [s, e, max, k] = WINDOWS[i]!
  const u = Math.min(Math.max((p - s) / (e - s), 0), 1)
  return max * Math.pow(u, k)
}

// Track x in vw for camera coupling — placeholder mirror of stage's map.
const SEGMENTS: [number, number, number, number][] = [
  [0.145, 0.225, 0, -100],
  [0.32, 0.38, -100, -200],
  [0.47, 0.53, -200, -300],
  [0.65, 0.71, -300, -400],
]
function trackXVw(p: number): number {
  let x = 0
  for (const [s, e, from, to] of SEGMENTS) {
    if (p >= e) x = to
    else if (p > s) {
      const u = (p - s) / (e - s)
      x = from + (to - from) * (u * u * (3 - 2 * u))
    }
  }
  return x
}

// Injection-moulded lime plastic (spec §2.6). One material, shared.
function useLimePlastic(): THREE.MeshPhysicalMaterial {
  return useMemo(() => {
    const m = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#C1EC2F'),
      roughness: 0.32,
      metalness: 0,
      clearcoat: 1.0,
      clearcoatRoughness: 0.12,
      ior: 1.45,
      specularIntensity: 0.9,
    })
    return m
  }, [])
}

// Podium-glyph cross-section: big top-left radius (60% of width), 12% others,
// extruded to 0.55 × width with a 3%-width fillet so the clearcoat draws a
// highlight line along every edge.
function glyphGeometry(w: number, h: number): THREE.ExtrudeGeometry {
  const rMaj = w * 0.6
  const rMin = w * 0.12
  const fillet = w * 0.03
  const shape = new THREE.Shape()
  // Path drawn CCW starting after the bottom-left corner arc, in XY plane.
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
  // Center on z so the piece sits symmetric around the ground line's plane.
  geo.translate(0, 0, -depth / 2)
  return geo
}

function HeroDominoes({ stage, vpW, vpH }: { stage: StageApi; vpW: number; vpH: number }) {
  const material = useLimePlastic()
  const groups = useRef<(THREE.Group | null)[]>([])
  const pRef = useRef(0)
  const loadT = useRef<number | null>(null)
  const { invalidate } = useThree()

  useEffect(() => stage.subscribe(() => invalidate()), [stage, invalidate])

  const aspect = vpW / vpH
  const unitsPerVw = (10 * aspect) / 100
  const unitsPerVh = 0.1

  const pieces = useMemo(
    () =>
      PIECES.map((p) => ({
        w: p.wVw * unitsPerVw,
        h: p.hVh * unitsPerVh,
        // pivot at the piece's bottom-RIGHT ground edge (fall axis)
        pivotX: (p.centerVw - 50) * unitsPerVw + (p.wVw * unitsPerVw) / 2,
      })),
    [unitsPerVw, unitsPerVh]
  )

  const geometries = useMemo(
    () => pieces.map((p) => glyphGeometry(p.w, p.h)),
    [pieces]
  )
  useEffect(() => () => geometries.forEach((g) => g.dispose()), [geometries])

  useFrame((state) => {
    const p = stage.getP()
    pRef.current = p
    // Load un-fall (spec §4.1): pieces rotate from fallen to standing unless
    // the visitor already scrolled (fast-forward rule).
    if (loadT.current === null) loadT.current = state.clock.elapsedTime
    const sinceLoad = state.clock.elapsedTime - (loadT.current ?? 0)
    groups.current.forEach((g, i) => {
      if (!g) return
      const scrub = cascadeTheta(p, i as 0 | 1 | 2)
      let theta = scrub
      if (p < 0.001) {
        const delay = 0.6 + i * 0.12
        const t = Math.min(Math.max((sinceLoad - delay) / 0.9, 0), 1)
        const settle = 1 - Math.pow(1 - t, 3)
        const from = [96, 94, 90][i]!
        theta = Math.max(from * (1 - settle), scrub)
        if (t < 1) invalidate()
      }
      g.rotation.z = -THREE.MathUtils.degToRad(theta)
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
  const { camera, invalidate } = useThree()
  const aspect = vpW / vpH
  const unitsPerVw = (10 * aspect) / 100

  useEffect(() => stage.subscribe(() => invalidate()), [stage, invalidate])

  useFrame(() => {
    const p = stage.getP()
    // Screen center is 50vh; floor (y=0) must project to 72vh → camera looks
    // straight ahead from y = 2.2 units. fov 28 → distance so 10 units fill 100vh.
    const dist = 5 / Math.tan(THREE.MathUtils.degToRad(14))
    camera.position.set(-trackXVw(p) * unitsPerVw, 2.2, dist)
    camera.lookAt(-trackXVw(p) * unitsPerVw, 2.2, 0)
  })
  return null
}

function KeyLight() {
  const ref = useRef<THREE.RectAreaLight>(null)
  useEffect(() => {
    ref.current?.lookAt(0, 1, 0)
  }, [])
  return <rectAreaLight ref={ref} position={[-6, 7, 6]} width={4} height={4} intensity={3.2} />
}

function SceneInner({ stage, vpW, vpH }: { stage: StageApi; vpW: number; vpH: number }) {
  const { gl, scene } = useThree()
  // Neutral procedural studio environment — no network fetch (CSP-safe).
  useEffect(() => {
    RectAreaLightUniformsLib.init()
    const pmrem = new THREE.PMREMGenerator(gl)
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
    scene.environment = env
    scene.environmentIntensity = 0.9
    return () => {
      pmrem.dispose()
      env.dispose()
    }
  }, [gl, scene])

  return (
    <>
      <Rig stage={stage} vpW={vpW} vpH={vpH} />
      <KeyLight />
      <directionalLight position={[5, 3, 4]} intensity={0.6} />
      <HeroDominoes stage={stage} vpW={vpW} vpH={vpH} />
      <ContactShadows
        position={[0, 0, 0]}
        opacity={0.24}
        blur={2.4}
        scale={20}
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
  if (!vp) return null
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-0">
      <Canvas
        frameloop="always"
        dpr={[1, 1.75]}
        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.0 }}
        camera={{ fov: 28, near: 0.1, far: 100 }}
      >
        <SceneInner stage={stage} vpW={vp.w} vpH={vp.h} />
      </Canvas>
    </div>
  )
}
