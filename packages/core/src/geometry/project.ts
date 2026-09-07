// Projects a Primitive3D (positioned/rotated in the avatar's local 3D space, then carried by
// the active expression's head pose) into a 2D superellipse Footprint.
//
// This is a weak-perspective / orthographic-with-depth-scale projection — the standard cheap
// approximation used across 2.5D UI and game rendering, not a full 3D camera pipeline. A
// primitive's screen-space half-extents come from projecting its three local half-axis vectors
// through the combined rotation and taking their largest screen-space reach on each axis; this
// approximates (rather than exactly reproduces) how an orthographically-viewed rounded box
// foreshortens when tilted — adequate for a stylized silhouette, not a physically exact shadow.

import type { Primitive3D, Vec3 } from '../types.js'
import type { Footprint } from './superellipse.js'

type Mat3 = [number, number, number, number, number, number, number, number, number]

const IDENTITY: Mat3 = [1, 0, 0, 0, 1, 0, 0, 0, 1]

const multiply = (m1: Mat3, m2: Mat3): Mat3 => [
  m1[0] * m2[0] + m1[1] * m2[3] + m1[2] * m2[6],
  m1[0] * m2[1] + m1[1] * m2[4] + m1[2] * m2[7],
  m1[0] * m2[2] + m1[1] * m2[5] + m1[2] * m2[8],
  m1[3] * m2[0] + m1[4] * m2[3] + m1[5] * m2[6],
  m1[3] * m2[1] + m1[4] * m2[4] + m1[5] * m2[7],
  m1[3] * m2[2] + m1[4] * m2[5] + m1[5] * m2[8],
  m1[6] * m2[0] + m1[7] * m2[3] + m1[8] * m2[6],
  m1[6] * m2[1] + m1[7] * m2[4] + m1[8] * m2[7],
  m1[6] * m2[2] + m1[7] * m2[5] + m1[8] * m2[8],
]

const apply = (m: Mat3, v: Vec3): Vec3 => [
  m[0] * v[0] + m[1] * v[1] + m[2] * v[2],
  m[3] * v[0] + m[4] * v[1] + m[5] * v[2],
  m[6] * v[0] + m[7] * v[1] + m[8] * v[2],
]

const eulerToMatrix = ([xDeg, yDeg, zDeg]: Vec3): Mat3 => {
  if (xDeg === 0 && yDeg === 0 && zDeg === 0) return IDENTITY
  const x = (xDeg * Math.PI) / 180
  const y = (yDeg * Math.PI) / 180
  const z = (zDeg * Math.PI) / 180
  const cx = Math.cos(x)
  const sx = Math.sin(x)
  const cy = Math.cos(y)
  const sy = Math.sin(y)
  const cz = Math.cos(z)
  const sz = Math.sin(z)
  const rx: Mat3 = [1, 0, 0, 0, cx, -sx, 0, sx, cx]
  const ry: Mat3 = [cy, 0, sy, 0, 1, 0, -sy, 0, cy]
  const rz: Mat3 = [cz, -sz, 0, sz, cz, 0, 0, 0, 1]
  return multiply(rz, multiply(ry, rx))
}

export type ProjectOptions = {
  /** Weak-perspective strength for this pose — 0 disables depth-based scale entirely. */
  perspective: number
  /** Scales the whole scene into the target viewBox units (see render.ts). */
  viewScale: number
  /** How strongly depth (z) affects apparent scale; tuned for this project's unit scale. */
  depthFactor?: number
}

export const projectPrimitive = (
  surface: Primitive3D,
  position: Vec3,
  localRotation: Vec3,
  headPose: Vec3,
  { perspective, viewScale, depthFactor = 0.004 }: ProjectOptions,
): Footprint => {
  const headRotation = eulerToMatrix(headPose)
  const localRotationMatrix = eulerToMatrix(localRotation)
  const combined = multiply(headRotation, localRotationMatrix)

  const worldPos = apply(headRotation, position)
  const depthScale = 1 / (1 + worldPos[2] * perspective * depthFactor)
  const scale = viewScale * depthScale

  const axisX = apply(combined, [surface.width / 2, 0, 0])
  const axisY = apply(combined, [0, surface.height / 2, 0])
  const axisZ = apply(combined, [0, 0, surface.depth / 2])

  const halfWidth = Math.max(Math.abs(axisX[0]), Math.abs(axisY[0]), Math.abs(axisZ[0])) * scale
  const halfHeight = Math.max(Math.abs(axisX[1]), Math.abs(axisY[1]), Math.abs(axisZ[1])) * scale
  const angle = Math.atan2(axisX[1], axisX[0])

  return {
    cx: worldPos[0] * scale,
    cy: worldPos[1] * scale,
    a: Math.max(halfWidth, 1),
    b: Math.max(halfHeight, 1),
    roundness: surface.roundness,
    angle,
  }
}
