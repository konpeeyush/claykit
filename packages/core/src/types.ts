// Public data model for an avatar definition and the runtime values derived from it.
// Mirrors docs/spec/avatar-definition.md exactly — that spec is the source of truth,
// this is its TypeScript projection.

export type Vec3 = [number, number, number]

export type PrimitiveType = 'cube' | 'sphere' | 'cylinder' | 'capsule' | 'cone'

export type Primitive3D = {
  type: PrimitiveType
  width: number
  height: number
  depth: number
  /** Unused by `cone`, which has no single corner to round — see tipRoundness/baseRoundness. */
  roundness: number
  /** Cylinder and cone only: blends the whole profile toward a symmetric dome (sphere-like). */
  morphRoundness?: number
  /** Cone only, 0..1: rounds the narrow end — 0 a sharp point, 1 a domed cap. */
  tipRoundness?: number
  /** Cone only, 0..1: rounds the wide end's rim — 0 a flat disc edge, 1 a cylinder-like shoulder. */
  baseRoundness?: number
}

export type BodyNode = {
  surface: Primitive3D
  position: Vec3
  rotation: Vec3
}

export type EyeShape = {
  width: number
  height: number
  x: number
  y: number
  angle: number
}

export type MotionKind = 'none' | 'shake' | 'slowDrift'

/** Head pose offset/rotation in degrees — an {x,y,z} object in the data, unlike position/rotation's tuple form. */
export type EulerDeg = { x: number; y: number; z: number }

export type Expression = {
  head: EulerDeg
  eyes: {
    left: EyeShape
    right: EyeShape
    spacing: number
  }
  perspective: number
  motion: {
    eyes: MotionKind
    body: MotionKind
  }
  /** Optional, partial per-expression color override (e.g. flashing red for "angry-brows") — any field left out falls back to the definition's base colors. */
  colors?: {
    body?: string
    eyes?: string
  }
}

export type TransitionCurve = 'smooth' | 'spring' | 'snappy'

export type AnimationStep = {
  expression: string
  holdMs: number
  transitionMs: number
  transition: TransitionCurve
}

export type BlinkConfig = {
  enabled: boolean
  initialDelayMs: number
  minIntervalMs: number
  maxIntervalMs: number
  durationMs: number
}

export type Animation = {
  playbackMode: 'loop' | 'once'
  steps: AnimationStep[]
  blink: BlinkConfig
  metadata: {
    label: string
    description: string
    group: string
  }
}

export type AvatarDefinition = {
  schema: 'claykit/avatar-definition'
  schemaVersion: 1
  name: string
  body: {
    primary: Primitive3D
    nodes: BodyNode[]
  }
  colors: {
    body: string
    eyes: string
  }
  expressions: Record<string, Expression>
  expressionOrder: string[]
  animations: Record<string, Animation>
  animationOrder: string[]
}

/** Caller-supplied effects the engine must not reach for on its own — keeps it pure/testable. */
export type AvatarRuntimeEnvironment = {
  random: () => number
  reduceMotion: boolean
}

/** One rendered frame: path data + paint, ready for any renderer to draw as-is. */
export type AvatarScene = {
  geometry: {
    headPath: string
    leftPath: string
    rightPath: string
    leftVisible: boolean
    rightVisible: boolean
    /** Per-node silhouette paths, in authored `body.nodes` order, for accent-color painting. */
    nodePaths: string[]
    /**
     * Node indices to draw before the head, and after it. Derived from each node's authored z, not
     * from a per-frame depth sort — so a node stays on its side of the head through a whole head
     * turn instead of popping through it mid-rotation.
     */
    behind: number[]
    front: number[]
  }
  colors: {
    body: string
    eyes: string
  }
}
