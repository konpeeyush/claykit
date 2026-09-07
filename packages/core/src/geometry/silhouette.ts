// Composes the primitive-projection, smooth-union, and marching-squares pieces into the single
// path the rest of the engine actually wants: "given this body and this pose, what's the outline?"

import type { AvatarDefinition, Vec3 } from '../types.js'
import { projectPrimitive } from './project.js'
import { superellipseField } from './superellipse.js'
import { smoothUnionAll } from './smoothUnion.js'
import { marchingSquares, contourToSmoothPath } from './marchingSquares.js'

// The avatar's local unit space already matches this project's -150..150 SVG viewBox (see
// examples/playground), so viewScale stays 1 — this is a rendering convention, tuned to taste,
// not a property of the data format itself.
const VIEW_HALF = 150
const GRID_RESOLUTION = 96
/** Smooth-min blend radius: how far apart two primitives can be and still visually fuse. */
const BLEND_K = 18

export const buildHeadSilhouette = (body: AvatarDefinition['body'], headPose: Vec3, perspective: number): string => {
  const footprints = [
    projectPrimitive(body.primary, [0, 0, 0], [0, 0, 0], headPose, { perspective, viewScale: 1 }),
    ...body.nodes.map(node =>
      projectPrimitive(node.surface, node.position, node.rotation, headPose, { perspective, viewScale: 1 }),
    ),
  ]

  const field = (x: number, y: number) => smoothUnionAll(footprints.map(fp => superellipseField(fp, x, y)), BLEND_K)

  const loops = marchingSquares(field, {
    xMin: -VIEW_HALF,
    xMax: VIEW_HALF,
    yMin: -VIEW_HALF,
    yMax: VIEW_HALF,
    resolution: GRID_RESOLUTION,
  })

  return loops[0] ? contourToSmoothPath(loops[0]) : ''
}
