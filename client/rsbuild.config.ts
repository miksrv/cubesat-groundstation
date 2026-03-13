import { defineConfig } from '@rsbuild/core'
import { pluginReact } from '@rsbuild/plugin-react'
import { pluginSass } from '@rsbuild/plugin-sass'

export default defineConfig({
    plugins: [pluginReact(), pluginSass()],
    html: {
        title: 'CubeSat Ground Station'
    },
    server: {
        port: 3000,
        proxy: {
            // '/api': { target: 'http://localhost:8080', changeOrigin: true }
            '/api': { target: 'https://cubesat.miksoft.pro', changeOrigin: true }
        }
    },
    source: {
        entry: { index: './src/index.tsx' }
    },
    output: {
        copy: [{ from: 'public/.htaccess', to: '' }]
    }
})
