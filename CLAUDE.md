# claykit

## What this is and why it exists

`freddy-avatar-react` (a sibling repo, `../freddy-avatar-react`) is a demo built on
`@bible-strong/avatar-core` + `@bible-strong/avatar-react` — both `AGPL-3.0-only`.
That license's copyleft terms make them unusable in the closed-source production
product this is ultimately for. claykit is a from-scratch, MIT-licensed engine +
React binding covering the same idea — a procedurally-shaped, animated, two-tone
creature avatar — built without copying or reading that project's source.

**Read `docs/spec/provenance.md` before touching anything AGPL-adjacent.** The short
version: don't open the `bible-strong-avatar-lab` GitHub repo, don't read
`node_modules/@bible-strong/*`'s bundled source in the sibling repo. Implement
against `docs/spec/avatar-definition.md` instead — if something isn't specified
there, that's a gap to fill with an original decision, not a reason to go check what
the AGPL project does.

## Repo layout

```
packages/core/     @claykit/core   — framework-agnostic engine (no React import anywhere)
packages/react/    @claykit/react  — React bindings + clay/plastic paint finishes
examples/playground/ — private Vite+React demo app (not published)
docs/spec/          — the data model spec + clean-room provenance notes
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

## Rendering approach (why a 2D superellipse/marching-squares pipeline, not raymarching)

We don't know how the AGPL renderer actually works and didn't look. `packages/core/
src/geometry/` is an original pipeline chosen to consume the same JSON shape and
look good, using only textbook, publicly-documented graphics techniques:

1. Each `Primitive3D` → a 2D **superellipse** footprint (`geometry/superellipse.ts`,
   Lamé curves — `roundness` maps to the exponent).
2. **Weak-perspective projection** (`geometry/project.ts`) — cheap depth-based scale,
   not a real 3D camera. A primitive's on-screen half-extents come from projecting
   its three local half-axis vectors through the combined rotation and taking their
   largest screen-space reach — an approximation, not an exact orthographic-shadow-
   of-an-ellipsoid computation.
3. **Smooth-min blending** (`geometry/smoothUnion.ts`, Quilez's cubic `smin`) fuses
   the primary volume and all nodes into one field.
4. **Marching squares** (`geometry/marchingSquares.ts`) traces that field's zero
   contour into a polygon, resampled and turned into a smooth SVG path via
   Catmull-Rom → cubic-bezier conversion. This same polyline→path helper is reused
   for standalone (unblended) per-node paths — see `AvatarScene.geometry.nodePaths`,
   which exists specifically so `@claykit/react` can paint individual nodes a
   different (accent) color without recomputing any geometry.
5. Eyes are NOT part of this pipeline — they're authored directly in 2D screen space
   (`EyeShape: {width,height,x,y,angle}`) and rendered as an exact 2-arc ellipse path
   (`geometry/eyeShape.ts`), offset left/right by half of `spacing`.

**This was validated visually**, not just typechecked — see "How to sanity-check a
change" below. First-attempt renders of both real avatars (Freddy: cube + 2 spheres
+ 1 cylinder; Ribbit: capsule + 3 spheres) came out looking like coherent, charming
creature heads with no tuning beyond the two constants in `silhouette.ts`
(`GRID_RESOLUTION = 96`, `BLEND_K = 18`). If you change the geometry pipeline,
re-render and look at it — don't just trust the types.

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
  `AvatarPlaybackState` in one call — there's no separate "resolve then manually
  construct state" step in the public API (unlike the old demo app's pattern, which
  is where the naming inspiration came from — see `resolveExpression`, kept only for
  callers who just want a validity check).

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
for this — per the repo owner's global preference, browser automation is only used
when explicitly asked; a static SVG render answers "does the geometry look right"
without needing a browser at all.

## Scope — what's built vs. what's still open

Built and verified (typecheck + build green, visually checked): the full geometry
pipeline, the full playback state machine (expressions, animations, blink, ambient
motion, color-override blending), ajv schema validation, `@claykit/react`'s
`AvatarCanvas` with both `clay` and `plastic` finishes, and `examples/playground`
migrated onto real production data (`freddy.avatar.json`, `ribbit.avatar.json` —
identical to the originals except the `schema` tag).

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
