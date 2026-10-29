import assert from 'node:assert/strict';
import { test } from 'node:test';
import { searchPages } from '../seo.ts';

type EmittedFile =
  | { type: 'asset'; fileName: string; source: string | Uint8Array }
  | { type: 'chunk'; id: string; name: string };

type HookContext = {
  emitFile(file: EmittedFile): string;
  getFileName(referenceId: string): string;
};

type SearchPagesPlugin = {
  buildStart(this: HookContext): void;
  generateBundle(this: HookContext): Promise<void>;
  transformIndexHtml(this: HookContext, html: string): string;
};

const template = `<!doctype html><html lang="en"><head><title>Starter</title><meta name="description" content="Starter description"></head><body><!-- PUBLIC_COURSE_LINKS --><main id="root"></main></body></html>`;
let generatedAssets: Promise<{ home: string; files: Map<string, string> }> | undefined;

async function generatePages() {
  if (!generatedAssets) {
    generatedAssets = (async () => {
      const plugin = searchPages() as unknown as SearchPagesPlugin;
      const files = new Map<string, string>();
      let nextReferenceId = 0;
      const context: HookContext = {
        emitFile(file) {
          const referenceId = `reference-${++nextReferenceId}`;
          if (file.type === 'asset')
            files.set(
              file.fileName,
              typeof file.source === 'string'
                ? file.source
                : Buffer.from(file.source).toString('utf8'),
            );
          return referenceId;
        },
        getFileName: () => 'assets/learn-discovery-test.js',
      };
      plugin.buildStart.call(context);
      await plugin.generateBundle.call(context);
      return { home: plugin.transformIndexHtml.call(context, template), files };
    })();
  }
  return generatedAssets;
}

function description(html: string): string {
  return html.match(/<meta\s+name="description"\s+content="([^"]*)"/i)?.[1] ?? '';
}

test('homepage and course catalog expose distinct search descriptions', async () => {
  const generated = await generatePages();
  const catalog = generated.files.get('learn/index.html');
  assert.ok(catalog, 'the static course catalog should be generated');
  assert.notEqual(description(generated.home), description(catalog));
});

test('generated not-found page has a responsive, accessible recovery path', async () => {
  const generated = await generatePages();
  const notFound = generated.files.get('404.html');
  assert.ok(notFound, 'the static not-found page should be generated');
  assert.match(
    notFound,
    /<meta\s+name="viewport"\s+content="width=device-width,\s*initial-scale=1"/i,
  );
  assert.match(notFound, /<main\b[^>]*>[\s\S]*?<h1>Page not found<\/h1>/i);
  assert.match(notFound, /Return to the Datacenter Twin Lab home page/i);
  assert.match(notFound, /a:focus-visible\s*\{/i);
  assert.match(notFound, /<meta\s+name="robots"\s+content="noindex"/i);
});
