# @claykit/react

React bindings for [`@claykit/core`](../core) — a `<AvatarCanvas>` component that drives a
procedural, animated, two-tone avatar and renders it as SVG.

## Install

```sh
pnpm add @claykit/react @claykit/core
```

## Usage

```tsx
import { AvatarCanvas } from '@claykit/react'
import '@claykit/react/styles.css'
import definition from './freddy.avatar.json'

export function Freddy() {
  return (
    <AvatarCanvas
      definition={definition}
      finish="clay"
      animation="idle"
      size={240}
    />
  )
}
```

- `finish` — `'clay'` (gradient, bevel, grain, contact shadow) or `'plastic'` (flat two-tone).
  Defaults to `'clay'`.
- `animation` / `expression` — names from the definition's `animationOrder` / `expressionOrder`.
  Changing either cross-fades from the avatar's current pose. An unknown name is logged to the
  console and ignored rather than throwing.
- `accentGroups` — `{ nodes: number[]; color: string }[]`, painting specific `body.nodes` indexes
  in a different colour than the rest of the body.
- `size` — CSS width/height (number in px, or any CSS length). Defaults to `240`.

See `docs/spec/avatar-definition.md` in the repo root for the avatar definition data model.
