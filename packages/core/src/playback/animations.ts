// Entry point for the `animation` prop: validate the name, then build a state that starts
// stepping through its timeline (advanceAvatarPlayback moves it from step to step over time).

import type { AvatarDefinition } from '../types.js'
import type { Pose } from './pose.js'
import { createAvatarPlaybackState, type AvatarPlaybackState } from './state.js'

export type PlayResult =
  | { ok: true; value: AvatarPlaybackState }
  | { ok: false; error: { message: string } }

export const playAvatarAnimation = (definition: AvatarDefinition, name: string, now: number, from: Pose): PlayResult => {
  const animation = definition.animations[name]
  if (!animation) return { ok: false, error: { message: `Unknown animation "${name}"` } }
  const firstStep = animation.steps[0]
  if (!firstStep) return { ok: false, error: { message: `Animation "${name}" has no steps` } }

  return {
    ok: true,
    value: {
      ...createAvatarPlaybackState(),
      status: 'playing',
      activeAnimation: name,
      stepIndex: 0,
      stepStartedAt: now,
      directTransition: { from, startedAt: now, durationMs: firstStep.transitionMs, transition: firstStep.transition },
      activeBlink: animation.blink.enabled ? animation.blink : null,
      nextBlinkAt: animation.blink.enabled ? now + animation.blink.initialDelayMs : null,
    },
  }
}
