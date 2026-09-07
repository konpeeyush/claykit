// Eyes are authored directly in 2D screen space (no 3D projection involved) as a plain ellipse:
// width/height/x/y/angle, offset left/right by half of the expression's `spacing`. Rendered as
// an exact two-arc SVG ellipse path rather than a sampled approximation.

import type { EyeShape } from '../types.js'

export const eyePath = (eye: EyeShape, sideOffsetX: number, openAmount: number): string => {
  const cx = eye.x + sideOffsetX
  const cy = eye.y
  const a = eye.width / 2
  // A closed eye is a flat line, not a zero-height ellipse (which degenerates to nothing) —
  // floor the open amount so blinking reads as a lid closing, not the eye vanishing.
  const b = Math.max((eye.height / 2) * openAmount, 0.6)
  const angleDeg = (eye.angle * 180) / Math.PI

  const cos = Math.cos(eye.angle)
  const sin = Math.sin(eye.angle)
  const left = { x: cx - a * cos, y: cy - a * sin }
  const right = { x: cx + a * cos, y: cy + a * sin }

  return (
    `M ${left.x.toFixed(2)} ${left.y.toFixed(2)} ` +
    `A ${a.toFixed(2)} ${b.toFixed(2)} ${angleDeg.toFixed(2)} 1 0 ${right.x.toFixed(2)} ${right.y.toFixed(2)} ` +
    `A ${a.toFixed(2)} ${b.toFixed(2)} ${angleDeg.toFixed(2)} 1 0 ${left.x.toFixed(2)} ${left.y.toFixed(2)} Z`
  )
}
