// sampleAvatarFrame is the pure "what pose is active right now" read — resolves the active
// expression/animation-step, blends any in-flight directTransition, then layers blink and
// ambient motion on top. It never mutates state; advance.ts is what moves state forward in time.

import type { AvatarDefinition, AvatarRuntimeEnvironment, Expression } from '../types.js'
import { applyAmbientMotion } from './ambientMotion.js'
import { blinkOpenAmount } from './blink.js'
import { ease } from './easing.js'
import { blendPose, poseFromExpression, type Pose } from './pose.js'
import type { AvatarPlaybackState } from './state.js'

/** The Expression object driving the current step/held expression, falling back to the first authored expression when idle. */
export const activeExpressionOf = (definition: AvatarDefinition, state: AvatarPlaybackState): Expression => {
  if (state.activeAnimation) {
    const animation = definition.animations[state.activeAnimation]
    const step = animation?.steps[state.stepIndex]
    const expr = step && definition.expressions[step.expression]
    if (expr) return expr
  }
  if (state.activeExpression) {
    const expr = definition.expressions[state.activeExpression]
    if (expr) return expr
  }
  const fallbackName = definition.expressionOrder[0]
  const fallback = fallbackName ? definition.expressions[fallbackName] : undefined
  if (!fallback) throw new Error('AvatarDefinition has no expressions to fall back to')
  return fallback
}

export const sampleAvatarFrame = (
  definition: AvatarDefinition,
  state: AvatarPlaybackState,
  now: number,
  env: AvatarRuntimeEnvironment,
): Pose => {
  const target = activeExpressionOf(definition, state)
  const targetPose = poseFromExpression(target, definition.colors)

  let pose: Pose
  const dt = state.directTransition
  if (dt && now < dt.startedAt + dt.durationMs) {
    const t = ease(dt.transition, (now - dt.startedAt) / dt.durationMs)
    pose = blendPose(dt.from, targetPose, t)
  } else {
    pose = targetPose
  }

  if (state.blinkStartedAt !== null) {
    const durationMs = state.activeBlink?.durationMs ?? 220
    pose = { ...pose, eyesOpen: pose.eyesOpen * blinkOpenAmount(now - state.blinkStartedAt, durationMs) }
  }

  if (!env.reduceMotion && state.ambientSeed !== null) {
    pose = applyAmbientMotion(pose, target.motion, now, state.ambientSeed)
  }

  return pose
}
