import { inlineMetadataHashes } from './build-html';
import { requiredValue } from './src/required-value';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Plugin } from 'vite';

/** Cloudflare policy and local preview must enforce the same built response headers. */
export function securityHeaders(engineeringHeroEnabled = false): Plugin {
  let output = '';
  let templatePath = '';
  return {
    name: 'static-security-headers',
    configResolved(config) {
      output = resolve(config.root, config.build.outDir);
      templatePath = resolve(config.root, 'public/_headers');
    },
    writeBundle(options) {
      const outputDir = options.dir ? resolve(options.dir) : output;
      const hashes = new Set<string>();
      for (const file of readdirSync(outputDir, { recursive: true })) {
        if (
          typeof file !== 'string' ||
          !file.endsWith('.html') ||
          file.replaceAll('\\', '/') === 'assets/engineering-hero/v1/index.html'
        )
          continue;
        const html = readFileSync(resolve(outputDir, file), 'utf8');
        for (const hash of inlineMetadataHashes(html, file)) hashes.add(hash);
      }
      const template = readFileSync(templatePath, 'utf8').replaceAll('\r\n', '\n');
      let headers = template.replace(
        "script-src 'self' 'unsafe-eval';",
        `script-src 'self' 'unsafe-eval' ${[...hashes].sort().join(' ')};`,
      );
      if (engineeringHeroEnabled) {
        const cspPath = resolve(outputDir, 'assets/engineering-hero/v1/csp.json');
        const csp = JSON.parse(readFileSync(cspPath, 'utf8')) as {
          importMapHash?: unknown;
          suggestedContentSecurityPolicy?: unknown;
        };
        if (
          typeof csp.importMapHash !== 'string' ||
          !/^sha256-[A-Za-z0-9+/]+={0,2}$/.test(csp.importMapHash) ||
          typeof csp.suggestedContentSecurityPolicy !== 'string' ||
          /[\r\n]/.test(csp.suggestedContentSecurityPolicy) ||
          /'unsafe-eval'/i.test(csp.suggestedContentSecurityPolicy) ||
          !csp.suggestedContentSecurityPolicy.includes(`'${csp.importMapHash}'`)
        )
          throw new Error(
            'Engineering hero csp.json is missing a safe import-map-hashed standalone policy',
          );
        for (const path of [
          '/assets/engineering-hero/v1/index.html',
          '/assets/engineering-hero/v1/',
        ]) {
          headers += `\n\n${path}\n  ! Content-Security-Policy\n  ! X-Frame-Options\n  Content-Security-Policy: ${csp.suggestedContentSecurityPolicy}`;
        }
        headers += '\n';
      }
      if (headers.split('\n').some((line) => Buffer.byteLength(line) > 2000))
        throw new Error('Cloudflare header line exceeds 2000 bytes; split the CSP by page.');
      writeFileSync(resolve(outputDir, '_headers'), headers);
    },
    configurePreviewServer(server) {
      server.middlewares.use((_request, response, next) => {
        const global = requiredValue(
          readFileSync(resolve(output, '_headers'), 'utf8').split('\n\n')[0],
          'global response header section',
        );
        for (const line of global.split('\n').slice(1)) {
          const separator = line.indexOf(':');
          if (separator > 0)
            response.setHeader(line.slice(0, separator).trim(), line.slice(separator + 1).trim());
        }
        const pathname = new URL(_request.url || '/', 'http://127.0.0.1').pathname;
        if (
          engineeringHeroEnabled &&
          /(?:^|\/)assets\/engineering-hero\/v1\/(?:index\.html)?$/.test(pathname)
        ) {
          const scopedPath = resolve(output, 'assets/engineering-hero/v1/csp.json');
          const scoped = JSON.parse(readFileSync(scopedPath, 'utf8')) as {
            suggestedContentSecurityPolicy: string;
          };
          response.removeHeader('X-Frame-Options');
          response.setHeader('Content-Security-Policy', scoped.suggestedContentSecurityPolicy);
        }
        next();
      });
    },
  };
}
