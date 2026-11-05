import { createHash } from 'node:crypto';
import { defaultTreeAdapter, html, parse, serializeOuter } from 'parse5';
import type { DefaultTreeAdapterTypes } from 'parse5';

type Node = DefaultTreeAdapterTypes.Node;
type Element = DefaultTreeAdapterTypes.Element;

function* elements(node: Node): Generator<Element> {
  if (defaultTreeAdapter.isElementNode(node)) yield node;
  if ('childNodes' in node) {
    for (const child of node.childNodes) yield* elements(child);
  }
}

function attribute(element: Element, name: string): string | undefined {
  return element.attrs.find((entry) => entry.name === name)?.value;
}

function isDocumentTitle(element: Element): boolean {
  const parent = element.parentNode;
  return (
    element.namespaceURI === html.NS.HTML &&
    element.tagName === 'title' &&
    parent !== null &&
    defaultTreeAdapter.isElementNode(parent) &&
    parent.namespaceURI === html.NS.HTML &&
    parent.tagName === 'head'
  );
}

/** Extract reading text with HTML's actual raw-text and entity parsing rules. */
export function visiblePageText(source: string): string {
  const tree = parse(source);
  const main = [...elements(tree)].find((element) => element.tagName === 'main') ?? tree;
  const omitted = new Set(['script', 'style', 'svg', 'form', 'button', 'select', 'template']);
  const blocks = new Set([
    'p',
    'div',
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'li',
    'tr',
    'section',
    'article',
    'figure',
    'table',
    'caption',
    'ul',
    'ol',
    'header',
    'footer',
    'main',
    'nav',
    'pre',
    'blockquote',
  ]);
  const text: string[] = [];
  const visit = (node: Node): void => {
    if (defaultTreeAdapter.isTextNode(node)) {
      text.push(node.value);
      return;
    }
    if (defaultTreeAdapter.isElementNode(node)) {
      if (omitted.has(node.tagName)) return;
      if (node.tagName === 'span' && attribute(node, 'class')?.split(/\s+/).includes('sr-only'))
        return;
      if (node.tagName === 'br') text.push('\n');
    }
    if ('childNodes' in node) for (const child of node.childNodes) visit(child);
    if (defaultTreeAdapter.isElementNode(node) && blocks.has(node.tagName)) text.push('\n');
  };
  visit(main);
  return text
    .join('')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Remove only parsed search metadata, preserving all other original source bytes. */
export function removeSearchMetadata(source: string): string {
  const tree = parse(source, { sourceCodeLocationInfo: true });
  const spans: Array<{ startOffset: number; endOffset: number }> = [];
  for (const element of elements(tree)) {
    const metadata =
      isDocumentTitle(element) ||
      (element.tagName === 'script' &&
        attribute(element, 'type')?.trim().toLowerCase() === 'application/ld+json') ||
      (element.tagName === 'meta' &&
        (attribute(element, 'name')?.toLowerCase() === 'description' ||
          attribute(element, 'property')?.toLowerCase().startsWith('og:')));
    if (metadata && element.sourceCodeLocation) spans.push(element.sourceCodeLocation);
  }
  let output = source;
  for (const span of spans.sort((a, b) => b.startOffset - a.startOffset)) {
    output = output.slice(0, span.startOffset) + output.slice(span.endOffset);
  }
  return output;
}

/** Hash exactly the inline metadata the browser parses, rejecting executable scripts. */
export function inlineMetadataHashes(source: string, label: string): string[] {
  const hashes = new Set<string>();
  for (const element of elements(parse(source))) {
    if (element.tagName !== 'script' || attribute(element, 'src') !== undefined) continue;
    const content = element.childNodes
      .filter((node) => defaultTreeAdapter.isTextNode(node))
      .map((node) => node.value)
      .join('');
    if (!content.trim()) continue;
    if (attribute(element, 'type')?.trim().toLowerCase() !== 'application/ld+json') {
      throw new Error(`Unexpected inline script in ${label}`);
    }
    hashes.add(`'sha256-${createHash('sha256').update(content).digest('base64')}'`);
  }
  return [...hashes];
}

/** Append one compiler-owned local module using structured attribute serialization. */
export function appendLocalModuleScript(source: string, path: string): string {
  if (!/^\.\.\/assets\/[A-Za-z0-9._-]+\.js$/.test(path))
    throw new Error('Invalid local module asset path');
  const script = defaultTreeAdapter.createElement('script', html.NS.HTML, [
    { name: 'type', value: 'module' },
    { name: 'src', value: path },
  ]);
  const tree = parse(source, { sourceCodeLocationInfo: true });
  const body = [...elements(tree)].find((element) => element.tagName === 'body');
  const end = body?.sourceCodeLocation?.endTag?.startOffset;
  if (end === undefined) throw new Error('Generated document must have an explicit body end tag');
  return source.slice(0, end) + serializeOuter(script) + source.slice(end);
}

/** Decode the parsed title once, without treating its text as another HTML fragment. */
export function htmlPageTitle(source: string, fallback: string): string {
  const title = [...elements(parse(source))].find(isDocumentTitle);
  return title
    ? title.childNodes
        .filter((node) => defaultTreeAdapter.isTextNode(node))
        .map((node) => node.value)
        .join('')
    : fallback;
}
