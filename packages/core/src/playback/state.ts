// The full persistent playback state for one avatar instance. Everything here is plain data —
// no timers, no subscriptions — so a caller (e.g. @claykit/react) owns the storage (a ref, a
// signal, whatever) and just calls advanceAvatarPlayback/sampleAvatarFrame every frame.

import type { BlinkConfig, TransitionCurve } from '../types.js'
import type { Pose } from './pose.js'

export type DirectTransition = {
  from: Pose
  startedAt: number
  durationMs: number
  transition: TransitionCurve
}

export type AvatarPlaybackState = {
  status: 'idle' | 'playing' | 'stopped'
  activeExpression: string | null
  activeAnimation: string | null
  stepIndex: number
  stepStartedAt: number
  directTransition: DirectTransition | null
  activeBlink: BlinkConfig | null
  nextBlinkAt: number | null
  blinkStartedAt: number | null
  /** Phase seed for ambientMotion, drawn from AvatarRuntimeEnvironment.random on first advance. */
  ambientSeed: number | null
}

export const createAvatarPlaybackState = (): AvatarPlaybackState => ({
  status: 'idle',
  activeExpression: null,
  activeAnimation: null,
  stepIndex: 0,
  stepStartedAt: 0,
  directTransition: null,
  activeBlink: null,
  nextBlinkAt: null,
  blinkStartedAt: null,
  ambientSeed: null,
})
