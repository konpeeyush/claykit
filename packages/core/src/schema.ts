// The JSON Schema for AvatarDefinition, written independently from docs/spec/avatar-definition.md
// (not copied from anywhere) and kept in lockstep with types.ts by hand — there's no
// schema-to-types generator here, so a field added to one must be added to the other.

export const avatarDefinitionSchema = {
  $id: 'https://claykit.dev/schema/avatar-definition.json',
  type: 'object',
  additionalProperties: false,
  required: ['schema', 'schemaVersion', 'name', 'body', 'colors', 'expressions', 'expressionOrder', 'animations', 'animationOrder'],
  properties: {
    schema: { const: 'claykit/avatar-definition' },
    schemaVersion: { const: 1 },
    name: { type: 'string', minLength: 1 },
    body: {
      type: 'object',
      additionalProperties: false,
      required: ['primary', 'nodes'],
      properties: {
        primary: { $ref: '#/$defs/primitive3d' },
        nodes: { type: 'array', items: { $ref: '#/$defs/bodyNode' } },
      },
    },
    colors: { $ref: '#/$defs/colorPair' },
    expressions: { type: 'object', additionalProperties: { $ref: '#/$defs/expression' } },
    expressionOrder: { type: 'array', items: { type: 'string' } },
    animations: { type: 'object', additionalProperties: { $ref: '#/$defs/animation' } },
    animationOrder: { type: 'array', items: { type: 'string' } },
  },
  $defs: {
    hexColor: { type: 'string', pattern: '^#[0-9a-fA-F]{6}$' },
    vec3: { type: 'array', items: { type: 'number' }, minItems: 3, maxItems: 3 },
    primitive3d: {
      type: 'object',
      additionalProperties: false,
      required: ['type', 'width', 'height', 'depth', 'roundness'],
      properties: {
        type: { enum: ['cube', 'sphere', 'cylinder', 'capsule', 'cone'] },
        width: { type: 'number' },
        height: { type: 'number' },
        depth: { type: 'number' },
        roundness: { type: 'number', minimum: 0, maximum: 1 },
        morphRoundness: { type: 'number' },
        tipRoundness: { type: 'number', minimum: 0, maximum: 1 },
        baseRoundness: { type: 'number', minimum: 0, maximum: 1 },
      },
    },
    bodyNode: {
      type: 'object',
      additionalProperties: false,
      required: ['surface', 'position', 'rotation'],
      properties: {
        surface: { $ref: '#/$defs/primitive3d' },
        position: { $ref: '#/$defs/vec3' },
        rotation: { $ref: '#/$defs/vec3' },
      },
    },
    eyeShape: {
      type: 'object',
      additionalProperties: false,
      required: ['width', 'height', 'x', 'y', 'angle'],
      properties: {
        width: { type: 'number' },
        height: { type: 'number' },
        x: { type: 'number' },
        y: { type: 'number' },
        angle: { type: 'number' },
      },
    },
    motionKind: { enum: ['none', 'shake', 'slowDrift'] },
    eulerDeg: {
      type: 'object',
      additionalProperties: false,
      required: ['x', 'y', 'z'],
      properties: { x: { type: 'number' }, y: { type: 'number' }, z: { type: 'number' } },
    },
    colorPair: {
      type: 'object',
      additionalProperties: false,
      required: ['body', 'eyes'],
      properties: { body: { $ref: '#/$defs/hexColor' }, eyes: { $ref: '#/$defs/hexColor' } },
    },
    partialColorPair: {
      type: 'object',
      additionalProperties: false,
      properties: { body: { $ref: '#/$defs/hexColor' }, eyes: { $ref: '#/$defs/hexColor' } },
    },
    expression: {
      type: 'object',
      additionalProperties: false,
      required: ['head', 'eyes', 'perspective', 'motion'],
      properties: {
        head: { $ref: '#/$defs/eulerDeg' },
        eyes: {
          type: 'object',
          additionalProperties: false,
          required: ['left', 'right', 'spacing'],
          properties: { left: { $ref: '#/$defs/eyeShape' }, right: { $ref: '#/$defs/eyeShape' }, spacing: { type: 'number' } },
        },
        perspective: { type: 'number' },
        motion: {
          type: 'object',
          additionalProperties: false,
          required: ['eyes', 'body'],
          properties: { eyes: { $ref: '#/$defs/motionKind' }, body: { $ref: '#/$defs/motionKind' } },
        },
        colors: { $ref: '#/$defs/partialColorPair' },
      },
    },
    animationStep: {
      type: 'object',
      additionalProperties: false,
      required: ['expression', 'holdMs', 'transitionMs', 'transition'],
      properties: {
        expression: { type: 'string' },
        holdMs: { type: 'number', minimum: 0 },
        transitionMs: { type: 'number', minimum: 0 },
        transition: { enum: ['smooth', 'spring', 'snappy'] },
      },
    },
    blinkConfig: {
      type: 'object',
      additionalProperties: false,
      required: ['enabled', 'initialDelayMs', 'minIntervalMs', 'maxIntervalMs', 'durationMs'],
      properties: {
        enabled: { type: 'boolean' },
        initialDelayMs: { type: 'number' },
        minIntervalMs: { type: 'number' },
        maxIntervalMs: { type: 'number' },
        durationMs: { type: 'number' },
      },
    },
    animation: {
      type: 'object',
      additionalProperties: false,
      required: ['playbackMode', 'steps', 'blink', 'metadata'],
      properties: {
        playbackMode: { enum: ['loop', 'once'] },
        steps: { type: 'array', items: { $ref: '#/$defs/animationStep' }, minItems: 1 },
        blink: { $ref: '#/$defs/blinkConfig' },
        metadata: {
          type: 'object',
          additionalProperties: false,
          required: ['label', 'description', 'group'],
          properties: { label: { type: 'string' }, description: { type: 'string' }, group: { type: 'string' } },
        },
      },
    },
  },
} as const
