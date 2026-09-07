// Scalar field for a rounded rectangle/ellipse footprint (a "superellipse", |x/a|^n+|y/b|^n=1 —
// Lamé, 1818, public domain). Negative inside, 0 on the boundary, roughly-linear-in-distance
// outside — good enough for smoothUnion's blending without needing a true Euclidean SDF.
//
// `roundness` 0..1 maps to the exponent n: 0 -> sharp corners (n large), 1 -> a plain ellipse (n=2).
// This mapping (not the superellipse formula itself) is this project's own tuning choice.

export type Footprint = {
  cx: number
  cy: number
  /** Half-extents, already in projected 2D units. */
  a: number
  b: number
  roundness: number
  /** In-plane rotation, radians. */
  angle: number
}

const ROUNDNESS_TO_EXPONENT = (roundness: number): number => {
  const clamped = Math.max(0, Math.min(1, roundness))
  // n=2 at roundness=1 (ellipse), n=8 at roundness=0 (near-rectangle) — chosen empirically
  // for a pleasant "rounded box" look rather than a harsh right angle.
  return 2 + (1 - clamped) * 6
}

/** Sample points around a single footprint's own boundary — for rendering it standalone (no blending), e.g. accent-colored nodes. */
export const superellipseBoundaryPoints = (footprint: Footprint, segments = 48): { x: number; y: number }[] => {
  const { cx, cy, a, b, roundness, angle } = footprint
  const n = ROUNDNESS_TO_EXPONENT(roundness)
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  const points: { x: number; y: number }[] = []
  for (let i = 0; i < segments; i++) {
    const t = (i / segments) * Math.PI * 2
    const ct = Math.cos(t)
    const st = Math.sin(t)
    const lx = Math.sign(ct) * Math.pow(Math.abs(ct), 2 / n) * a
    const ly = Math.sign(st) * Math.pow(Math.abs(st), 2 / n) * b
    points.push({ x: cx + lx * cos - ly * sin, y: cy + lx * sin + ly * cos })
  }
  return points
}

/** Signed field value at (x, y): negative inside the footprint, 0 on its boundary. */
export const superellipseField = (footprint: Footprint, x: number, y: number): number => {
  const { cx, cy, a, b, roundness, angle } = footprint
  const dx = x - cx
  const dy = y - cy
  const cos = Math.cos(-angle)
  const sin = Math.sin(-angle)
  const rx = dx * cos - dy * sin
  const ry = dx * sin + dy * cos
  const n = ROUNDNESS_TO_EXPONENT(roundness)
  const norm = Math.pow(Math.pow(Math.abs(rx) / a, n) + Math.pow(Math.abs(ry) / b, n), 1 / n)
  return (norm - 1) * Math.min(a, b)
}
