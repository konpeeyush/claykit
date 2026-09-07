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

## Why this exists

This project is a from-scratch, clean-room replacement for an AGPL-3.0-licensed
avatar engine that can't be used in closed-source production software. See
[`docs/spec/provenance.md`](docs/spec/provenance.md) for exactly what informed this
implementation (and what deliberately didn't), and
[`docs/spec/avatar-definition.md`](docs/spec/avatar-definition.md) for the full data
model and rendering approach.

## License

MIT — see [LICENSE](LICENSE).
