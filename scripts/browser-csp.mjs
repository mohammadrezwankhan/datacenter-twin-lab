import { createHash } from 'node:crypto';
import { readFile, writeFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Hash exact inline bytes after browser HTML newline normalization.
 * @param {string} html
 * @returns {string}
 */
export function browserPolicy(html) {
  /** @type {{script: string[], style: string[]}} */
  const hashes = { script: [], style: [] };
  for (const match of html.matchAll(/<(script|style)\b([^>]*)>([\s\S]*?)<\/\1\s*>/gi)) {
    const [, tag, attributes, content] = match;
    if (tag === undefined || attributes === undefined || content === undefined)
      throw new Error('Incomplete inline element capture.');
    const kind = tag.toLowerCase();
    if (kind !== 'script' && kind !== 'style') throw new Error('Unexpected inline element.');
    if (
      kind === 'script' &&
      (/\bsrc\s*=/i.test(attributes) ||
        /\btype\s*=\s*["']application\/(?:ld\+)?json["']/i.test(attributes))
    )
      continue;
    hashes[kind].push(
      "'sha256-" +
        createHash('sha256').update(content.replace(/\r\n?/g, '\n')).digest('base64') +
        "'",
    );
  }
  /** @param {'script' | 'style'} kind */
  const source = (kind) => ["'self'", ...new Set(hashes[kind])].join(' ');
  return (
    "default-src 'none'; base-uri 'none'; object-src 'none'; form-action 'none'; script-src " +
    source('script') +
    "; script-src-attr 'none'; style-src " +
    source('style') +
    "; style-src-attr 'none'; img-src 'self' data: blob:; font-src 'self'; media-src 'self'; frame-src 'self'; connect-src 'self'; worker-src 'self'; manifest-src 'self'"
  );
}
const metaPattern = /<meta\b[^>]*http-equiv=["']Content-Security-Policy["'][^>]*>/i;
const documentPattern = /<(?:!doctype(?=[\t\n\f\r >])|\/?(?:html|head|body)(?=[\t\n\f\r />]))/i;

/**
 * Accept only inert whitespace and ordinary comments before the generated policy.
 * Ambiguous HTML comment endings must not hide an executable browser token.
 * @param {string} html
 * @param {number} start
 * @returns {number}
 */
function skipPolicyWhitespace(html, start) {
  let offset = start;
  while (true) {
    while (/[\t\n\f\r ]/.test(html.charAt(offset))) offset += 1;
    if (!html.startsWith('<!--', offset)) return offset;
    const end = html.indexOf('-->', offset + 4);
    const comment = html.slice(offset + 4, end);
    if (end < 0 || comment.includes('--') || /^(?:>|->)/.test(comment))
      throw new Error('Only ordinary HTML comments may appear before the CSP policy.');
    offset = end + 3;
  }
}

/**
 * Read the restricted, quoted-attribute-aware document prefix, not arbitrary HTML.
 * Unknown/malformed prefixes fail closed instead of emulating browser repair.
 * @param {string} html
 * @param {number} offset
 * @returns {{name: string, end: number} | null}
 */
function documentStartTag(html, offset) {
  const match =
    /^<(html|head)(?=[\t\n\f\r />])((?:[\t\n\f\r ]+[A-Za-z_:][A-Za-z0-9_.:-]*(?:[\t\n\f\r ]*=[\t\n\f\r ]*(?:"[^"]*"|'[^']*'|[^\t\n\f\r "'`=<>]+))?)*[\t\n\f\r ]*)\/?>/i.exec(
      html.slice(offset),
    );
  if (!match) return null;
  const [, name, attributes] = match;
  if (name === undefined || attributes === undefined)
    throw new Error('Incomplete document prefix capture.');
  for (const attribute of attributes.matchAll(
    /[A-Za-z_:][A-Za-z0-9_.:-]*(?:[\t\n\f\r ]*=[\t\n\f\r ]*(?:"[^"]*"|'[^']*'|[^\t\n\f\r "'`=<>]+))?/g,
  )) {
    const attributeName = attribute[0].split(/[\t\n\f\r =]/, 1)[0];
    if (attributeName === undefined) throw new Error('Incomplete document attribute capture.');
    if (/^(?:on[a-z]+|style|manifest|profile|src|srcset|href|background)$/i.test(attributeName))
      throw new Error('Executable or resource attributes cannot appear before the CSP policy.');
  }
  return { name: name.toLowerCase(), end: offset + match[0].length };
}

/**
 * Full documents must have an explicit head before any executable/resource content.
 * Headless article fragments retain their containing document's policy.
 * @param {string} html
 * @returns {number | null}
 */
function documentHeadEnd(html) {
  if (!documentPattern.test(html)) return null;
  const invalid = 'Complete HTML documents require an explicit <head> before page content.';
  let offset = skipPolicyWhitespace(html, html.startsWith('\ufeff') ? 1 : 0);
  if (/^<!doctype\b/i.test(html.slice(offset))) {
    const doctype = /^<!doctype[\t\n\f\r ]+html[\t\n\f\r ]*>/i.exec(html.slice(offset));
    if (!doctype) throw new Error(invalid);
    offset = skipPolicyWhitespace(html, offset + doctype[0].length);
  }
  let tag = documentStartTag(html, offset);
  if (tag?.name === 'html') {
    offset = skipPolicyWhitespace(html, tag.end);
    tag = documentStartTag(html, offset);
  }
  if (tag?.name !== 'head') throw new Error(invalid);
  return tag.end;
}

/** @param {string} html @returns {string} */
export function withBrowserPolicy(html) {
  const headEnd = documentHeadEnd(html);
  if (headEnd === null) return html;
  const meta = '<meta http-equiv="Content-Security-Policy" content="' + browserPolicy(html) + '">';
  const existing = metaPattern.exec(html.slice(headEnd));
  if (existing) {
    const start = headEnd + existing.index;
    if (start !== skipPolicyWhitespace(html, headEnd))
      throw new Error(
        'CSP meta must be the first element inside <head>, before executable or resource content.',
      );
    return html.slice(0, start) + meta + html.slice(start + existing[0].length);
  }
  return html.slice(0, headEnd) + '\n' + meta + html.slice(headEnd);
}
/**
 * Inspect original start tags, skipping comments and HTML raw/text-only bodies by
 * their offsets. No HTML is removed or reconstructed for this inspection.
 * @param {string} html
 * @returns {string[]}
 */
function policyStartTags(html) {
  const tags = [];
  const textOnly = new Set([
    'script',
    'style',
    'title',
    'textarea',
    'xmp',
    'iframe',
    'noembed',
    'noframes',
    'noscript',
  ]);
  let offset = 0;
  while (offset < html.length) {
    const start = html.indexOf('<', offset);
    if (start < 0) break;
    if (html.startsWith('<!--', start)) {
      const end = html.indexOf('-->', start + 4);
      const comment = html.slice(start + 4, end);
      if (end < 0 || comment.includes('--!>') || /^(?:>|->)/.test(comment))
        throw new Error('Ambiguous HTML comment in policy inspection.');
      offset = end + 3;
      continue;
    }
    const doctype = /^<!doctype[\t\n\f\r ]+html[\t\n\f\r ]*>/i.exec(html.slice(start));
    if (doctype) {
      offset = start + doctype[0].length;
      continue;
    }
    const match =
      /^<\/?([A-Za-z][A-Za-z0-9:_-]*)(?=[\t\n\f\r />])(?:[^"'<>]|"[^"]*"|'[^']*')*>/.exec(
        html.slice(start),
      );
    if (!match) {
      if (/[A-Za-z/!?]/.test(html.charAt(start + 1)))
        throw new Error('Malformed HTML tag in policy inspection.');
      offset = start + 1;
      continue;
    }
    const name = match[1]?.toLowerCase();
    if (!name) throw new Error('Incomplete policy tag capture.');
    offset = start + match[0].length;
    if (html.startsWith('</', start)) continue;
    tags.push(match[0]);
    if (name === 'plaintext') break;
    if (!textOnly.has(name)) continue;
    const closing =
      /<\/(script|style|title|textarea|xmp|iframe|noembed|noframes|noscript)(?=[\t\n\f\r />])(?:[^"'<>]|"[^"]*"|'[^']*')*>/gi;
    closing.lastIndex = offset;
    let end;
    while ((end = closing.exec(html))) {
      if (end[1]?.toLowerCase() === name) break;
    }
    if (!end) throw new Error('Unclosed raw text element in policy inspection: ' + name);
    offset = closing.lastIndex;
  }
  return tags;
}

/** @param {string} html @returns {string[]} */
export function policyIssues(html) {
  let updated;
  try {
    updated = withBrowserPolicy(html);
  } catch (error) {
    if (error instanceof Error) return [error.message];
    throw error;
  }
  if (!documentPattern.test(html)) return [];
  const issues = [];
  if (updated !== html)
    issues.push(
      'CSP is missing or inline hashes are stale; run browser-csp.mjs --write on this file.',
    );
  let tags;
  try {
    tags = policyStartTags(html);
  } catch (error) {
    if (!(error instanceof Error)) throw error;
    issues.push(error.message);
    return issues;
  }
  for (const tag of tags) {
    if (/\s(?:on[a-z]+|style)\s*=/i.test(tag))
      issues.push('Inline event/style attribute: ' + tag.slice(0, 100));
    if (/\b(?:src|href)\s*=\s*["']javascript:/i.test(tag)) issues.push('Executable URL attribute.');
  }
  return issues;
}
/** @param {string} directory @returns {Promise<string[]>} */
async function htmlFiles(directory) {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return [];
    throw error;
  }
  const nested = await Promise.all(
    entries.map((entry) =>
      entry.isDirectory()
        ? htmlFiles(path.join(directory, entry.name))
        : entry.name.endsWith('.html')
          ? [path.join(directory, entry.name)]
          : [],
    ),
  );
  return nested.flat();
}
/** @param {string} root @returns {Promise<{files: number, failures: string[]}>} */
export async function checkDocuments(root) {
  const files = await htmlFiles(path.join(root, 'docs')),
    failures = [];
  if (files.length === 0) throw new Error('No HTML documents found for the required policy gate.');
  for (const file of files) {
    for (const issue of policyIssues(await readFile(file, 'utf8')))
      failures.push(path.relative(root, file) + ': ' + issue);
  }
  return { files: files.length, failures };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const write = process.argv[2] === '--write',
    args = process.argv.slice(write ? 3 : process.argv[2] === '--check' ? 3 : 2);
  if (write && !args.length) throw Error('Specify the HTML files to regenerate.');
  if (write) {
    for (const file of args) {
      const html = await readFile(file, 'utf8');
      await writeFile(file, withBrowserPolicy(html));
    }
    console.log('Updated CSP for ' + args.length + ' HTML files.');
  } else {
    const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
    const result = args.length
      ? {
          files: args.length,
          failures: (
            await Promise.all(
              args.map(async (file) =>
                policyIssues(await readFile(file, 'utf8')).map((issue) => file + ': ' + issue),
              ),
            )
          ).flat(),
        }
      : await checkDocuments(root);
    console.log(JSON.stringify(result, null, 2));
    if (result.failures.length) process.exitCode = 1;
  }
}
