import { createHash } from 'node:crypto';
import {
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { basename, resolve, sep } from 'node:path';

export function stageLocalEvidenceAssets(root: string, engineVersion: string): string {
  root = realpathSync(root);
  const output = resolve(root, '.local/local-dashboard-assets');
  // Only this generated directory is owned by staging. Never follow a linked
  // parent or output directory when clearing files left by an earlier build.
  if (!output.startsWith(`${root}${sep}`)) throw new Error('Unsafe staging directory');
  for (const path of [resolve(root, '.local'), output]) {
    if (existsSync(path) && (lstatSync(path).isSymbolicLink() || !lstatSync(path).isDirectory()))
      throw new Error(`Unsafe staging directory: ${path}`);
  }
  rmSync(output, { recursive: true, force: true });
  const packet = resolve(root, `data/evidence/v${engineVersion}`);
  const manifestText = readFileSync(resolve(packet, 'manifest.json'), 'utf8').replaceAll(
    '\r\n',
    '\n',
  );
  const manifest = JSON.parse(manifestText);
  if (manifest.engine_version !== engineVersion) throw new Error('Evidence version mismatch');
  const target = resolve(output, `data/evidence/v${engineVersion}`);
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
    resolve(root, `data/evidence/index-v${engineVersion}.json`),
    resolve(output, 'evidence-index.json'),
  );
  for (const name of ['guide-preview.png', 'proof-demo.webm', 'proof-demo.vtt'])
    copyFileSync(resolve(root, 'docs/images', name), resolve(output, name));
  copyFileSync(
    resolve(root, 'apps/web/public/THIRD-PARTY-NOTICES.txt'),
    resolve(output, 'THIRD-PARTY-NOTICES.txt'),
  );
  copyFileSync(resolve(root, 'apps/web/public/favicon.png'), resolve(output, 'favicon.png'));
  return output;
}
