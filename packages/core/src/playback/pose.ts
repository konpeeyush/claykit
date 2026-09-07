// A Pose is the blend-able numeric snapshot behind a frame: everything render.ts needs to build
// an AvatarScene, but nothing baked into SVG yet. Kept separate from AvatarScene because you can
// linearly interpolate a Pose (for cross-fades) — you can't usefully interpolate two path strings.

import type { EulerDeg, EyeShape, Expression } from '../types.js'

export type Pose = {
  head: EulerDeg
  eyes: { left: EyeShape; right: EyeShape; spacing: number }
  perspective: number
  /** 1 = eyes fully open, 0 = fully closed. Separate from the expression so blinking can ride on top of any pose. */
  eyesOpen: number
  /** Resolved paint for this pose — the expression's own `colors` override, or the definition's base colors. */
  colors: { body: string; eyes: string }
}

export const poseFromExpression = (expression: Expression, fallbackColors: { body: string; eyes: string }): Pose => ({
  head: expression.head,
  eyes: expression.eyes,
  perspective: expression.perspective,
  eyesOpen: 1,
  colors: { body: expression.colors?.body ?? fallbackColors.body, eyes: expression.colors?.eyes ?? fallbackColors.eyes },
})

const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const lerpEuler = (a: EulerDeg, b: EulerDeg, t: number): EulerDeg => ({
  x: lerp(a.x, b.x, t),
  y: lerp(a.y, b.y, t),
  z: lerp(a.z, b.z, t),
})
const lerpEye = (a: EyeShape, b: EyeShape, t: number): EyeShape => ({
  width: lerp(a.width, b.width, t),
  height: lerp(a.height, b.height, t),
  x: lerp(a.x, b.x, t),
  y: lerp(a.y, b.y, t),
  angle: lerp(a.angle, b.angle, t),
})

const hexToRgb = (hex: string): [number, number, number] => {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
const toHex2 = (v: number) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')
const lerpColor = (a: string, b: string, t: number): string => {
  if (a === b) return a
  const [ar, ag, ab] = hexToRgb(a)
  const [br, bg, bb] = hexToRgb(b)
  return `#${toHex2(lerp(ar, br, t))}${toHex2(lerp(ag, bg, t))}${toHex2(lerp(ab, bb, t))}`
}

export const blendPose = (from: Pose, to: Pose, t: number): Pose => ({
  head: lerpEuler(from.head, to.head, t),
  eyes: {
    left: lerpEye(from.eyes.left, to.eyes.left, t),
    right: lerpEye(from.eyes.right, to.eyes.right, t),
    spacing: lerp(from.eyes.spacing, to.eyes.spacing, t),
  },
  perspective: lerp(from.perspective, to.perspective, t),
  eyesOpen: lerp(from.eyesOpen, to.eyesOpen, t),
  colors: { body: lerpColor(from.colors.body, to.colors.body, t), eyes: lerpColor(from.colors.eyes, to.colors.eyes, t) },
})
