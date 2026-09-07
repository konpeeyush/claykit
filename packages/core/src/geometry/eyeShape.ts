// Eyes, built as capsules anchored on the head's 3D front face.
//
// Two things here are easy to get wrong and both matter a lot to how alive the avatar looks:
//
// 1. `EyeShape.angle` is in DEGREES, not radians (the data's angry brows sit at -36.2 / +27.7).
// 2. An eye is not a flat overlay — it lives on the head's front face in 3D, so it travels,
//    foreshortens and rolls with the head pose. Under a yaw the pair slides across the face and
//    their spacing compresses; a flat 2D overlay reads as dead by comparison.
//
// So the outline is generated in the eye's own local 2D frame, rotated by `angle`, lifted onto the
// face plane, then pushed through the same head rotation + perspective camera as every volume.

import type { EulerDeg, EyeShape, Vec3 } from '../types.js'
import { closedPath, type Point } from './convexHull.js'
import { apply, projectPoint, rotationMatrix } from './transform.js'

const CAP_STEPS = 10
const SIDE_STEPS = 6

/**
 * Stadium/capsule outline centred on the origin: straight sides along the longer axis, fully
 * round caps. The reference eyes are pills, not ellipses — an ellipse reads noticeably pointier
 * at the ends, especially on the wide "sleepy-squint"-style shapes.
 *
 * The straight sides are subdivided too, not just the caps. Every point here gets individually
 * lifted onto the face and projected, so a side carried by its endpoints alone would render as a
 * straight screen-space chord and visibly detach from the curved head at oblique angles.
 */
const capsuleOutline = (width: number, height: number): Point[] => {
  const w = Math.max(width, 0.1)
  const h = Math.max(height, 0.1)
  const r = Math.min(w, h) / 2
  const points: Point[] = []
  const vertical = h >= w
  const straight = (vertical ? h : w) / 2 - r

  const cap = (sign: number) => {
    for (let i = 0; i <= CAP_STEPS; i++) {
      const t = (i / CAP_STEPS) * Math.PI
      const along = sign * (straight + r * Math.sin(t))
      const across = sign * r * Math.cos(t)
      points.push(vertical ? { x: across, y: -along } : { x: along, y: across })
    }
  }
  const side = (from: number, to: number, across: number) => {
    for (let i = 1; i < SIDE_STEPS; i++) {
      const along = from + ((to - from) * i) / SIDE_STEPS
      points.push(vertical ? { x: across, y: -along } : { x: along, y: across })
    }
  }

  // Cap, down one straight side, opposite cap, back up the other side.
  cap(1)
  side(straight, -straight, -r)
  cap(-1)
  side(-straight, straight, r)
  return points
}

export type EyeRenderOptions = {
  eye: EyeShape
  /** Signed half of the expression's `spacing` — negative for the left eye. */
  sideOffsetX: number
  /** 1 = open, 0 = shut. Scales height only, so a blink reads as a lid closing. */
  openAmount: number
  headPose: EulerDeg
  perspective: number
  /** Half the primary volume's depth: the face plane the eyes are painted on. */
  faceZ: number
}

export const eyePath = ({ eye, sideOffsetX, openAmount, headPose, perspective, faceZ }: EyeRenderOptions): string => {
  const headRotation = rotationMatrix(headPose)
  const angle = (eye.angle * Math.PI) / 180
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)

  // Never let a blink collapse the eye to nothing. A shut eye that reaches zero height reads as
  // the eye vanishing off the face; holding it at a fraction of its open height reads as a lid
  // coming down, which is what a blink is supposed to look like.
  const height = Math.max(eye.height * openAmount, eye.height * 0.11, 2)
  const centre: Vec3 = [eye.x + sideOffsetX, eye.y, faceZ]

  const projected: Point[] = capsuleOutline(eye.width, height).map(p => {
    const local: Vec3 = [
      centre[0] + p.x * cos - p.y * sin,
      centre[1] + p.x * sin + p.y * cos,
      centre[2],
    ]
    const posed = apply(headRotation, local)
    const { x, y } = projectPoint(posed, perspective)
    return { x, y }
  })

  return closedPath(projected)
}
