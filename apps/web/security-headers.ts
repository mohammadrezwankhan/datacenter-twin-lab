import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Plugin } from 'vite';

/** Cloudflare policy and local preview must enforce the same built response headers. */
export function securityHeaders(): Plugin {
  let output = '';
  let templatePath = '';
  return {
    name: 'static-security-headers',
    configResolved(config) {
      output = resolve(config.root, config.build.outDir);
      templatePath = resolve(config.root, 'public/_headers');
    },
    closeBundle() {
      const hashes = new Set<string>();
      for (const file of readdirSync(output, { recursive: true })) {
        if (typeof file !== 'string' || !file.endsWith('.html')) continue;
        const html = readFileSync(resolve(output, file), 'utf8');
        for (const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
          if (/\bsrc\s*=/.test(match[1]) || !match[2].trim()) continue;
          // Only generated structured metadata may be inline; executable code stays in assets.
          if (!/\btype=["']application\/ld\+json["']/.test(match[1]))
            throw new Error(`Unexpected inline script in ${file}`);
          hashes.add(`'sha256-${createHash('sha256').update(match[2]).digest('base64')}'`);
        }
      }
      const template = readFileSync(templatePath, 'utf8').replaceAll('\r\n', '\n');
      const headers = template.replace(
        "script-src 'self' 'unsafe-eval';",
        `script-src 'self' 'unsafe-eval' ${[...hashes].sort().join(' ')};`,
      );
      if (headers.split('\n').some((line) => Buffer.byteLength(line) > 2000))
        throw new Error('Cloudflare header line exceeds 2000 bytes; split the CSP by page.');
      writeFileSync(resolve(output, '_headers'), headers);
    },
    configurePreviewServer(server) {
      server.middlewares.use((_request, response, next) => {
        const global = readFileSync(resolve(output, '_headers'), 'utf8').split('\n\n')[0];
        for (const line of global.split('\n').slice(1)) {
          const separator = line.indexOf(':');
          if (separator > 0)
            response.setHeader(line.slice(0, separator).trim(), line.slice(separator + 1).trim());
        }
        next();
      });
    },
  };
}
