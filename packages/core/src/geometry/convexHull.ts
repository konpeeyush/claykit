// 2D convex hull + path emission.
//
// Every primitive in a definition is a convex volume, and the silhouette of a convex body under
// any projection is exactly the convex hull of its projected surface points. So instead of
// blending fields and tracing contours, each primitive samples its own surface, projects, and
// hulls — which is both cheaper and gives a genuinely perspective-correct outline (a rotated
// rounded box really does come out as a foreshortened trapezoid-ish shape, not a flat rectangle).

export type Point = { x: number; y: number }

const cross = (o: Point, a: Point, b: Point): number =>
  (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x)

/** Andrew's monotone chain. Returns hull points in counter-clockwise order. */
export const convexHull = (points: Point[]): Point[] => {
  if (points.length < 3) return points
  const sorted = [...points].sort((p, q) => (p.x === q.x ? p.y - q.y : p.x - q.x))

  const build = (pts: Point[]): Point[] => {
    const chain: Point[] = []
    for (const p of pts) {
      while (chain.length >= 2 && cross(chain[chain.length - 2]!, chain[chain.length - 1]!, p) <= 0) {
        chain.pop()
      }
      chain.push(p)
    }
    chain.pop()
    return chain
  }

  return [...build(sorted), ...build(sorted.reverse())]
}

/**
 * Closed path through `points`, smoothed with quadratic segments that pass through each edge's
 * midpoint and use the vertex as the control point. Unlike Catmull-Rom this can never overshoot
 * the source polygon, so a hull stays a hull — no bulging on the long straight edges of a boxy
 * primitive, while densely-sampled curved regions still read as smooth.
 */
export const closedPath = (points: Point[]): string => {
  const n = points.length
  if (n < 3) return ''
  const at = (i: number) => points[((i % n) + n) % n]!
  const mid = (a: Point, b: Point): Point => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 })
  const f = (v: number) => v.toFixed(2)

  const start = mid(at(0), at(1))
  let d = `M ${f(start.x)} ${f(start.y)} `
  for (let i = 1; i <= n; i++) {
    const vertex = at(i)
    const end = mid(at(i), at(i + 1))
    d += `Q ${f(vertex.x)} ${f(vertex.y)}, ${f(end.x)} ${f(end.y)} `
  }
  return `${d}Z`
}
