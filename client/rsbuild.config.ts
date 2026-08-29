import { defineConfig } from '@rsbuild/core'
import { pluginReact } from '@rsbuild/plugin-react'
import { pluginSass } from '@rsbuild/plugin-sass'

/**
 * Which data source this bundle talks to is decided here, at build time.
 *
 *   PUBLIC_SOURCE=live     the satellite (the default, and what runs on the Pi)
 *   PUBLIC_SOURCE=replay   the bundled recording — the public demo, which has no
 *                          backend of any kind
 *
 * Inlined as a literal rather than read at runtime, so the branch that is not
 * taken is dead code and rspack drops it: the static build carries no MQTT
 * client, and the satellite's build carries no recording.
 */
const SOURCE = process.env.PUBLIC_SOURCE === 'replay' ? 'replay' : 'live'

export default defineConfig({
    plugins: [pluginReact(), pluginSass()],
    html: {
        title: 'CubeSat Ground Station'
    },
    server: {
        port: 3000,
        proxy: {
            // The dashboard service on the satellite. Only the archive goes over
            // HTTP — live telemetry arrives over the broker's own WebSocket
            // listener, which needs no proxy.
            '/api': { target: 'http://localhost:8080', changeOrigin: true }
        }
    },
    source: {
        entry: { index: './src/index.tsx' },
        define: {
            'process.env.PUBLIC_BROKER_URL': JSON.stringify(process.env.PUBLIC_BROKER_URL ?? ''),
            'process.env.PUBLIC_API_BASE': JSON.stringify(process.env.PUBLIC_API_BASE ?? '/api')
        }
    },
    resolve: {
        alias: {
            // The whole of the build-time swap. The module that is not chosen is
            // never imported, so it is never bundled.
            '#active-source': `./src/features/telemetry/sources/active.${SOURCE}.ts`
        }
    },
    output: {
        copy: [{ from: 'public/.htaccess', to: '' }]
    }
})
