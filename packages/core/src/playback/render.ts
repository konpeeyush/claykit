// renderAvatarFrame is the one function a renderer calls each frame: sample the pose, then turn it
// into path data. Kept separate from sample.ts because building geometry costs real work (surface
// sampling + hulls per primitive) — callers that only need the Pose (e.g. advance.ts grabbing a
// transition's "from") should never pay for it.

import type { AvatarDefinition, AvatarRuntimeEnvironment, AvatarScene } from '../types.js'
import { buildAvatarGeometry } from '../geometry/silhouette.js'
import { eyePath } from '../geometry/eyeShape.js'
import { sampleAvatarFrame } from './sample.js'
import type { AvatarPlaybackState } from './state.js'

const EYE_VISIBLE_THRESHOLD = 0.02

export const renderAvatarFrame = (
  definition: AvatarDefinition,
  state: AvatarPlaybackState,
  now: number,
  env: AvatarRuntimeEnvironment,
): AvatarScene => {
  const pose = sampleAvatarFrame(definition, state, now, env)
  const { headPath, nodePaths, behind, front } = buildAvatarGeometry(definition.body, pose.head, pose.perspective)

  // Eyes ride on the head's front face in 3D, so they need the same pose plus the depth of that
  // face — half the primary volume's depth.
  const faceZ = definition.body.primary.depth / 2
  const eyeOptions = { openAmount: pose.eyesOpen, headPose: pose.head, perspective: pose.perspective, faceZ }

  return {
    geometry: {
      headPath,
      leftPath: eyePath({ eye: pose.eyes.left, sideOffsetX: -pose.eyes.spacing / 2, ...eyeOptions }),
      rightPath: eyePath({ eye: pose.eyes.right, sideOffsetX: pose.eyes.spacing / 2, ...eyeOptions }),
      leftVisible: pose.eyesOpen > EYE_VISIBLE_THRESHOLD,
      rightVisible: pose.eyesOpen > EYE_VISIBLE_THRESHOLD,
      nodePaths,
      behind,
      front,
    },
    colors: pose.colors,
  }
}
