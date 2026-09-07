// Samples a Primitive3D's surface as 3D points, so silhouette.ts can project and hull them.
//
// All four primitive types are expressed as one superellipsoid family (Barr's superquadrics — the
// standard published generalisation of the ellipsoid, public-domain maths):
//
//   x = (w/2)·C(u,e1)·C(v,e2)     C(θ,e) = sign(cos θ)·|cos θ|^e
//   y = (h/2)·S(u,e1)             S(θ,e) = sign(sin θ)·|sin θ|^e
//   z = (d/2)·C(u,e1)·S(v,e2)
//
// e1 shapes the vertical profile (1 = round like a sphere, →0 = flat-topped like a cylinder),
// e2 shapes the horizontal cross-section (1 = circular, →0 = square). That single formula covers
// sphere, rounded cube, cylinder and capsule just by picking the two exponents.

import type { Primitive3D, Vec3 } from '../types.js'

const C = (t: number, e: number): number => {
  const c = Math.cos(t)
  return Math.sign(c) * Math.pow(Math.abs(c), e)
}
const S = (t: number, e: number): number => {
  const s = Math.sin(t)
  return Math.sign(s) * Math.pow(Math.abs(s), e)
}

/**
 * `roundness` 0..1 to a superquadric exponent. Tuned against the reference look rather than
 * derived: a definition's 0.76-roundness "cube" should read as a chunky rounded box, not a
 * near-sphere, so the usable range tops out well below 1.
 */
const clamp01 = (v: number) => Math.max(0, Math.min(1, v))

/**
 * The two exponents are tuned separately because they control visually independent things, and a
 * single value can't satisfy both:
 *
 * - `e1` shapes the front-on XY outline — the rounded-square corners you actually look at. Too
 *   low and the head reads as a hard box.
 * - `e2` shapes the XZ footprint seen from above — how much extra width the head presents as it
 *   turns. Too high (too round a footprint) and a head turn barely changes the silhouette, which
 *   is what makes an avatar feel stiff and under-animated.
 *
 * So: generous corners, squarer footprint. Both calibrated against measured silhouettes.
 */
const profileExponent = (roundness: number): number => 0.15 + clamp01(roundness) * 0.55
const footprintExponent = (roundness: number): number => 0.08 + clamp01(roundness) * 0.33

const exponentsFor = (primitive: Primitive3D): { e1: number; e2: number } => {
  switch (primitive.type) {
    case 'sphere':
      return { e1: 1, e2: 1 }
    case 'capsule':
      // Round in every direction; the elongation comes from width/height/depth, not the exponent.
      return { e1: 1, e2: 1 }
    case 'cylinder':
      // Circular cross-section, extruded along y — `morphRoundness` softens the cap edge.
      return { e1: profileExponent(primitive.morphRoundness ?? primitive.roundness), e2: 1 }
    case 'cube':
    default:
      return { e1: profileExponent(primitive.roundness), e2: footprintExponent(primitive.roundness) }
  }
}

const U_STEPS = 15
const V_STEPS = 28

/** Surface point cloud in the primitive's own local space, centred on its origin. */
export const samplePrimitiveSurface = (primitive: Primitive3D): Vec3[] => {
  const { e1, e2 } = exponentsFor(primitive)
  const a = primitive.width / 2
  const b = primitive.height / 2
  const c = primitive.depth / 2

  const points: Vec3[] = []
  for (let i = 0; i <= U_STEPS; i++) {
    const u = -Math.PI / 2 + (i / U_STEPS) * Math.PI
    const cu = C(u, e1)
    const su = S(u, e1)
    // Poles collapse to a single point — emit one rather than V_STEPS duplicates.
    if (i === 0 || i === U_STEPS) {
      points.push([0, b * su, 0])
      continue
    }
    for (let j = 0; j < V_STEPS; j++) {
      const v = -Math.PI + (j / V_STEPS) * 2 * Math.PI
      points.push([a * cu * C(v, e2), b * su, c * cu * S(v, e2)])
    }
  }
  return points
}
