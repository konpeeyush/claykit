// The React binding for @claykit/core: owns playback state in a ref, renders one AvatarScene per
// animation frame, and paints it as SVG in either the "clay" or "plastic" finish.
//
// Two pieces of structure matter: one continuous rAF loop for the component's lifetime (so
// ambient motion and blinking keep ticking between prop changes), and a prop-change effect that
// samples the current pose first, so a new expression/animation cross-fades from wherever the
// avatar actually is instead of snapping.
import {
  advanceAvatarPlayback,
  beginExpression,
  createAvatarPlaybackState,
  playAvatarAnimation,
  renderAvatarFrame,
  sampleAvatarFrame,
  type AvatarDefinition,
  type AvatarPlaybackState,
  type AvatarRuntimeEnvironment,
  type AvatarScene,
} from '@claykit/core'
import { forwardRef, useEffect, useId, useRef, useState } from 'react'

import { clayDefsMarkup, groupNodesByMaterial, type AccentGroup } from './finishes/clay.js'

// The engine's playback machinery is identical either way — only the paint differs:
//   clay    — gradient body, inner bevel, grain, contact shadow
//   plastic — flat two-tone
export type Finish = 'clay' | 'plastic'

export const FINISHES: readonly Finish[] = ['clay', 'plastic']

const environment = (): AvatarRuntimeEnvironment => ({
  random: Math.random,
  reduceMotion: typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
})

export type AvatarCanvasProps = {
  definition: AvatarDefinition
  finish?: Finish
  animation?: string
  expression?: string
  size?: number | string
  ariaLabel?: string
  className?: string
  /** Body nodes painted in an accent colour instead of the body colour. */
  accentGroups?: readonly AccentGroup[]
}

export const AvatarCanvas = forwardRef<HTMLDivElement, AvatarCanvasProps>(function AvatarCanvas(
  { definition, finish = 'clay', animation, expression, size = 240, ariaLabel = 'Procedural avatar', className, accentGroups = [] },
  ref,
) {
  const id = useId().replaceAll(':', '')
  const stateRef = useRef<AvatarPlaybackState>(createAvatarPlaybackState())
  const [scene, setScene] = useState<AvatarScene>(() =>
    renderAvatarFrame(definition, stateRef.current, performance.now(), environment()),
  )

  // Apply the controlled prop. An expression cross-fades from the current frame; an animation
  // hands off to the core's step timeline. Both seed `from` from a sample so the transition starts
  // where the avatar actually is. `finish` is deliberately absent from the deps below — repainting
  // must never restart playback.
  useEffect(() => {
    const now = performance.now()
    const env = environment()
    const from = sampleAvatarFrame(definition, stateRef.current, now, env)

    if (expression !== undefined) {
      const resolved = beginExpression(definition, expression, now, from)
      if (!resolved.ok) {
        console.error(`[AvatarCanvas] ${resolved.error.message}`)
        return
      }
      stateRef.current = resolved.value
      return
    }

    if (animation !== undefined) {
      const played = playAvatarAnimation(definition, animation, now, from)
      if (!played.ok) {
        console.error(`[AvatarCanvas] ${played.error.message}`)
        return
      }
      stateRef.current = played.value
    }
  }, [definition, animation, expression])

  // One rAF loop for the lifetime of the component. It runs continuously rather than stopping at
  // status 'stopped' so ambient motion and blinking keep ticking between explicit prop changes.
  useEffect(() => {
    let raf = 0
    const tick = (now: number) => {
      const env = environment()
      stateRef.current = advanceAvatarPlayback(definition, stateRef.current, now, env)
      setScene(renderAvatarFrame(definition, stateRef.current, now, env))
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [definition])

  const { geometry: g, colors } = scene
  const clay = finish === 'clay'
  const bodyFill = clay ? `url(#clay-grad-${id})` : colors.body
  // One bevel per material group, so same-material node paths fuse into a single lit mass.
  const bevel = clay ? `url(#clay-part-${id})` : undefined
  const paintOf = (accentIndex: number | null): string =>
    accentIndex === null
      ? bodyFill
      : clay
        ? `url(#clay-grad-accent-${id}-${accentIndex})`
        : (accentGroups[accentIndex]?.color ?? bodyFill)

  // Each volume is its own shape, stacked in the order the core resolved from authored z: nodes
  // behind the head (ears), then the head, then nodes in front of it (a snout). The head is the
  // primary volume rather than a node, so it always paints in the plain body colour.
  const drawNodes = (key: string, indices: readonly number[]) =>
    groupNodesByMaterial(g.nodePaths, indices, accentGroups).map((group, i) => (
      <g key={`${key}-${i}`} fill={paintOf(group.accentIndex)} filter={bevel}>
        {group.paths.map((d, pi) => (
          <path key={pi} d={d} />
        ))}
      </g>
    ))

  const body = (
    <>
      {drawNodes('behind', g.behind)}
      <path d={g.headPath} fill={bodyFill} filter={bevel} />
      {drawNodes('front', g.front)}
    </>
  )

  return (
    <div
      ref={ref}
      className={['avatar-canvas', `avatar-canvas--${finish}`, className ?? ''].filter(Boolean).join(' ')}
      // Width only — `aspect-ratio: 1` in the stylesheet derives the height. Setting both means a
      // container narrower than `size` shrinks the width (max-width: 100%) while the height stays,
      // squashing the box out of square.
      style={{ width: size }}
      role="img"
      aria-label={ariaLabel}
    >
      {/* Geometry reaches roughly ±145 at the most extreme authored pose, and the clay finish's
          drop shadow, bevel and grain all spill further still. The box is deliberately much wider
          than the avatar — ~30% margin on every side — so nothing the finish paints ever reaches
          the edge. Tighten this and a turning head collides with its own container: the shadow
          gets shaved and the repaint leaves slivers along the edge it hits. */}
      <svg className="avatar-canvas__svg" viewBox="-210 -210 420 420" aria-hidden="true">
        <defs>
          {clay && (
            <g
              dangerouslySetInnerHTML={{
                __html: clayDefsMarkup(colors.body, id, accentGroups.map(a => a.color)),
              }}
            />
          )}
          <clipPath id={`clay-clip-${id}`}>
            <path d={g.headPath} />
          </clipPath>
        </defs>

        {/* No contour pass: an feMorphology dilate over a multi-part group streaks badly at the
            edges (thin vertical combs alongside a turned head), and the volumes read fine without
            one — clay has its bevel and contact shadow, plastic its flat two-tone. */}
        {/* Shadow and grain are ONE filter (`clay-shade`) applied to a SINGLE group, not two nested
            `<g filter>` wrappers. Nesting a feTurbulence-based filter (grain) around another
            filtered group (the drop shadow) reliably corrupts Chrome's per-frame repaint: since
            `body`'s paths change every animation frame, the outer filter's rendered output goes
            stale in patches — a rectangular notch bitten out of a shape, or thin diagonal slivers
            stuck beside it, left over from a previous frame. It reproduces on every idle tick, not
            just during a pose transition, and survives forcing this element onto its own
            compositing layer, so it's specifically about the nested-filter structure, not
            compositing. Flattening both effects into one filter (see clay.ts) removes the nesting
            and the artifact along with it. */}
        {clay ? <g filter={`url(#clay-shade-${id})`}>{body}</g> : body}

        {/* Eyes stay outside the grain group — grain on eyes reads as speckle. */}
        <g clipPath={`url(#clay-clip-${id})`} fill={colors.eyes} filter={clay ? `url(#clay-eye-${id})` : undefined}>
          <path d={g.leftPath} opacity={g.leftVisible ? 1 : 0} />
          <path d={g.rightPath} opacity={g.rightVisible ? 1 : 0} />
        </g>
      </svg>
    </div>
  )
})
