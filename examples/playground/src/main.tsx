// The claykit playground: one avatar centred on a light stage, with simple chip rows underneath
// for finish, animation and expression. Built against @claykit/react's published API
// (AvatarCanvas, FINISHES, Finish) so day-to-day development exercises the same surface consumers
// get. No avatar here uses accent colours, so the optional `accentGroups` prop is omitted.
import { StrictMode, useMemo, useRef, useState, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'

import { AvatarCanvas, FINISHES, type Finish } from '@claykit/react'
import '@claykit/react/styles.css'

import { avatars } from './avatars'
import './styles.css'

type Target = { kind: 'animation' | 'expression'; key: string }

// Renders the current frame's inline SVG to an offscreen canvas and downloads it as a PNG.
// The viewBox is square regardless of on-screen size, so we rasterize at a fixed pixel size
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

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="lab__row">
      <span className="lab__label">{label}</span>
      <div className="lab__chips">{children}</div>
    </div>
  )
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" className="lab__chip" aria-pressed={on} onClick={onClick}>
      {children}
    </button>
  )
}

function App() {
  const [avatarId, setAvatarId] = useState(avatars[0]?.id ?? '')
  const [finish, setFinish] = useState<Finish>('clay')
  const stageRef = useRef<HTMLDivElement>(null)

  const avatar = avatars.find(a => a.id === avatarId) ?? avatars[0]

  const { animations, expressions } = useMemo(() => {
    if (!avatar?.ok) return { animations: [] as string[], expressions: [] as string[] }
    return { animations: avatar.definition.animationOrder, expressions: avatar.definition.expressionOrder }
  }, [avatar])

  // Reset the selection whenever the avatar changes — keys are per-definition.
  const [target, setTarget] = useState<Target>({ kind: 'animation', key: '' })
  const active: Target = target.key
    ? target
    : animations[0]
      ? { kind: 'animation', key: animations[0] }
      : { kind: 'expression', key: expressions[0] ?? 'neutral' }

  if (!avatar) {
    return (
      <main className="lab">
        <p className="lab__error">No *.avatar.json found in the project root.</p>
      </main>
    )
  }

  return (
    <main className="lab">
      <header className="lab__head">
        <h1>claykit</h1>
        <p>Procedural avatars, rendered to SVG.</p>
      </header>

      <div className="lab__panel">
        <div className="lab__stage">
          {avatar.ok ? (
            <AvatarCanvas
              key={avatar.id}
              ref={stageRef}
              definition={avatar.definition}
              finish={finish}
              {...(active.kind === 'animation' ? { animation: active.key } : { expression: active.key })}
              size={340}
              ariaLabel={`${avatar.label} avatar`}
            />
          ) : (
            <p className="lab__error">{avatar.message}</p>
          )}
        </div>

        {avatars.length > 1 && (
          <Row label="Avatar">
            {avatars.map(a => (
              <Chip
                key={a.id}
                on={a.id === avatar.id}
                onClick={() => {
                  setAvatarId(a.id)
                  setTarget({ kind: 'animation', key: '' })
                }}
              >
                {a.label}
              </Chip>
            ))}
          </Row>
        )}

        <Row label="Finish">
          {FINISHES.map(f => (
            <Chip key={f} on={f === finish} onClick={() => setFinish(f)}>
              {f}
            </Chip>
          ))}
        </Row>

        <Row label="Animation">
          {animations.map(key => (
            <Chip
              key={key}
              on={active.kind === 'animation' && active.key === key}
              onClick={() => setTarget({ kind: 'animation', key })}
            >
              {key}
            </Chip>
          ))}
        </Row>

        <Row label="Expression">
          {expressions.map(key => (
            <Chip
              key={key}
              on={active.kind === 'expression' && active.key === key}
              onClick={() => setTarget({ kind: 'expression', key })}
            >
              {key}
            </Chip>
          ))}
        </Row>

        <div className="lab__actions">
          <button
            type="button"
            className="lab__action"
            onClick={() => {
              if (stageRef.current) {
                captureAvatarPng(stageRef.current, `${avatar.id}-${finish}-${active.key || 'neutral'}.png`)
              }
            }}
          >
            Download PNG
          </button>
        </div>
      </div>
    </main>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
