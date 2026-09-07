// Vite config for the claykit playground demo — plain React app, no library-build concerns.
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({ plugins: [react()] })
