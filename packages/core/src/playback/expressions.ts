// Entry point for the `expression` prop: validate the name, then build a state that direct-
// transitions into it from the caller-supplied current pose. Kept separate from
// playAvatarAnimation (animations.ts) because a held expression has no step timeline to run.

import type { AvatarDefinition } from '../types.js'
import { DEFAULT_BLINK } from './blink.js'
import type { Pose } from './pose.js'
import { createAvatarPlaybackState, type AvatarPlaybackState } from './state.js'

export type ResolveResult =
  | { ok: true; value: string }
  | { ok: false; error: { message: string; path: string } }

/** Validates that `name` exists in the definition — does not itself change any state. */
export const resolveExpression = (definition: AvatarDefinition, name: string): ResolveResult =>
  name in definition.expressions
    ? { ok: true, value: name }
    : { ok: false, error: { message: `Unknown expression "${name}"`, path: 'expressions' } }

const DIRECT_TRANSITION_MS = 420

export type BeginResult =
  | { ok: true; value: AvatarPlaybackState }
  | { ok: false; error: { message: string; path: string } }

/** Validates and builds the state for cross-fading into a held expression. */
export const beginExpression = (definition: AvatarDefinition, name: string, now: number, from: Pose): BeginResult => {
  const resolved = resolveExpression(definition, name)
  if (!resolved.ok) return resolved
  return {
    ok: true,
    value: {
      ...createAvatarPlaybackState(),
      status: 'playing',
      activeExpression: name,
      directTransition: { from, startedAt: now, durationMs: DIRECT_TRANSITION_MS, transition: 'smooth' },
      activeBlink: DEFAULT_BLINK,
      nextBlinkAt: now + DEFAULT_BLINK.initialDelayMs,
    },
  }
}
