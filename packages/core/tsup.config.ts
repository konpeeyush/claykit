// Build config for @claykit/core. Single ESM entry, types emitted alongside —
// the schema JSON is copied verbatim by schema.ts re-exporting it, not a tsup asset step.
import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  target: 'es2022',
  sourcemap: true,
})
