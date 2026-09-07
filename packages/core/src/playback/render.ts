// renderAvatarFrame is the one function a renderer actually calls each frame: sample the pose,
// then turn it into path data. Kept separate from sample.ts because geometry-building (marching
// squares etc.) is comparatively expensive — callers that only need the Pose (e.g. advance.ts
// grabbing a transition's "from") should never pay for it.

import type { AvatarDefinition, AvatarRuntimeEnvironment, AvatarScene, Vec3 } from '../types.js'
import { buildHeadSilhouette } from '../geometry/silhouette.js'
import { eyePath } from '../geometry/eyeShape.js'
import { projectPrimitive } from '../geometry/project.js'
import { superellipseBoundaryPoints } from '../geometry/superellipse.js'
import { contourToSmoothPath } from '../geometry/marchingSquares.js'
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
  // Geometry math (project.ts, silhouette.ts) works with the [x,y,z] tuple form used by
  // position/rotation; Pose.head mirrors the definition's {x,y,z} object form, so convert once here.
  const headPose: Vec3 = [pose.head.x, pose.head.y, pose.head.z]

  const headPath = buildHeadSilhouette(definition.body, headPose, pose.perspective)

  const nodePaths = definition.body.nodes.map(node => {
    const footprint = projectPrimitive(node.surface, node.position, node.rotation, headPose, {
      perspective: pose.perspective,
      viewScale: 1,
    })
    return contourToSmoothPath(superellipseBoundaryPoints(footprint))
  })

  return {
    geometry: {
      headPath,
      leftPath: eyePath(pose.eyes.left, -pose.eyes.spacing / 2, pose.eyesOpen),
      rightPath: eyePath(pose.eyes.right, pose.eyes.spacing / 2, pose.eyesOpen),
      leftVisible: pose.eyesOpen > EYE_VISIBLE_THRESHOLD,
      rightVisible: pose.eyesOpen > EYE_VISIBLE_THRESHOLD,
      nodePaths,
    },
    colors: pose.colors,
  }
}
