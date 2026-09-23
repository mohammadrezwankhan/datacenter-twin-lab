import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { createHash } from 'node:crypto';
import { copyFileSync, lstatSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ENGINE_VERSION } from './src/js-engine/version.ts';

function localEvidenceAssets(): string {
  const root = fileURLToPath(new URL('../../', import.meta.url));
  const output = resolve(root, '.local/local-dashboard-assets');
  const packet = resolve(root, `data/evidence/v${ENGINE_VERSION}`);
  const manifestText = readFileSync(resolve(packet, 'manifest.json'), 'utf8').replaceAll(
    '\r\n',
    '\n',
  );
  const manifest = JSON.parse(manifestText);
  if (manifest.engine_version !== ENGINE_VERSION) throw new Error('Evidence version mismatch');
  const target = resolve(output, `data/evidence/v${ENGINE_VERSION}`);
  mkdirSync(target, { recursive: true });
  // Share only manifest-declared public evidence, never a broad repository copy.
  for (const [name, entry] of Object.entries(manifest.artifacts)) {
    if (basename(name) !== name || name.includes('\\') || name.includes('/'))
      throw new Error(`Unsafe evidence filename: ${name}`);
    const source = resolve(packet, name);
    if (!lstatSync(source).isFile()) throw new Error(`Evidence must be a regular file: ${name}`);
    const bytes = Buffer.from(readFileSync(source, 'utf8').replaceAll('\r\n', '\n'));
    if (createHash('sha256').update(bytes).digest('hex') !== (entry as { sha256: string }).sha256)
      throw new Error(`Evidence hash mismatch: ${name}`);
    writeFileSync(resolve(target, name), bytes);
  }
  writeFileSync(resolve(target, 'manifest.json'), manifestText);
  copyFileSync(
    resolve(root, `data/evidence/index-v${ENGINE_VERSION}.json`),
    resolve(output, 'evidence-index.json'),
  );
  for (const name of ['guide-preview.png', 'proof-demo.webm', 'proof-demo.vtt'])
    copyFileSync(resolve(root, 'docs/images', name), resolve(output, name));
  copyFileSync(
    resolve(root, 'apps/web/public/THIRD-PARTY-NOTICES.txt'),
    resolve(output, 'THIRD-PARTY-NOTICES.txt'),
  );
  return output;
}

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  base: mode === 'demo' ? '/datacenter-twin-lab/' : '/',
  publicDir: mode === 'demo' ? '../../.local/browser-demo-assets' : localEvidenceAssets(),
  server: { host: '127.0.0.1', proxy: { '/api': 'http://127.0.0.1:8000' } },
  worker: { format: 'es' },
  build: {
    outDir: mode === 'demo' ? '../../.local/browser-demo-site' : '../../datacenter_twin/web',
    emptyOutDir: true,
  },
}));
