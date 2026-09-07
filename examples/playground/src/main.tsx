// The claykit playground app: an avatar-tab picker, a clay/plastic finish switcher, a "Download
// PNG" button that rasterizes the on-screen SVG to a canvas, and animation/expression pickers
// below the stage. Recreated against @claykit/react's real published API (AvatarCanvas, FINISHES,
// Finish) from the project owner's own freddy-avatar-react/src/main.tsx. No accent groups are in
// use by either migrated avatar, so the `accentGroups` prop is simply omitted here rather than
// reintroducing the old repo's local accents.js stub.
import { StrictMode, useMemo, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'

import { AvatarCanvas, FINISHES, type Finish } from '@claykit/react'
import '@claykit/react/styles.css'

import { avatars } from './avatars'
import './styles.css'

type Target = { kind: 'animation' | 'expression'; key: string }

// Renders the current frame's inline SVG to an offscreen canvas and downloads it as a PNG.
// The viewBox is 300x300 regardless of on-screen size, so we rasterize at a fixed pixel size
// for a crisp export rather than whatever CSS size the stage happens to be showing.
async function captureAvatarPng(container: HTMLDivElement, filename: string, pixelSize = 1024) {
  const svg = container.querySelector('svg')
  if (!svg) return

  const clone = svg.cloneNode(true) as SVGSVGElement
  clone.setAttribute('width', String(pixelSize))
  clone.setAttribute('height', String(pixelSize))
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')

  const svgString = new XMLSerializer().serializeToString(clone)
  const svgUrl = URL.createObjectURL(new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' }))

  try {
    const image = new Image()
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve()
      image.onerror = () => reject(new Error('Failed to rasterize avatar SVG'))
      image.src = svgUrl
    })

    const canvas = document.createElement('canvas')
    canvas.width = pixelSize
    canvas.height = pixelSize
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.drawImage(image, 0, 0, pixelSize, pixelSize)

    const link = document.createElement('a')
    link.href = canvas.toDataURL('image/png')
    link.download = filename
    link.click()
  } finally {
    URL.revokeObjectURL(svgUrl)
  }
}

function App() {
  const [avatarId, setAvatarId] = useState(avatars[0]?.id ?? '')
  const [finish, setFinish] = useState<Finish>('clay')
  const stageRef = useRef<HTMLDivElement>(null)

  const avatar = avatars.find(a => a.id === avatarId) ?? avatars[0]

  const { animations, expressions } = useMemo(() => {
    if (!avatar?.ok) return { animations: [] as string[], expressions: [] as string[] }
    return {
      animations: avatar.definition.animationOrder,
      expressions: avatar.definition.expressionOrder,
    }
  }, [avatar])

  // Reset the selection whenever the avatar changes — keys are per-definition.
  const [target, setTarget] = useState<Target>({ kind: 'animation', key: '' })
  const active: Target = target.key
    ? target
    : animations[0]
      ? { kind: 'animation', key: animations[0] }
      : { kind: 'expression', key: expressions[0] ?? 'neutral' }

  const pick = (avatarId: string) => {
    setAvatarId(avatarId)
    setTarget({ kind: 'animation', key: '' })
  }

  if (!avatar) return <main><p className="error">No *.avatar.json found in the project root.</p></main>

  const handleCapture = () => {
    if (!stageRef.current) return
    captureAvatarPng(stageRef.current, `${avatar.id}-${finish}-${active.key || 'neutral'}.png`)
  }

  return (
    <main>
      <header className="topbar">
        {avatars.length > 1 ? (
          <nav className="tabs" aria-label="Avatars">
            {avatars.map(a => (
              <button
                key={a.id}
                type="button"
                aria-pressed={a.id === avatar.id}
                onClick={() => pick(a.id)}
              >
                {a.label}
              </button>
            ))}
          </nav>
        ) : (
          <h1>{avatar.label}</h1>
        )}

        <div className="topbar__actions">
          <div className="finish" role="group" aria-label="Finish">
            {FINISHES.map(f => (
              <button
                key={f}
                type="button"
                aria-pressed={f === finish}
                onClick={() => setFinish(f)}
              >
                {f}
              </button>
            ))}
          </div>
          <button type="button" onClick={handleCapture}>
            Download PNG
          </button>
        </div>
      </header>

      <div className="demo">
        <section className="stage">
          {avatar.ok ? (
            <AvatarCanvas
              key={avatar.id}
              ref={stageRef}
              definition={avatar.definition}
              finish={finish}
              {...(active.kind === 'animation'
                ? { animation: active.key }
                : { expression: active.key })}
              size="100%"
              ariaLabel={`${avatar.label} avatar`}
            />
          ) : (
            <p className="error">{avatar.message}</p>
          )}
        </section>

        <aside className="controls">
          <h2>Animations</h2>
          <div className="grid">
            {animations.map(key => (
              <button
                key={key}
                type="button"
                aria-pressed={active.kind === 'animation' && active.key === key}
                onClick={() => setTarget({ kind: 'animation', key })}
              >
                {key}
              </button>
            ))}
          </div>
          <h2>Expressions</h2>
          <div className="grid">
            {expressions.map(key => (
              <button
                key={key}
                type="button"
                aria-pressed={active.kind === 'expression' && active.key === key}
                onClick={() => setTarget({ kind: 'expression', key })}
              >
                {key}
              </button>
            ))}
          </div>
        </aside>
      </div>
    </main>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
