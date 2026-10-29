import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), 'VITE_');
    // Each generated bundle carries a compact release marker. Deployments may
    // provide STUDIO_RELEASE; local builds get a unique UTC marker by default.
    const release = process.env.STUDIO_RELEASE ??
        `v0.3.1-${new Date()
            .toISOString()
            .replace(/[-:]/g, '')
            .replace(/\.\d{3}Z$/, 'Z')}`;
    return {
        // The canonical legacy route and the cache-isolated Studio route build
        // from the same source without hard-coded asset/API paths.
        base: env.VITE_APP_BASE || '/miniapp/',
        // Vite copies manifest/service-worker files unchanged to the configured
        // base path (for example /studio/), so no PWA plugin is required.
        publicDir: 'public',
        define: {
            __STUDIO_RELEASE__: JSON.stringify(release),
        },
        plugins: [react()],
        resolve: { dedupe: ['react', 'react-dom'] },
        server: { host: '0.0.0.0' },
    };
});
