// Auto-discovers every *.avatar.json next to the project root and validates each one against
// @claykit/core's own schema (validateAvatarDefinition) before it's trusted as an AvatarDefinition.
// Drop a new definition file in beside freddy.avatar.json and it shows up as a tab — no wiring
// needed. Validation failures become a visible message rather than a thrown error, so one bad
// file doesn't blank the page.
import { validateAvatarDefinition, type AvatarDefinition } from '@claykit/core'

const modules = import.meta.glob<{ default: unknown }>('../*.avatar.json', { eager: true })

export type AvatarEntry =
  | { id: string; label: string; ok: true; definition: AvatarDefinition }
  | { id: string; label: string; ok: false; message: string }

const toId = (path: string) => path.replace(/^.*\//, '').replace(/\.avatar\.json$/, '')

export const avatars: AvatarEntry[] = Object.entries(modules)
  .map(([path, mod]) => {
    const id = toId(path)
    const parsed = validateAvatarDefinition(mod.default)
    if (!parsed.ok) {
      const first = parsed.errors[0]
      const message = `Invalid avatar definition${first?.path ? ` at ${first.path}` : ''}: ${first?.message ?? 'unknown error'}`
      return { id, label: id, ok: false as const, message }
    }
    const label = parsed.value.name || id
    return { id, label, ok: true as const, definition: parsed.value }
  })
  .sort((a, b) => a.label.localeCompare(b.label))
