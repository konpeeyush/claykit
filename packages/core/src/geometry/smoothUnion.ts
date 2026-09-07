// Polynomial smooth-minimum for blending two field values into one — Inigo Quilez's cubic
// "smin", a widely published SDF-blending formula (https://iquilezles.org/articles/smin/),
// not specific to any particular renderer.

/** Blend two signed field values so their boundaries fuse instead of just overlapping. */
export const smoothMin = (a: number, b: number, k: number): number => {
  if (k <= 0) return Math.min(a, b)
  const h = Math.max(k - Math.abs(a - b), 0) / k
  return Math.min(a, b) - (h * h * k) / 4
}

/** Fold smoothMin across a list of field values — order doesn't matter, smin is associative-ish. */
export const smoothUnionAll = (values: number[], k: number): number =>
  values.reduce((acc, v) => (acc === undefined ? v : smoothMin(acc, v, k)), undefined as number | undefined) ?? Infinity
