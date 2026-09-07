# claykit

Open-source, MIT-licensed engine for procedural, animated, two-tone creature
avatars — build a definition once, get a lively little character with expressions,
animations, ambient motion, and a soft "clay" render finish.

```tsx
import { AvatarCanvas } from '@claykit/react'
import freddy from './freddy.avatar.json'

<AvatarCanvas definition={freddy} finish="clay" animation="idle" size={240} />
```

## Packages

| Package | What it is |
|---|---|
| [`@claykit/core`](packages/core) | Framework-agnostic engine: the avatar definition schema, playback state machine, and geometry/rendering pipeline. |
| [`@claykit/react`](packages/react) | React bindings — the `AvatarCanvas` component, in `clay` or `plastic` finish. |

`examples/playground` is a small demo app exercising both packages against real
avatar definitions.

## Getting started

```sh
pnpm install
pnpm dev          # runs examples/playground
pnpm -r run build # builds both packages
```

## How it works

An avatar is defined by a `*.avatar.json` file: an assembly of 3D primitives (a head
volume plus attached parts), a two-color palette, a library of named expressions, and
animations that sequence those expressions. The engine poses that assembly in 3D,
projects it, and renders it to SVG every frame — with blinking, ambient motion, and
smooth transitions between expressions.

See [`docs/spec/avatar-definition.md`](docs/spec/avatar-definition.md) for the full
data model and rendering approach.

## License

MIT — see [LICENSE](LICENSE).
