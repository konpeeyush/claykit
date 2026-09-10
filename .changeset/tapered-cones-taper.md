---
"@claykit/core": minor
---

Add a `cone` primitive type: `width`/`height`/`depth`/`roundness` as usual, plus
`tipRoundness` and `baseRoundness` (0..1) to independently round the narrow and wide
ends, and `morphRoundness` (shared with `cylinder`) to melt the whole profile toward a
fully-round dome. Unlike the other four primitives, `cone` isn't a member of the shared
superquadric family (it's a genuine asymmetric taper) and is sampled by its own
provably-convex profile in `primitiveSurface.ts` — see that file's banner comment and
`coneRadiusProfile`.
