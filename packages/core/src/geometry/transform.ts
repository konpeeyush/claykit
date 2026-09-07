// 3D transform + camera for the avatar's primitives.
//
// The avatar is a small assembly of convex volumes posed in 3D and viewed through a real
// perspective camera — NOT a flat 2D composition. The head pose ({x,y,z} degrees from the active
// expression) rotates the whole assembly, so a yaw genuinely swings the near ear toward the camera
// (bigger) and the far ear away (smaller, tucked behind the head).
//
// Axis conventions match the definition data and SVG: +x right, +y DOWN, +z toward the viewer.
// That's why ears authored at y = -72 sit at the top of the frame.

import type { EulerDeg, Vec3 } from '../types.js'

export type Mat3 = [number, number, number, number, number, number, number, number, number]

export const IDENTITY: Mat3 = [1, 0, 0, 0, 1, 0, 0, 0, 1]

export const multiply = (m1: Mat3, m2: Mat3): Mat3 => [
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

export const apply = (m: Mat3, v: Vec3): Vec3 => [
  m[0] * v[0] + m[1] * v[1] + m[2] * v[2],
  m[3] * v[0] + m[4] * v[1] + m[5] * v[2],
  m[6] * v[0] + m[7] * v[1] + m[8] * v[2],
]

/** Euler degrees (x=pitch, y=yaw, z=roll) to a rotation matrix, applied roll ∘ yaw ∘ pitch. */
export const rotationMatrix = (rotation: EulerDeg): Mat3 => {
  const { x, y, z } = rotation
  if (x === 0 && y === 0 && z === 0) return IDENTITY
  const rx = (x * Math.PI) / 180
  const ry = (y * Math.PI) / 180
  const rz = (z * Math.PI) / 180
  const cx = Math.cos(rx)
  const sx = Math.sin(rx)
  const cy = Math.cos(ry)
  const sy = Math.sin(ry)
  const cz = Math.cos(rz)
  const sz = Math.sin(rz)
  const pitch: Mat3 = [1, 0, 0, 0, cx, -sx, 0, sx, cx]
  // With +y pointing down the frame is left-handed, so yaw runs the opposite way to the textbook
  // y-up matrix: a positive `head.y` ("far-right-glance" is +35) has to swing the avatar's right
  // side away from the camera, bringing the viewer's-left ear forward and tucking the other one.
  const yaw: Mat3 = [cy, 0, sy, 0, 1, 0, -sy, 0, cy]
  const roll: Mat3 = [cz, -sz, 0, sz, cz, 0, 0, 0, 1]
  return multiply(roll, multiply(yaw, pitch))
}

export const vec3FromEuler = (e: EulerDeg): Vec3 => [e.x, e.y, e.z]

/**
 * Camera distance at perspective = 1, in the same units as the definition (the viewBox is
 * centred on the origin and Freddy's head is ~175 wide). Calibrated by measuring rendered
 * silhouettes: a volume's front surface should magnify only ~5%, which reads as depth without
 * the fish-eye bulge a closer camera gives — at half this distance a turned head visibly
 * over-skews. A pose's `perspective` scales the strength; 0 collapses to orthographic.
 */
const BASE_CAMERA_DISTANCE = 800

export type Projected = { x: number; y: number; scale: number }

export const projectPoint = (p: Vec3, perspective: number): Projected => {
  if (perspective <= 0) return { x: p[0], y: p[1], scale: 1 }
  const distance = BASE_CAMERA_DISTANCE / perspective
  // Clamp so a volume that pokes past the camera plane can't invert or blow up.
  const denom = Math.max(distance - p[2], distance * 0.25)
  const scale = distance / denom
  return { x: p[0] * scale, y: p[1] * scale, scale }
}
