// Extracts the zero-level contour of a scalar field as closed polylines (marching squares —
// textbook computational geometry, https://en.wikipedia.org/wiki/Marching_squares), then turns
// a polyline into a smooth SVG path via a standard Catmull-Rom-to-Bezier conversion.
//
// Corner layout per cell (i, j), values sampled at grid points (x = xMin+i*dx, y = yMin+j*dy):
//   c3 --- c2      c0 = (i,   j)     c1 = (i+1, j)
//   |       |      c2 = (i+1, j+1)   c3 = (i,   j+1)
//   c0 --- c1
// Inside = value < 0.

export type Point = { x: number; y: number }
export type FieldFn = (x: number, y: number) => number

export type MarchOptions = {
  xMin: number
  xMax: number
  yMin: number
  yMax: number
  resolution: number
}

const lerpEdge = (v0: number, v1: number, p0: Point, p1: Point): Point => {
  const t = v0 / (v0 - v1)
  return { x: p0.x + (p1.x - p0.x) * t, y: p0.y + (p1.y - p0.y) * t }
}

const keyOf = (p: Point): string => `${p.x.toFixed(4)},${p.y.toFixed(4)}`

/** Returns every closed contour found, largest (by point count) first. */
export const marchingSquares = (field: FieldFn, opts: MarchOptions): Point[][] => {
  const { xMin, xMax, yMin, yMax, resolution } = opts
  const dx = (xMax - xMin) / resolution
  const dy = (yMax - yMin) / resolution

  const cols = resolution + 1
  const values = new Float64Array(cols * (resolution + 1))
  const at = (i: number, j: number) => values[j * cols + i]!
  for (let j = 0; j <= resolution; j++) {
    for (let i = 0; i <= resolution; i++) {
      values[j * cols + i] = field(xMin + i * dx, yMin + j * dy)
    }
  }

  const segments: [Point, Point][] = []

  for (let j = 0; j < resolution; j++) {
    for (let i = 0; i < resolution; i++) {
      const p0: Point = { x: xMin + i * dx, y: yMin + j * dy }
      const p1: Point = { x: xMin + (i + 1) * dx, y: yMin + j * dy }
      const p2: Point = { x: xMin + (i + 1) * dx, y: yMin + (j + 1) * dy }
      const p3: Point = { x: xMin + i * dx, y: yMin + (j + 1) * dy }
      const v0 = at(i, j)
      const v1 = at(i + 1, j)
      const v2 = at(i + 1, j + 1)
      const v3 = at(i, j + 1)

      const caseIndex = (v0 < 0 ? 1 : 0) | (v1 < 0 ? 2 : 0) | (v2 < 0 ? 4 : 0) | (v3 < 0 ? 8 : 0)
      if (caseIndex === 0 || caseIndex === 15) continue

      const eBottom = () => lerpEdge(v0, v1, p0, p1)
      const eRight = () => lerpEdge(v1, v2, p1, p2)
      const eTop = () => lerpEdge(v2, v3, p2, p3)
      const eLeft = () => lerpEdge(v3, v0, p3, p0)

      // Saddle cases (5, 10): four crossings, disambiguated by the cell-center sign so the
      // contour doesn't visually "swap" which side is inside as the field varies smoothly.
      const centerInside = () => v0 + v1 + v2 + v3 < 0

      const pushPairs = (pairs: Array<[Point, Point]>) => {
        for (const [a, b] of pairs) segments.push([a, b])
      }

      switch (caseIndex) {
        case 1:
        case 14:
          pushPairs([[eLeft(), eBottom()]])
          break
        case 2:
        case 13:
          pushPairs([[eBottom(), eRight()]])
          break
        case 3:
        case 12:
          pushPairs([[eLeft(), eRight()]])
          break
        case 4:
        case 11:
          pushPairs([[eRight(), eTop()]])
          break
        case 6:
        case 9:
          pushPairs([[eBottom(), eTop()]])
          break
        case 7:
        case 8:
          pushPairs([[eLeft(), eTop()]])
          break
        case 5:
          pushPairs(
            centerInside()
              ? [[eLeft(), eTop()], [eBottom(), eRight()]]
              : [[eLeft(), eBottom()], [eTop(), eRight()]],
          )
          break
        case 10:
          pushPairs(
            centerInside()
              ? [[eLeft(), eBottom()], [eTop(), eRight()]]
              : [[eLeft(), eTop()], [eBottom(), eRight()]],
          )
          break
      }
    }
  }

  // Stitch segments sharing an endpoint into closed loops. Shared cell edges produce
  // numerically identical endpoints (same corner values, same lerp), so exact key matching holds.
  const bySrc = new Map<string, [Point, Point][]>()
  for (const seg of segments) {
    for (const p of [seg[0], seg[1]]) {
      const k = keyOf(p)
      const list = bySrc.get(k) ?? []
      list.push(seg)
      bySrc.set(k, list)
    }
  }

  const used = new Set<[Point, Point]>()
  const loops: Point[][] = []

  for (const seg of segments) {
    if (used.has(seg)) continue
    const loop: Point[] = [seg[0], seg[1]]
    used.add(seg)
    let current = seg[1]
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const candidates = (bySrc.get(keyOf(current)) ?? []).filter(s => !used.has(s))
      if (candidates.length === 0) break
      const next = candidates[0]!
      used.add(next)
      const nextPoint = keyOf(next[0]) === keyOf(current) ? next[1] : next[0]
      if (keyOf(nextPoint) === keyOf(loop[0]!)) break
      loop.push(nextPoint)
      current = nextPoint
    }
    if (loop.length >= 3) loops.push(loop)
  }

  return loops.sort((a, b) => b.length - a.length)
}

/** Evenly resample a closed polyline down to `count` points, preserving overall shape. */
const resampleClosed = (points: Point[], count: number): Point[] => {
  if (points.length <= count) return points
  const step = points.length / count
  const out: Point[] = []
  for (let i = 0; i < count; i++) out.push(points[Math.floor(i * step)]!)
  return out
}

/** Closed Catmull-Rom spline through `points`, emitted as a cubic-bezier SVG path. */
export const contourToSmoothPath = (points: Point[], maxPoints = 72): string => {
  if (points.length < 3) return ''
  const pts = resampleClosed(points, maxPoints)
  const n = pts.length
  const at = (i: number) => pts[((i % n) + n) % n]!

  let d = `M ${pts[0]!.x.toFixed(2)} ${pts[0]!.y.toFixed(2)} `
  for (let i = 0; i < n; i++) {
    const p0 = at(i - 1)
    const p1 = at(i)
    const p2 = at(i + 1)
    const p3 = at(i + 2)
    const c1 = { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 }
    const c2 = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 }
    d += `C ${c1.x.toFixed(2)} ${c1.y.toFixed(2)}, ${c2.x.toFixed(2)} ${c2.y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)} `
  }
  return `${d}Z`
}
