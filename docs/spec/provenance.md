# Provenance & clean-room notes

## Why claykit exists

`freddy-avatar-react` (a sibling project) depends on `@bible-strong/avatar-core` and
`@bible-strong/avatar-react`, both `AGPL-3.0-only` (© Stéphane Montlouis-Calixte,
[bible-strong-avatar-lab](https://github.com/smontlouis/bible-strong-avatar-lab)).
AGPL's copyleft terms are incompatible with closed-source production use. claykit is
an original, MIT-licensed replacement covering the same kind of procedural,
animated, two-tone avatar — built without copying or adapting that project's code.

## What informed this implementation

- **The public npm API surface**, as consumed by `freddy-avatar-react`'s own
  `AvatarCanvas.tsx` (function names like `renderAvatarFrame`, `playAvatarAnimation`;
  the shape of props like `finish`, `animation`, `expression`, `accentGroups`). An
  npm package's public interface — what functions exist and what they're called — is
  not copyrightable expression; only the literal implementation is.
- **Two `*.avatar.json` data files** (`freddy.avatar.json`, `ribbit.avatar.json`),
  which are this project's own original creative content, inspected to determine the
  functional JSON shape a definition needs (see `avatar-definition.md`).
- **Generic, publicly published computer graphics techniques** (superellipse curves,
  SDF smooth-min blending, marching squares, weak-perspective projection, named
  easing curves) — standard toolbox material, not sourced from or specific to any
  avatar library.

## What was explicitly NOT done

- The `bible-strong-avatar-lab` GitHub repository was not opened or read.
- The installed `@bible-strong/avatar-core` / `@bible-strong/avatar-react` packages'
  bundled source (`node_modules/.../dist`) was not read.
- No file, schema, comment, or algorithm from those packages was copied, translated,
  or adapted.

## What changed from the observed data files on migration into claykit

- The `schema` field (`"bible-strong/avatar-definition"` → `"claykit/avatar-definition"`)
  — a self-identifying tag naming the other project, updated to identify this one.
  This is the only field value changed; the JSON structure and every other value
  carried over unchanged, since the shape itself is functional, not creative,
  content (see `avatar-definition.md`).

## Ongoing rule for contributors

Implement against `avatar-definition.md`, not against `bible-strong-avatar-lab`. If a
behavior isn't specified there and you're unsure how it should work, that's a gap in
the spec to fill in with an original design decision — not a reason to go check what
the AGPL project does.
