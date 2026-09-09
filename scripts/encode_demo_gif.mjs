// Optional documentation tooling; installs no dependencies into the application.
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { readFile, writeFile, copyFile, mkdir, constants } from 'node:fs/promises';
import { resolve } from 'node:path';

const require = createRequire(resolve('.local/recording-tools/package.json'));
const { GIFEncoder, quantize, applyPalette } = require('gifenc');
const { PNG } = require('pngjs');
const source = resolve(process.argv[2] || '.local/demo-recording');
const target = resolve(process.argv[3] || resolve(source, 'encoded'));
const manifest = JSON.parse(await readFile(resolve(source, 'recording.json'), 'utf8'));
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const gif = GIFEncoder();
for (const frame of manifest.frames) {
  const bytes = await readFile(resolve(source, frame.path));
  if (hash(bytes) !== frame.sha256) throw new Error(`Frame hash mismatch: ${frame.path}`);
  const { data, width, height } = PNG.sync.read(bytes);
  const palette = quantize(data, 256);
  gif.writeFrame(applyPalette(data, palette), width, height, { palette, delay: frame.delay_ms });
}
gif.finish();
const output = gif.bytes();
await mkdir(target, { recursive: true });
await writeFile(resolve(target, 'demo-walkthrough.gif'), output, { flag: 'wx' });
await copyFile(resolve(source, manifest.frames[0].path), resolve(target, 'demo-preview.png'), constants.COPYFILE_EXCL);
await writeFile(resolve(target, 'demo-walkthrough.json'), JSON.stringify({ ...manifest,
  gif_sha256: hash(output), gif_bytes: output.length,
  encoding: { gifenc: '1.0.3', pngjs: '7.0.0', colors_per_frame: 256 },
}, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ gif_bytes: output.length, duration_ms: manifest.frames.reduce((sum, f) => sum + f.delay_ms, 0) }));
