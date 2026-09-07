// Continuous, state-free motion applied on top of the resolved pose — what keeps an avatar
// feeling alive between deliberate expression/animation changes. `seed` (drawn once per playback
// state from AvatarRuntimeEnvironment.random) offsets the phase so multiple avatars on one page
// don't drift in lockstep.

import type { MotionKind } from '../types.js'
import type { Pose } from './pose.js'

const driftHead = (pose: Pose, now: number, seed: number): Pose => ({
  ...pose,
  head: {
    x: pose.head.x + Math.sin(now / 4000 + seed) * 3,
    y: pose.head.y + Math.cos(now / 5200 + seed * 1.3) * 2,
    z: pose.head.z,
  },
})

const shakeHead = (pose: Pose, now: number, seed: number): Pose => ({
  ...pose,
  head: { x: pose.head.x + Math.sin(now / 90 + seed) * 1.2, y: pose.head.y, z: pose.head.z },
})

const driftEyes = (pose: Pose, now: number, seed: number): Pose => {
  const dx = Math.sin(now / 3500 + seed * 0.7) * 1.5
  return { ...pose, eyes: { ...pose.eyes, left: { ...pose.eyes.left, x: pose.eyes.left.x + dx }, right: { ...pose.eyes.right, x: pose.eyes.right.x + dx } } }
}

const shakeEyes = (pose: Pose, now: number, seed: number): Pose => {
  const dx = Math.sin(now / 70 + seed * 2) * 0.8
  return { ...pose, eyes: { ...pose.eyes, left: { ...pose.eyes.left, x: pose.eyes.left.x + dx }, right: { ...pose.eyes.right, x: pose.eyes.right.x + dx } } }
}

const applyBody = (pose: Pose, kind: MotionKind, now: number, seed: number): Pose =>
  kind === 'slowDrift' ? driftHead(pose, now, seed) : kind === 'shake' ? shakeHead(pose, now, seed) : pose

const applyEyes = (pose: Pose, kind: MotionKind, now: number, seed: number): Pose =>
  kind === 'slowDrift' ? driftEyes(pose, now, seed) : kind === 'shake' ? shakeEyes(pose, now, seed) : pose

export const applyAmbientMotion = (
  pose: Pose,
  motion: { eyes: MotionKind; body: MotionKind },
  now: number,
  seed: number,
): Pose => applyEyes(applyBody(pose, motion.body, now, seed), motion.eyes, now, seed)
