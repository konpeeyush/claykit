// Public API of @claykit/core. See docs/spec/avatar-definition.md for the data model and
// rendering approach this implements.

export type {
  AvatarDefinition,
  AvatarRuntimeEnvironment,
  AvatarScene,
  Animation,
  AnimationStep,
  BlinkConfig,
  BodyNode,
  EulerDeg,
  Expression,
  EyeShape,
  MotionKind,
  Primitive3D,
  PrimitiveType,
  TransitionCurve,
  Vec3,
} from './types.js'

export { validateAvatarDefinition, type ValidateResult, type ValidationIssue } from './validate.js'
export { avatarDefinitionSchema } from './schema.js'

export { createAvatarPlaybackState, type AvatarPlaybackState, type DirectTransition } from './playback/state.js'
export { resolveExpression, beginExpression, type ResolveResult, type BeginResult } from './playback/expressions.js'
export { playAvatarAnimation, type PlayResult } from './playback/animations.js'
export { advanceAvatarPlayback } from './playback/advance.js'
export { sampleAvatarFrame, activeExpressionOf } from './playback/sample.js'
export { renderAvatarFrame } from './playback/render.js'
export { DEFAULT_BLINK } from './playback/blink.js'
export type { Pose } from './playback/pose.js'
