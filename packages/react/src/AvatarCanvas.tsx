// The React binding for @claykit/core: owns playback state in a ref, renders one AvatarScene per
// animation frame, and paints it as SVG in either the "clay" or "plastic" finish. Overall
// structure (rAF loop, prop-change effect seeding a cross-fade "from" pose) ported from the
// project owner's own freddy-avatar-react/src/AvatarCanvas.tsx, rewired onto @claykit/core's API
// (beginExpression/playAvatarAnimation build the transition state directly — no separate resolve
// step needed).
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

import { clayDefsMarkup, groupNodesByMaterial, outlineDefsMarkup, type AccentGroup } from './finishes/clay.js'

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

  // Node bumps fuse into the silhouette by design (see docs/spec/avatar-definition.md's smooth-min
  // step), so drawing them again behind the head fill just refines the seam. The head itself is
  // the primary volume, not a node, so it always paints in the plain body colour.
  const nodeGroups = groupNodesByMaterial(g.nodePaths, accentGroups)
  const body = (
    <>
      {nodeGroups.map((group, i) => (
        <g key={`node-${i}`} fill={paintOf(group.accentIndex)} filter={bevel}>
          {group.paths.map((d, pi) => (
            <path key={pi} d={d} />
          ))}
        </g>
      ))}
      <path d={g.headPath} fill={bodyFill} filter={bevel} />
    </>
  )

  return (
    <div
      ref={ref}
      className={['avatar-canvas', `avatar-canvas--${finish}`, className ?? ''].filter(Boolean).join(' ')}
      style={{ width: size, height: size }}
      role="img"
      aria-label={ariaLabel}
    >
      <svg className="avatar-canvas__svg" viewBox="-150 -150 300 300" aria-hidden="true">
        <defs>
          {clay && (
            <g
              dangerouslySetInnerHTML={{
                __html: clayDefsMarkup(colors.body, id, accentGroups.map(a => a.color)),
              }}
            />
          )}
          <g dangerouslySetInnerHTML={{ __html: outlineDefsMarkup(colors.body, id) }} />
          <clipPath id={`clay-clip-${id}`}>
            <path d={g.headPath} />
          </clipPath>
        </defs>

        {/* Clay wraps the body in grain, over a contact shadow, over the outline; plastic keeps
            just the outline so the flat fill still reads against its background. */}
        {clay ? (
          <g filter={`url(#clay-grain-${id})`}>
            <g filter={`url(#clay-drop-${id})`}>
              <g filter={`url(#clay-outline-${id})`}>{body}</g>
            </g>
          </g>
        ) : (
          <g filter={`url(#clay-outline-${id})`}>{body}</g>
        )}

        {/* Eyes stay outside the grain group — grain on eyes reads as speckle. */}
        <g clipPath={`url(#clay-clip-${id})`} fill={colors.eyes} filter={clay ? `url(#clay-eye-${id})` : undefined}>
          <path d={g.leftPath} opacity={g.leftVisible ? 1 : 0} />
          <path d={g.rightPath} opacity={g.rightVisible ? 1 : 0} />
        </g>
      </svg>
    </div>
  )
})
