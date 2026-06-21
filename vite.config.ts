import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { writeFileSync } from 'fs'
import { join } from 'path'

function versionPlugin(): Plugin {
  const hash = Date.now().toString(36)
  return {
    name: 'build-version',
    config() {
      return { define: { __BUILD_HASH__: JSON.stringify(hash) } }
    },
    closeBundle() {
      writeFileSync(join('dist', 'version.json'), JSON.stringify({ hash }))
    },
  }
}

export default defineConfig({
  plugins: [react(), versionPlugin()],
  server: {
    port: 5175,
    proxy: {
      '/api': {
        target: 'http://localhost:3002',
        changeOrigin: true,
      },
    },
  },
})
