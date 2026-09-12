// Node's native TypeScript runner intentionally requires explicit extensions.
// This tiny test-only resolver keeps the source imports compatible with Vite's
// normal extensionless bundling while allowing `node --experimental-strip-types`
// to execute the differential harness directly.
import { access } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('.') && !specifier.endsWith('.ts') && !specifier.endsWith('.mjs')) {
    const candidate = new URL(`${specifier}.ts`, context.parentURL);
    try {
      await access(fileURLToPath(candidate));
      return { url: pathToFileURL(fileURLToPath(candidate)).href, shortCircuit: true };
    } catch {
      // Let Node report the original resolution error for non-source imports.
    }
  }
  return nextResolve(specifier, context);
}
