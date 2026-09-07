# claykit

## What this is

claykit is an MIT-licensed engine plus React binding for procedurally-shaped,
animated, two-tone creature avatars: a `*.avatar.json` definition describes an
assembly of 3D primitives and a library of expressions and animations, and the engine
renders it to animated SVG.

`docs/spec/avatar-definition.md` is the specification the engine implements, and the
source of truth for both the data model and the rendering/playback approach. Work
from it. If something isn't specified there, that's a gap to fill with an original
design decision.

## Repo layout

```
packages/core/     @claykit/core   — framework-agnostic engine (no React import anywhere)
packages/react/    @claykit/react  — React bindings + clay/plastic paint finishes
examples/playground/ — private Vite+React demo app (not published)
docs/spec/          — the avatar definition spec (data model + rendering approach)
```

Two packages only, on purpose — see "Scope" below for what's NOT built yet.

## The data model, and where it actually came from

`docs/spec/avatar-definition.md` is the real spec — read it before touching
`types.ts` or `schema.ts` in `packages/core`. The short version, because a couple of
things are easy to get wrong from memory:

- A `*.avatar.json` body is **3D primitives**, not flat 2D shapes: a `primary`
  rounded-box/sphere/cylinder/capsule "head" volume, plus attached `nodes` (same
  primitive types) at 3D `position`/`rotation` **tuples** (`[x,y,z]` arrays).
- An `Expression`'s `head` pose is the ODD ONE OUT: it's an **`{x,y,z}` object**, not
  a tuple, even though it represents the same kind of thing (a rotation in degrees).
  This asymmetry is in the real data files (`examples/playground/*.avatar.json`),
  not a mistake — `types.ts`/`schema.ts` intentionally mirror it. Converting between
  the two happens once, at the geometry boundary, in `playback/render.ts`.
- An `Expression` can carry an optional, **partial** `colors` override (`{body?,
  eyes?}` — either field alone, or both, or neither) — e.g. `angry-brows` flashes a
  full red palette, `uneasy-left` only overrides `body`. `playback/pose.ts` merges
  this against the definition's base `colors` and even lerps it smoothly during
  transitions (hex → RGB → lerp → hex).
- `body.nodes[].rotation` is always `[0,0,0]` in every real file seen so far — it's
  supported in the type/schema/math for completeness, but don't assume it's
  meaningfully exercised anywhere yet.

## Rendering approach: a real 3D assembly, drawn per-primitive

`packages/core/src/geometry/` is an original pipeline built from textbook,
publicly-documented techniques. The full description is in
`docs/spec/avatar-definition.md`; the parts worth knowing before you touch the code:

- **Every primitive is drawn as its own shape.** Sample its superquadric surface as a
  3D point cloud (`primitiveSurface.ts`) → orient/place it → rotate the whole assembly
  by the head pose → perspective-project (`transform.ts`) → **convex hull**
  (`convexHull.ts`) → path. Every primitive is convex, so the hull of its projected
  points is exactly its silhouette. `silhouette.ts` ties it together.
- **Layering comes from authored z, never a per-frame depth sort** — a sort makes
  nodes pop through the head mid-rotation. `AvatarScene.geometry.behind` / `.front`
  carry node indices; `@claykit/react` draws behind → head → front.
- **Eyes ride the head's front face in 3D** (`eyeShape.ts`) so they travel,
  foreshorten and roll with it. They're capsules, `angle` is in **degrees**, and the
  whole outline is tessellated (straight sides included).

### An earlier version of this got it badly wrong — don't go back

The first implementation blended all primitives into one field with a smooth-minimum
and traced it with marching squares. It produced a **single fused blob**: the ears
melted into the head instead of reading as ears, and it distorted under rotation.
Related mistakes that came with it, all since fixed: treating eye `angle` as radians
(it's degrees, so every angled expression was wildly wrong), drawing eyes as flat 2D
ellipses that ignored the head pose, and a weak-perspective fudge instead of a real
projection. If you find yourself reaching for field blending again, re-read this.

### Calibrated constants — change these only with measurements in hand

Three constants were fitted by measuring rendered silhouettes, not derived:

- `transform.ts` `BASE_CAMERA_DISTANCE = 800` — perspective strength. Halving it
  visibly over-skews a turned head.
- `primitiveSurface.ts` `profileExponent` / `footprintExponent` — deliberately
  **split**, because they control visually independent things and one value can't
  satisfy both. `e1` (profile) is the front-on corner rounding you look at; `e2`
  (footprint) is how much extra width the head presents as it turns. Rounding both
  together made the avatar look right at rest but move only ~60% as much as it
  should — which reads as stiff and lifeless.
- `render.ts` eye `faceZ` = half the primary's depth (the true face plane).

**Validate geometry changes by rendering and looking**, plus measuring — see below.

## Playback state machine (`packages/core/src/playback/`)

- `Pose` (`pose.ts`) is the blend-able numeric snapshot (head/eyes/perspective/
  eyesOpen/colors) — distinct from `AvatarScene` (final SVG paths). You can lerp a
  `Pose`; you can't usefully lerp two path strings.
- `sampleAvatarFrame` (pure read, no mutation) vs. `advanceAvatarPlayback` (pure
  state transition) vs. `renderAvatarFrame` (sample + build geometry) are three
  separate functions on purpose — `advance.ts` calls `sampleAvatarFrame` internally
  to grab a "from" pose when stepping to a new animation step, without paying for
  geometry it doesn't need.
- Blinking and ambient motion (`shake`/`slowDrift` on `eyes`/`body`, per the active
  expression's `motion` field) keep ticking even at `status: 'stopped'` (a finished
  `once` animation) — only animation-step progression is gated on `'playing'`.
  Ambient motion itself holds no state beyond one `ambientSeed` float (drawn once
  from `AvatarRuntimeEnvironment.random` so multiple avatars on a page don't drift
  in lockstep) — it's a pure function of `now`, computed fresh in `sampleAvatarFrame`.
- Named easing curves (`smooth`/`spring`/`snappy` in `easing.ts`) are the standard
  published formulas from easings.net — generic, not derived from anywhere.
- `beginExpression` (the `expression` prop's entry point) and `playAvatarAnimation`
  (the `animation` prop's entry point) each validate + build a full
  `AvatarPlaybackState` in one call — there's no separate "resolve, then manually
  construct state" step in the public API. `resolveExpression` is exported too, but
  only for callers who want a validity check without starting a transition.

## Tooling

pnpm workspaces + tsup (esbuild) + Changesets. No Turborepo — only 2 publishable
packages, not worth the cache-orchestration overhead yet.

```
pnpm install
pnpm -r run typecheck        # all packages
pnpm -r run build            # all packages
pnpm --filter @claykit/core run build     # one package
pnpm dev                     # runs examples/playground's vite dev server
```

One gotcha already hit and fixed: tsup's `.d.ts` generation step fails under
TypeScript 6.0.3 with `TS5101: Option 'baseUrl' is deprecated` even though nothing
in this repo sets `baseUrl` — it comes from tsup's internal dts-rollup step.
`tsconfig.base.json` has `"ignoreDeprecations": "6.0"` to silence it. If upgrading
TypeScript or tsup, check whether this is still needed.

Also: fresh clones need `pnpm install` to actually run esbuild's postinstall
(binary download) — `package.json`'s `pnpm.onlyBuiltDependencies: ["esbuild"]`
handles the approval non-interactively, but if pnpm ever changes that mechanism,
`pnpm --filter @claykit/core run build` will fail with a missing esbuild binary as
the symptom.

## How to sanity-check a change (no browser required)

There's no test suite yet (see "Scope" below), so for anything touching
`packages/core/src/geometry/*` or the playback state machine, render something and
look at it rather than trusting typecheck alone:

```js
import { readFileSync, writeFileSync } from 'node:fs'
import { validateAvatarDefinition, createAvatarPlaybackState, renderAvatarFrame, sampleAvatarFrame }
  from './packages/core/dist/index.js' // pnpm --filter @claykit/core run build first

const def = validateAvatarDefinition(JSON.parse(readFileSync('examples/playground/freddy.avatar.json', 'utf8'))).value
const state = createAvatarPlaybackState()
const scene = renderAvatarFrame(def, state, 0, { random: () => 0.5, reduceMotion: false })
writeFileSync('/tmp/check.svg', `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-150 -150 300 300"><path d="${scene.geometry.headPath}" fill="${scene.colors.body}"/></svg>`)
```

Then `rsvg-convert /tmp/check.svg -o /tmp/check.png` (installed via Homebrew on this
machine) and view the PNG. Do NOT reach for chrome-devtools or any browser MCP tool
for this unless explicitly asked — per the repo owner's global preference, browser
automation is only used on request; a static SVG render answers "does the geometry
look right" without needing a browser at all.

### Measuring, not just eyeballing

For geometry work, measure the rendered output — `getBBox()` on the paths, in the
`-150..150` viewBox:

```js
[...document.querySelector('svg').querySelectorAll('path')]
  .map(p => { const b = p.getBBox(); return { x: +b.x.toFixed(1), w: +b.width.toFixed(1) } })
```

Path order is: head, then nodes, then the clipPath copy of the head, then the two
eyes. Two things this catches that eyeballing does not:

1. **Absolute size** per element (head / ears / tab / eyes) at a fixed expression.
2. **Motion amplitude** — sample a bbox every 250ms across an animation and compare
   the min/max range. This is how "the animation feels stiff" became a number: a
   head-width range of 14.5 where ~22 was wanted pointed straight at the footprint
   exponent. A static pose can look perfect while the motion is wrong, so check both.

## Scope — what's built vs. what's still open

Built and verified (typecheck + build green, and checked both visually and by
measuring rendered bboxes): the full geometry pipeline, the full playback state
machine (expressions, animations, blink, ambient motion, color-override blending),
ajv schema validation, `@claykit/react`'s `AvatarCanvas` with both `clay` and
`plastic` finishes, and `examples/playground` running on a real avatar definition
(`freddy.avatar.json` — 28 expressions, 6 animations).

Freddy is currently the only avatar, so the `capsule` primitive is supported in code
but exercised by nothing.

Not yet done, in rough priority order:
- **No automated tests.** Everything above was verified by hand (typecheck, build,
  and rendering real avatars to PNG and looking at them) — there's no vitest suite
  yet for the geometry math or the playback state machine's edge cases (e.g. a
  `once` animation finishing mid-blink, or rapid expression-prop changes).
- **No `./packages/core` JSON-schema npm subpath export** — `avatarDefinitionSchema`
  is only available as a named export from `@claykit/core`'s main entry, not as a
  standalone `.json` file consumers could point a JSON-schema-aware editor at. This
  was dropped for v1 to avoid tsup asset-copying complexity — revisit once there's
  a real consumer need.
- **No vue/svelte/vanilla-DOM binding** — `@claykit/core` was deliberately kept
  framework-agnostic so one of these is additive later, not a rewrite, but none
  exist yet.
- **No CI workflow** (GitHub Actions) wired up yet — no `.github/workflows/` at all.
- **Repo not yet pushed to GitHub** — `git init` was run locally; nothing has been
  committed or pushed (per the owner's global "never commit without asking" rule).
- Root `package.json`'s pinned tool versions (pnpm 10.13.1, tsup 8.5.1, vitest 5.0.0,
  ajv 8.20.0, vite 8.2.2, `@vitejs/plugin-react` 6.1.1) were the latest available at
  scaffold time (2026-09-07) — don't assume they're still current in a later session.
