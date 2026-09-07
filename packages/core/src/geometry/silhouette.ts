// Builds the per-primitive silhouettes for one posed frame.
//
// Each volume is drawn as its OWN shape — the ears stay distinct spheres sitting behind the head
// rather than melting into it. Pipeline per primitive: sample its surface (primitiveSurface.ts),
// place it in the assembly (own rotation, then position), rotate the whole assembly by the head
// pose, project through the perspective camera (transform.ts), then hull the projected points
// (convexHull.ts) — the hull of a projected convex body IS its exact silhouette.
//
// Layering is driven by each node's AUTHORED z, never by the per-frame projected depth: a node
// behind the head must stay behind it through a whole head turn, and a depth sort would pop it
// forward mid-rotation.

import type { AvatarDefinition, BodyNode, EulerDeg, Primitive3D, Vec3 } from '../types.js'
import { convexHull, closedPath, type Point } from './convexHull.js'
import { samplePrimitiveSurface } from './primitiveSurface.js'
import { apply, projectPoint, rotationMatrix, type Mat3 } from './transform.js'

const eulerFromVec3 = (v: Vec3): EulerDeg => ({ x: v[0], y: v[1], z: v[2] })

const silhouetteOf = (
  primitive: Primitive3D,
  localRotation: Mat3,
  position: Vec3,
  headRotation: Mat3,
  perspective: number,
): string => {
  const projected: Point[] = samplePrimitiveSurface(primitive).map(local => {
    const oriented = apply(localRotation, local)
    const placed: Vec3 = [oriented[0] + position[0], oriented[1] + position[1], oriented[2] + position[2]]
    const posed = apply(headRotation, placed)
    const { x, y } = projectPoint(posed, perspective)
    return { x, y }
  })
  return closedPath(convexHull(projected))
}

export type AvatarGeometryParts = {
  headPath: string
  nodePaths: string[]
  /** Node indices drawn before the head, and after it — from authored z, stable across a pose. */
  behind: number[]
  front: number[]
}

export const buildAvatarGeometry = (
  body: AvatarDefinition['body'],
  headPose: EulerDeg,
  perspective: number,
): AvatarGeometryParts => {
  const headRotation = rotationMatrix(headPose)

  const headPath = silhouetteOf(body.primary, rotationMatrix({ x: 0, y: 0, z: 0 }), [0, 0, 0], headRotation, perspective)

  const nodePaths = body.nodes.map((node: BodyNode) =>
    silhouetteOf(node.surface, rotationMatrix(eulerFromVec3(node.rotation)), node.position, headRotation, perspective),
  )

  const behind: number[] = []
  const front: number[] = []
  body.nodes.forEach((node, i) => (node.position[2] < 0 ? behind : front).push(i))

  return { headPath, nodePaths, behind, front }
}
