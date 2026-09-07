# Avatar definition — data model & rendering approach

## Why this document exists

claykit replaces `@bible-strong/avatar-core` / `@bible-strong/avatar-react` (AGPL-3.0-only)
in production. AGPL's copyleft means we cannot start from, translate, or adapt that
project's source and relicense it permissively — so everything under `packages/` here
is written from scratch against the plain-English spec below, not against
`bible-strong-avatar-lab`'s code. This file, and `provenance.md` next to it, are the
paper trail for that: what we knew going in, and how it was derived.

**Rule for anyone (human or agent) implementing against this spec:** don't open
`bible-strong-avatar-lab`'s GitHub repo or read the unminified source of
`@bible-strong/avatar-core` / `@bible-strong/avatar-react`. Everything needed is here.

## Where this data model came from

Two existing `*.avatar.json` files (`freddy.avatar.json`, `ribbit.avatar.json`, both
original creative work by this project's author) were inspected structurally — field
names, nesting, and the *set of values actually used* — to determine the functional
shape a definition needs. A JSON shape describing "a rounded 3D primitive with a
width/height/depth/roundness" or "an animation is a list of steps with a hold and
transition duration" is a functional necessity of the problem (there's only one
reasonable way to say that), not a creative expression — so reproducing that shape
exactly (so the two existing files keep validating unchanged) is not a copyleft
concern. The one literal identifier that *did* need to change is the self-describing
`schema` tag, which named the other project by name — see below.

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
  type: 'cube' | 'sphere' | 'cylinder' | 'capsule'
  width: number
  height: number
  depth: number
  roundness: number          // 0 = sharp, 1 = fully rounded
  morphRoundness?: number    // cylinder only: blends the cap independently of the radial roundness
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

## Rendering approach (original design — not a reverse-engineering of the original renderer)

We do not know, and did not try to find out, how `avatar-core` actually turns this
JSON into pixels. The pipeline below is designed from scratch to consume the same
JSON shape and produce a good-looking, smoothly-animatable result — using only
standard, publicly documented computer graphics techniques:

1. **Primitive footprint** — each `Primitive3D` becomes a 2D
   [superellipse](https://en.wikipedia.org/wiki/Superellipse) footprint:
   `|x/a|^n + |y/b|^n = 1`, where `n` is derived from `roundness` (0 → large `n`,
   sharp corners; 1 → `n = 2`, a plain ellipse). Superellipses are 19th-century public
   domain math (Gabriel Lamé), not anything specific to any avatar library.
2. **Projection** — each node's 3D `position`/`rotation` is projected to 2D with a
   simple weak-perspective scale (`scale = 1 / (1 + z * perspective * k)`), the
   standard cheap approximation used across 2.5D UI/game rendering — not a full 3D
   camera. `perspective` from the active expression controls how strong that
   depth-scale effect is.
3. **Smooth union** — the primary volume's footprint and every node's footprint are
   combined with a polynomial smooth-minimum (a well-known, widely published SDF
   blending technique — see Inigo Quilez's `smin` articles), so attached parts (ears,
   snout, ...) fuse into the silhouette instead of just overlapping.
4. **Silhouette extraction** — the blended field is sampled on a grid and traced with
   [marching squares](https://en.wikipedia.org/wiki/Marching_squares) (textbook
   computational geometry) into a polyline, then smoothed into a Catmull-Rom-derived
   SVG path — this becomes `scene.geometry.headPath`.
5. **Eyes** — rendered independently as two superellipse shapes straight from the
   active expression's `eyes.left` / `eyes.right`, clipped to the head silhouette.
   Blinking scales `height` toward 0 rather than toggling visibility abruptly.

None of steps 1–5 require, reference, or resemble any particular implementation —
they're the standard toolbox for "blend some rounded 3D-ish shapes into a 2D
silhouette," picked because they're fast enough to re-run every animation frame in a
browser.

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
