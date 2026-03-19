import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tsConfigPaths from 'vite-tsconfig-paths'
import { nitro } from 'nitro/vite'
import tailwindcss from '@tailwindcss/vite'

const isTest = process.env.NODE_ENV === 'test' || !!process.env.VITEST

export default defineConfig({
  plugins: [
    tsConfigPaths({
      projects: ['./tsconfig.json'],
    }),
    tailwindcss(),
    ...isTest ? [] : [
      tanstackStart({
        srcDirectory: 'src',
      }),
      nitro({
        serverDir: './server',
        features: {
          websocket: true,
        },
      }),
    ],
    react(),
  ],
  server: {},
  test: {
    environment: 'happy-dom',
    globals: true,
    setupFiles: './src/test-setup.ts',
  },
})
