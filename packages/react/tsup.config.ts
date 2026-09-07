// Build config for @claykit/react. Mirrors @claykit/core's single ESM entry with emitted types;
// styles.css is listed as a second entry so tsup processes and copies it to dist/styles.css
// alongside the JS output (exposed via the package's "./styles.css" export).
import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts', 'src/styles.css'],
  format: ['esm'],
  dts: true,
  clean: true,
  target: 'es2022',
  sourcemap: true,
})
