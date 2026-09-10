# Avatar definition — data model & rendering approach

## Why this document exists

This is the specification `@claykit/core` implements: the avatar definition format,
and the rendering and playback model built on it. It's the source of truth — the code
was written from this document, and anyone extending the engine should work from it.

## Top-level shape

```ts
type AvatarDefinition = {
  schema: 'claykit/avatar-definition'
  schemaVersion: 1
  name: string
  body: {
    primary: Primitive3D
    nodes: Array<{ surface: Primitive3D; position: Vec3; rotation: Vec3 }>
  }
  colors: { body: string; eyes: string }        // exactly these two hex colors — additionalProperties: false
  expressions: Record<string, Expression>
  expressionOrder: string[]
  animations: Record<string, Animation>
  animationOrder: string[]
}

type Vec3 = [number, number, number]

type Primitive3D = {
  type: 'cube' | 'sphere' | 'cylinder' | 'capsule' | 'cone'
  width: number
  height: number
  depth: number
  roundness: number          // 0 = sharp, 1 = fully rounded — unused by `cone`, see below
  morphRoundness?: number    // cylinder/cone: blends the whole profile toward a symmetric dome
  tipRoundness?: number      // cone only, 0..1: 0 a sharp point, 1 a domed cap
  baseRoundness?: number     // cone only, 0..1: 0 a flat disc edge, 1 a cylinder-like shoulder
}

type Expression = {
  head: Vec3                                     // pose offset, x/y/z
  eyes: {
    left: EyeShape
    right: EyeShape
    spacing: number
  }
  perspective: number                            // weak-perspective strength, see "Projection" below
  motion: { eyes: MotionKind; body: MotionKind }
}

type EyeShape = { width: number; height: number; x: number; y: number; angle: number }

type MotionKind = 'none' | 'shake' | 'slowDrift'

type Animation = {
  playbackMode: 'loop' | 'once'
  steps: Array<{
    expression: string
    holdMs: number
    transitionMs: number
    transition: 'smooth' | 'spring' | 'snappy'
  }>
  blink: { enabled: boolean; initialDelayMs: number; minIntervalMs: number; maxIntervalMs: number; durationMs: number }
  metadata: { label: string; description: string; group: string }
}
```

This is validated with our own [ajv](https://ajv.js.org/)-based JSON Schema
(`packages/core/src/schema.ts`), written independently from this spec.

## Rendering approach

The pipeline turns a definition into a good-looking, smoothly-animatable SVG frame
using standard, publicly documented computer graphics techniques.

**The avatar is a genuine 3D assembly, not a flat composition.** Every primitive is
posed in 3D and drawn as its own shape; the head pose really rotates the assembly, so
a yaw swings the near ear toward the camera and tucks the far one behind the head.

1. **Surface sampling** — `cube`/`sphere`/`cylinder`/`capsule` are each one member of the
   [superquadric](https://en.wikipedia.org/wiki/Superquadrics) family (Barr's standard
   generalisation of the ellipsoid), sampled as a 3D point cloud. Two exponents pick
   the shape: `e1` shapes the vertical profile, `e2` the horizontal cross-section, so
   sphere / rounded cube / cylinder / capsule all fall out of one formula. `cone` is a
   genuine base-to-tip taper — asymmetric, so it can't join that family — and gets its
   own profile instead: a blend between the straight taper `1 - t` and the quarter
   circle `sqrt(1 - t²)` (which sits at or above the straight line for every `t`, so
   the blend can never dip inside the cone's own silhouette), swept by `tipRoundness`
   and `baseRoundness` independently at each end and pushed toward the fully-round
   limit by `morphRoundness`.
2. **Transform** — each primitive is oriented by its own `rotation`, placed at its
   `position`, then the whole assembly is rotated by the expression's `head` pose
   (Euler degrees; +y is down, matching SVG, so ears authored at y = -72 sit at top).
3. **Perspective projection** — a real pinhole divide (`scale = D / (D - z)`), with the
   pose's `perspective` scaling the camera distance; 0 collapses to orthographic.
4. **Silhouette by convex hull** — every primitive is convex, and the silhouette of a
   convex body under projection is exactly the convex hull of its projected surface
   points. So each primitive's outline is a monotone-chain hull of its projected
   cloud, emitted as a closed path smoothed with quadratic-through-midpoint segments
   (which, unlike Catmull-Rom, can't overshoot the hull and bulge a flat edge).
5. **Layering** — nodes are split into "behind the head" and "in front of it" by their
   **authored z**, never by a per-frame depth sort. A per-frame sort would let a node
   pop through the head mid-rotation; authored z is stable through a whole turn.
6. **Eyes** — capsule (stadium) outlines, generated in the eye's own 2D frame, rotated
   by `angle` (**degrees**), lifted onto the head's front face in 3D, then pushed
   through the same rotation and camera as every volume — so they travel, foreshorten
   and roll with the head. The whole outline is tessellated, straight sides included:
   carrying a side by its endpoints alone leaves a straight screen-space chord that
   visibly detaches from the curved head at oblique angles. Blinking scales height and
   holds a floor, because an eye that reaches zero height reads as vanishing rather
   than as a lid closing.

Two constants in this pipeline (the camera distance, and the roundness→exponent
mappings) are **calibrated against measured silhouettes**, not derived — see the
calibration note in `CLAUDE.md`.

## Playback model

- `createAvatarPlaybackState()` — idle state, `neutral`-equivalent pose (first entry
  of `expressionOrder` if there's no literal `"neutral"` key).
- `playAvatarAnimation(definition, name, now, from)` — starts stepping through an
  animation's `steps`, cross-fading `from` the current sampled pose into the first
  step over its `transitionMs`, using the step's `transition` as an easing curve
  (`smooth` = ease-in-out cubic, `spring` = damped-spring impulse response, `snappy`
  = ease-out expo — again, generic named easing curves used across most animation
  libraries, not unique vocabulary).
- `resolveExpression(definition, name)` — cross-fades directly to a held expression
  (no timeline), used for the `expression` prop.
- `advanceAvatarPlayback(definition, state, now, env)` — ticks blinking (per the
  active animation's `blink` config, or a sensible default when driven by a bare
  expression) and ambient `motion` (`shake` / `slowDrift` on `eyes` and/or `body`, per
  the active expression) — this is what keeps things alive between explicit
  animation/expression changes, matching `AvatarCanvas`'s "rAF loop runs continuously
  ... so ambient motion and blinking keep ticking" behavior in the existing demo app.
- `sampleAvatarFrame` / `renderAvatarFrame` — pure functions from `(definition,
  state, now, env)` to a `AvatarScene` (paths + colors + eye visibility), consumed
  identically by `@claykit/react`.

`env: { random, reduceMotion }` is passed in by the caller (mirrors the existing
`AvatarCanvas.tsx` `environment()` helper) so the engine stays deterministic and
testable — no hidden global RNG or `window` access inside `@claykit/core`.
