// Named easing curves for AnimationStep.transition / directTransition. Formulas are the standard
// published ones (see easings.net) — generic animation-curve math, not specific to any library.

import type { TransitionCurve } from '../types.js'

const easeSmooth = (t: number): number => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2) // ease-in-out cubic
const easeSnappy = (t: number): number => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t)) // ease-out expo
const easeSpring = (t: number): number => {
  // ease-out elastic — a damped sinusoid overshoot, the standard "spring" curve from easings.net
  if (t === 0 || t === 1) return t
  const c4 = (2 * Math.PI) / 3
  return Math.pow(2, -8 * t) * Math.sin((t * 8 - 0.75) * c4) + 1
}

const CURVES: Record<TransitionCurve, (t: number) => number> = {
  smooth: easeSmooth,
  snappy: easeSnappy,
  spring: easeSpring,
}

export const ease = (curve: TransitionCurve, t: number): number => CURVES[curve](Math.max(0, Math.min(1, t)))
