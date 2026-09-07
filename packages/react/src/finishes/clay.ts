// Clay finish paint recipe: gradient body, inner bevel, grain, and a contact shadow, expressed as
// SVG <defs> markup strings that AvatarCanvas drops in via dangerouslySetInnerHTML.
//
// A definition carries exactly two flat hex colors (`colors.body` / `colors.eyes`), so the clay
// look can't live in the *.avatar.json — it lives here, in the render layer, and the definition
// stays schema-valid.

const hexToHsl = (hex: string): [number, number, number] => {
  const n = parseInt(hex.slice(1), 16)
  const r = ((n >> 16) & 255) / 255
  const g = ((n >> 8) & 255) / 255
  const b = (n & 255) / 255
  const mx = Math.max(r, g, b)
  const mn = Math.min(r, g, b)
  const l = (mx + mn) / 2
  const d = mx - mn
  if (!d) return [0, 0, l]
  const s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn)
  const h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4
  return [h * 60, s, l]
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v))

/** Shift a hex color in HSL space and return an hsl() string. */
export const tone = (hex: string, dl: number, ds = 0, dh = 0): string => {
  const [h, s, l] = hexToHsl(hex)
  return `hsl(${(h + dh).toFixed(1)} ${(clamp01(s + ds) * 100).toFixed(1)}% ${(clamp01(l + dl) * 100).toFixed(1)}%)`
}

/**
 * Body hue driven to an ABSOLUTE lightness — for the contact shadow, which has to land dark on
 * every body. A relative delta cannot: a light body starting near L 0.93 would leave the "shadow"
 * lighter than the backdrop after the same delta that darkens a mid-tone body.
 */
export const shade = (hex: string, targetL: number, satScale = 0.6, dh = 0): string => {
  const [h, s] = hexToHsl(hex)
  return `hsl(${(h + dh).toFixed(1)} ${(clamp01(s * satScale) * 100).toFixed(1)}% ${(clamp01(targetL) * 100).toFixed(1)}%)`
}

/**
 * Gradient + filters for one avatar instance. `id` must be unique per avatar on the page, since
 * SVG filter/gradient ids are document-global.
 *
 * The light is deliberately ONE fixed source in user space, shared by every path:
 * `gradientUnits="userSpaceOnUse"` against the -150..150 viewBox. With the default
 * `objectBoundingBox` each path would resolve the gradient against its own bounding box, so
 * overlapping volumes would carry independent highlights that pop as the head turns. Anchoring
 * the light to the scene makes them read as one lit mass and keeps shading stable through motion.
 */
export const clayDefsMarkup = (body: string, id: string | number = 0, accentColors: readonly string[] = []): string => {
  const ramp = (c: string) => `
  <stop offset="0%" stop-color="${tone(c, 0.16, -0.04, 4)}"/>
  <stop offset="46%" stop-color="${c}"/>
  <stop offset="100%" stop-color="${tone(c, -0.19, -0.07, -6)}"/>`
  // One gradient per accent colour, each on the same scene-anchored light as the body.
  const accents = accentColors
    .map(
      (c, i) => `
<radialGradient id="clay-grad-accent-${id}-${i}" gradientUnits="userSpaceOnUse" cx="-48" cy="-72" r="246">${ramp(c)}
</radialGradient>`,
    )
    .join('')
  return `
<radialGradient id="clay-grad-${id}" gradientUnits="userSpaceOnUse" cx="-48" cy="-72" r="246">${ramp(body)}
</radialGradient>${accents}
<filter id="clay-part-${id}" x="-35%" y="-35%" width="170%" height="170%">
  <feGaussianBlur in="SourceAlpha" stdDeviation="3.4" result="b"/>
  <feOffset in="b" dx="3.4" dy="4" result="ob"/>
  <feComposite in="SourceAlpha" in2="ob" operator="out" result="m1"/>
  <feFlood flood-color="${tone(body, -0.28, 0.02, -8)}" flood-opacity="0.5"/>
  <feComposite in2="m1" operator="in" result="sh"/>
  <feOffset in="b" dx="-3.4" dy="-4.4" result="ob2"/>
  <feComposite in="SourceAlpha" in2="ob2" operator="out" result="m2"/>
  <feFlood flood-color="${tone(body, 0.28, -0.1, 6)}" flood-opacity="0.6"/>
  <feComposite in2="m2" operator="in" result="hl"/>
  <feMerge><feMergeNode in="SourceGraphic"/><feMergeNode in="sh"/><feMergeNode in="hl"/></feMerge>
</filter>
<filter id="clay-drop-${id}" x="-30%" y="-30%" width="160%" height="160%">
  <feDropShadow dx="0" dy="6" stdDeviation="6" flood-color="${shade(body, 0.07, 0.55, -8)}" flood-opacity="0.42"/>
</filter>
<filter id="clay-grain-${id}" x="-30%" y="-30%" width="160%" height="160%">
  <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="3" seed="7" result="n"/>
  <feColorMatrix in="n" type="saturate" values="0" result="ng"/>
  <feComposite in="ng" in2="SourceAlpha" operator="in" result="nm"/>
  <feComponentTransfer in="nm" result="nf"><feFuncA type="linear" slope="0.11"/></feComponentTransfer>
  <feBlend in="SourceGraphic" in2="nf" mode="overlay"/>
</filter>
<filter id="clay-eye-${id}" x="-50%" y="-50%" width="200%" height="200%">
  <feGaussianBlur in="SourceAlpha" stdDeviation="2.6" result="eb"/>
  <feOffset in="eb" dx="0" dy="2.6" result="eo"/>
  <feComposite in="SourceAlpha" in2="eo" operator="out" result="em"/>
  <feFlood flood-color="${tone(body, -0.3)}" flood-opacity="0.5"/>
  <feComposite in2="em" operator="in" result="es"/>
  <feMerge><feMergeNode in="SourceGraphic"/><feMergeNode in="es"/></feMerge>
</filter>`
}

/**
 * Contour around the merged body silhouette — an `feMorphology` dilate on SourceAlpha, flooded
 * and composited under the artwork. Deriving it from the group's alpha traces only the outer
 * edge, so overlapping node shapes contribute no internal lines. Both finishes use it: plastic
 * needs it most (one flat hex has nothing else to separate the avatar from its background), but
 * it reads in clay too.
 */
export const outlineDefsMarkup = (body: string, id: string | number = 0): string => `
<filter id="clay-outline-${id}" x="-30%" y="-30%" width="160%" height="160%">
  <feMorphology in="SourceAlpha" operator="dilate" radius="2" result="dilated"/>
  <feFlood flood-color="${shade(body, 0.19, 0.45, -8)}" flood-opacity="0.85" result="ink"/>
  <feComposite in="ink" in2="dilated" operator="in" result="outline"/>
  <feMerge><feMergeNode in="outline"/><feMergeNode in="SourceGraphic"/></feMerge>
</filter>`

export type AccentGroup = { nodes: readonly number[]; color: string }
export type MaterialGroup = { accentIndex: number | null; paths: string[] }

/**
 * Buckets the given node indices by material — the body colour, or one bucket per accent group —
 * preserving each node's authored order within its bucket. Body-coloured nodes group first so an
 * accented node (e.g. a nose) paints on top of them. One <g> per material lets AvatarCanvas apply
 * a single bevel filter across the whole group, so same-material node paths read as one lit mass
 * instead of each path getting its own separate rim.
 *
 * `indices` comes from a frame's `geometry.behind` / `geometry.front`, so this gets called once
 * per layer — the head is drawn between the two.
 */
export const groupNodesByMaterial = (
  nodePaths: readonly string[],
  indices: readonly number[],
  accentGroups: readonly AccentGroup[],
): MaterialGroup[] => {
  const accentOf = new Map<number, number>()
  accentGroups.forEach((group, i) => group.nodes.forEach(n => accentOf.set(n, i)))

  const buckets = new Map<number | 'body', MaterialGroup>()
  indices.forEach(i => {
    const d = nodePaths[i]
    if (!d) return
    const accentIndex = accentOf.get(i) ?? null
    const key = accentIndex === null ? 'body' : accentIndex
    const bucket = buckets.get(key) ?? { accentIndex, paths: [] }
    bucket.paths.push(d)
    buckets.set(key, bucket)
  })

  const groups = [...buckets.values()]
  const body = groups.filter(g => g.accentIndex === null)
  const accents = groups.filter(g => g.accentIndex !== null)
  return [...body, ...accents]
}
