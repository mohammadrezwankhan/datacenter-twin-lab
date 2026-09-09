import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  base: mode === 'demo' ? '/datacenter-twin-lab/' : '/',
  publicDir: mode === 'demo' ? '../../.local/browser-demo-assets' : 'public',
  server: { host: '127.0.0.1', proxy: { '/api': 'http://127.0.0.1:8000' } },
  worker: { format: 'es' },
  build: {
    outDir: mode === 'demo' ? '../../.local/browser-demo-site' : '../../datacenter_twin/web',
    emptyOutDir: true,
  },
}));
