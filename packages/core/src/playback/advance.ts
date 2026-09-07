// advanceAvatarPlayback moves state forward to `now`: steps an animation's timeline, clears
// completed direct transitions, and schedules/ticks blinking. It deliberately keeps ticking
// blink/ambient-motion-relevant fields even at status 'stopped' (a finished 'once' animation) —
// only step progression is gated on 'playing'. Ambient motion itself is stateless (see
// ambientMotion.ts) and just reads `now` + ambientSeed inside sampleAvatarFrame.

import type { AvatarDefinition, AvatarRuntimeEnvironment } from '../types.js'
import { sampleAvatarFrame } from './sample.js'
import type { AvatarPlaybackState } from './state.js'

const randomBetween = (random: () => number, min: number, max: number) => min + random() * (max - min)

export const advanceAvatarPlayback = (
  definition: AvatarDefinition,
  state: AvatarPlaybackState,
  now: number,
  env: AvatarRuntimeEnvironment,
): AvatarPlaybackState => {
  let next = state
  const set = (patch: Partial<AvatarPlaybackState>) => {
    next = next === state ? { ...state, ...patch } : { ...next, ...patch }
  }

  if (next.ambientSeed === null) set({ ambientSeed: env.random() * 1000 })

  if (next.directTransition && now >= next.directTransition.startedAt + next.directTransition.durationMs) {
    set({ directTransition: null })
  }

  if (next.status === 'playing' && next.activeAnimation) {
    const animation = definition.animations[next.activeAnimation]
    const step = animation?.steps[next.stepIndex]
    if (animation && step) {
      const elapsed = now - next.stepStartedAt
      if (elapsed >= step.transitionMs + step.holdMs) {
        const isLast = next.stepIndex === animation.steps.length - 1
        if (isLast && animation.playbackMode === 'once') {
          set({ status: 'stopped' })
        } else {
          const nextIndex = isLast ? 0 : next.stepIndex + 1
          const nextStep = animation.steps[nextIndex]!
          const fromPose = sampleAvatarFrame(definition, state, now, env)
          set({
            stepIndex: nextIndex,
            stepStartedAt: now,
            directTransition: { from: fromPose, startedAt: now, durationMs: nextStep.transitionMs, transition: nextStep.transition },
          })
        }
      }
    }
  }

  if (!env.reduceMotion) {
    if (next.blinkStartedAt !== null) {
      const durationMs = next.activeBlink?.durationMs ?? 220
      if (now - next.blinkStartedAt >= durationMs) {
        const blink = next.activeBlink
        const nextBlinkAt = blink ? now + randomBetween(env.random, blink.minIntervalMs, blink.maxIntervalMs) : null
        set({ blinkStartedAt: null, nextBlinkAt })
      }
    } else if (next.nextBlinkAt !== null && now >= next.nextBlinkAt) {
      set({ blinkStartedAt: now })
    }
  }

  return next
}
