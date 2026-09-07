// How much a blink-in-progress closes the eyes, and default blink pacing for a held expression
// that isn't part of an animation (animations bring their own BlinkConfig).

import type { BlinkConfig } from '../types.js'

export const DEFAULT_BLINK: BlinkConfig = {
  enabled: true,
  initialDelayMs: 2500,
  minIntervalMs: 3000,
  maxIntervalMs: 6000,
  durationMs: 220,
}

/** 1 = eyes open, dips to 0 at the midpoint of the blink and back — outside the window, always 1. */
export const blinkOpenAmount = (elapsedMs: number, durationMs: number): number => {
  if (elapsedMs < 0 || elapsedMs > durationMs) return 1
  return 1 - Math.sin((elapsedMs / durationMs) * Math.PI)
}
