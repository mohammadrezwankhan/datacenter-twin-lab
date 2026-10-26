import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { createHash } from 'node:crypto';
import {
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { dirname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ENGINE_VERSION } from './src/js-engine/version.ts';
import { searchPages } from './seo.ts';
import { securityHeaders } from './security-headers.ts';
import { stageLocalEvidenceAssets } from './local-evidence-assets.ts';

const ENGINEERING_HERO_REQUIRED_FILES = [
  'hero-1080p60.mp4',
  'poster.png',
  'integration/vanilla/khan-grid-hero.js',
  'integration/vanilla/embed.css',
  'integration/vanilla/host.css',
  'src/config.js',
  'index.html',
  'csp.json',
];

function engineeringHeroAssets(root: string): import('vite').Plugin {
  return {
    name: 'engineering-hero-release-assets',
    writeBundle(options) {
      if (!options.dir) throw new Error('Expected a directory for the engineering hero assets');
      const sourceRoot = resolve(root, '.local/engineering-hero-public/assets/engineering-hero/v1');
      const manifestPath = resolve(sourceRoot, 'release-media.json');
      if (
        !existsSync(sourceRoot) ||
        lstatSync(sourceRoot).isSymbolicLink() ||
        !lstatSync(sourceRoot).isDirectory() ||
        !existsSync(manifestPath) ||
        !lstatSync(manifestPath).isFile()
      )
        throw new Error(
          'Run VITE_ENGINEERING_HERO=1 python scripts/prepare_browser_demo.py to verify and stage the film',
        );

      const release = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
        status?: unknown;
        frames?: unknown;
        width?: unknown;
        height?: unknown;
        fps?: unknown;
        duration?: unknown;
        files?: unknown;
      };
      if (
        release.status !== 'verified' ||
        release.frames !== 900 ||
        release.width !== 1920 ||
        release.height !== 1080 ||
        release.fps !== 60 ||
        release.duration !== 15 ||
        !Array.isArray(release.files)
      )
        throw new Error(
          'Engineering hero release-media.json does not match the verified 15 s 1080p60 release',
        );

      const outputRoot = resolve(options.dir, 'assets/engineering-hero/v1');
      const copied = new Set<string>();
      for (const entry of release.files) {
        if (!entry || typeof entry !== 'object')
          throw new Error('Malformed engineering hero release entry');
        const { path, bytes, sha256 } = entry as Record<string, unknown>;
        if (
          typeof path !== 'string' ||
          path.includes('\\') ||
          path.startsWith('/') ||
          path.split('/').some((part) => part === '' || part === '.' || part === '..') ||
          !Number.isSafeInteger(bytes) ||
          Number(bytes) < 0 ||
          typeof sha256 !== 'string' ||
          !/^[0-9a-f]{64}$/.test(sha256) ||
          copied.has(path)
        )
          throw new Error(`Unsafe or malformed engineering hero release entry: ${String(path)}`);
        copied.add(path);
        const source = resolve(sourceRoot, path);
        if (!source.startsWith(`${sourceRoot}${sep}`) || !existsSync(source))
          throw new Error(`Engineering hero release file is missing or unsafe: ${path}`);
        const sourceParts = path.split('/');
        let sourceParent = sourceRoot;
        for (const part of sourceParts.slice(0, -1)) {
          sourceParent = resolve(sourceParent, part);
          if (lstatSync(sourceParent).isSymbolicLink())
            throw new Error(`Engineering hero release path contains a symbolic link: ${path}`);
        }
        if (!lstatSync(source).isFile() || lstatSync(source).isSymbolicLink())
          throw new Error(`Engineering hero release file is missing or unsafe: ${path}`);
        const bytesOnDisk = readFileSync(source);
        if (
          bytesOnDisk.byteLength !== bytes ||
          createHash('sha256').update(bytesOnDisk).digest('hex') !== sha256
        )
          throw new Error(`Engineering hero release file failed integrity verification: ${path}`);
        const destination = resolve(outputRoot, path);
        mkdirSync(dirname(destination), { recursive: true });
        writeFileSync(destination, bytesOnDisk);
      }
      const missing = ENGINEERING_HERO_REQUIRED_FILES.filter((name) => !copied.has(name));
      if (missing.length)
        throw new Error(
          `Engineering hero release is missing required files: ${missing.join(', ')}`,
        );
      mkdirSync(outputRoot, { recursive: true });
      copyFileSync(manifestPath, resolve(outputRoot, 'release-media.json'));
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, fileURLToPath(new URL('.', import.meta.url)), 'VITE_');
  const engineeringHeroEnabled = env.VITE_ENGINEERING_HERO === '1';
  return {
    plugins: [
      react(),
      ...(mode === 'demo'
        ? [
            searchPages(),
            ...(engineeringHeroEnabled
              ? [engineeringHeroAssets(fileURLToPath(new URL('../../', import.meta.url)))]
              : []),
            securityHeaders(engineeringHeroEnabled),
          ]
        : []),
    ],
    // One static artifact can live at a custom-domain root or a repository subpath.
    base: mode === 'demo' ? './' : '/',
    cacheDir: process.env.TWIN_VITE_CACHE_DIR,
    publicDir:
      mode === 'demo'
        ? '../../.local/browser-demo-assets'
        : stageLocalEvidenceAssets(
            fileURLToPath(new URL('../../', import.meta.url)),
            ENGINE_VERSION,
          ),
    server: { host: '127.0.0.1', proxy: { '/api': 'http://127.0.0.1:8000' } },
    worker: { format: 'es' },
    build: {
      outDir:
        mode === 'demo'
          ? process.env.TWIN_DEMO_OUT_DIR || '../../.local/browser-demo-site'
          : '../../datacenter_twin/web',
      emptyOutDir: true,
    },
  };
});
