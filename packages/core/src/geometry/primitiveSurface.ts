// Samples a Primitive3D's surface as 3D points, so silhouette.ts can project and hull them.
//
// Four of the five primitive types are expressed as one superellipsoid family (Barr's
// superquadrics — the standard published generalisation of the ellipsoid, public-domain maths):
//
//   x = (w/2)·C(u,e1)·C(v,e2)     C(θ,e) = sign(cos θ)·|cos θ|^e
//   y = (h/2)·S(u,e1)             S(θ,e) = sign(sin θ)·|sin θ|^e
//   z = (d/2)·C(u,e1)·S(v,e2)
//
// e1 shapes the vertical profile (1 = round like a sphere, →0 = flat-topped like a cylinder),
// e2 shapes the horizontal cross-section (1 = circular, →0 = square). That single formula covers
// sphere, rounded cube, cylinder and capsule just by picking the two exponents.
//
// `cone` can't join that family: every superquadric here is symmetric top-to-bottom (C is even,
// so the radius at u and -u always match), but a cone is a genuine base-to-tip taper — wide at one
// pole, narrow or pointed at the other. It gets its own profile below instead of an (e1, e2) pair.

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
  if (primitive.type === 'cone') return sampleConeSurface(primitive)

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

/**
 * A cone's radius profile — the piece that can't come from the shared superquadric exponents
 * (see the file banner). `t` runs base→tip as 0→1. Blends two curves that agree at both
 * endpoints (1 at `t=0`, 0 at `t=1`): the straight taper `1 - t` (a true cone), and the quarter
 * circle `sqrt(1 - t²)` — flat (zero-slope) at the base pole, vertical (a smooth dome, not a
 * corner) at the tip pole. The quarter circle sits at or above the straight line for every
 * `t ∈ [0,1]` (`sqrt(1-t²) ≥ 1-t` ⟺ `1+t ≥ 1-t` after squaring both nonnegative sides ⟺ `t ≥ 0`),
 * so *any* blend between them stays at or above the straight taper too — the profile can never
 * dip inside the cone's own silhouette, which is what convex-hull silhouetting needs: a dip would
 * just get chord-cut by the hull and vanish, no matter how deliberately it was authored.
 *
 * `tipRoundness`/`baseRoundness` (0..1, default 0) are each swept in as that end's blend weight
 * — the blend at a given `t` linearly interpolates the two roundness values themselves, so each
 * end is governed by its own value at that pole and by the other's only partway across. 0 stays on
 * the straight line at that end (sharp point / flat disc edge); 1 fully replaces it with the
 * quarter circle there. `morphRoundness` (shared with `cylinder`) pushes both ends' effective
 * roundness toward 1, melting the whole profile toward the fully-round limit — the quarter circle
 * end to end, which is a dome (a flat base rounding straight up into a point-free tip).
 */
const coneRadiusProfile = (primitive: Primitive3D, t: number): number => {
  const clamped = clamp01(t)
  const morph = clamp01(primitive.morphRoundness ?? 0)
  const baseRound = clamp01(primitive.baseRoundness ?? 0)
  const tipRound = clamp01(primitive.tipRoundness ?? 0)
  const effectiveBase = baseRound + (1 - baseRound) * morph
  const effectiveTip = tipRound + (1 - tipRound) * morph
  const blend = effectiveBase * (1 - clamped) + effectiveTip * clamped

  const straight = 1 - clamped
  const rounded = Math.sqrt(Math.max(0, 1 - clamped * clamped))
  return straight + (rounded - straight) * blend
}

/**
 * Cone sampling, separate from the shared loop above: `t` (base=0 → tip=1) drives radius via
 * `coneRadiusProfile` and height linearly, and the cross-section is a plain circle (no footprint
 * exponent — a cone doesn't get cube's squared-off turn-in-place treatment). Base sits at
 * `+height/2`, tip at `-height/2`, so with `+y down` (see `transform.ts`) the base is the bottom
 * and the tip the top — a cone-primitive head reads as a rounded party-hat, narrow end up.
 */
const sampleConeSurface = (primitive: Primitive3D): Vec3[] => {
  const a = primitive.width / 2
  const b = primitive.height / 2
  const c = primitive.depth / 2

  const points: Vec3[] = []
  for (let i = 0; i <= U_STEPS; i++) {
    const t = i / U_STEPS
    const y = b - 2 * b * t
    const radiusScale = coneRadiusProfile(primitive, t)
    if (radiusScale <= 0) {
      points.push([0, y, 0])
      continue
    }
    for (let j = 0; j < V_STEPS; j++) {
      const v = -Math.PI + (j / V_STEPS) * 2 * Math.PI
      points.push([a * radiusScale * Math.sin(v), y, c * radiusScale * Math.cos(v)])
    }
  }
  return points
}
