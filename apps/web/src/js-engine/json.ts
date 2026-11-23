import { LosslessNumber, parse } from 'lossless-json';

const integerToken = /^-?(?:0|[1-9]\d*)$/;

type ObjectScope = { keys: Set<string> } | null;

function rejectDuplicateKeys(text: string): void {
  const scopes: ObjectScope[] = [];
  for (let index = 0; index < text.length;) {
    const character = text[index];
    if (character === '"') {
      const start = index++;
      while (index < text.length) {
        if (text[index] === '\\') {
          index += 2;
          continue;
        }
        if (text[index++] === '"') break;
      }
      const literal = text.slice(start, index);
      let following = index;
      while (/\s/.test(text[following] ?? '')) following += 1;
      const scope = scopes[scopes.length - 1];
      if (text[following] === ':' && scope !== null && scope !== undefined) {
        const key: unknown = JSON.parse(literal);
        if (typeof key !== 'string') throw new SyntaxError('Invalid JSON object key');
        if (scope.keys.has(key)) throw new SyntaxError(`Duplicate JSON field: ${key}`);
        scope.keys.add(key);
      }
      continue;
    }
    if (character === '{') scopes.push({ keys: new Set() });
    else if (character === '[') scopes.push(null);
    else if (character === '}' || character === ']') scopes.pop();
    index += 1;
  }
}

/** Parse JSON without rounding decimals or accepting duplicate object keys. */
export function parseLosslessJson(text: string): unknown {
  const source = text.startsWith('\uFEFF') ? text.slice(1) : text;
  const document = parse(source, undefined, {
    parseNumber(value) {
      if (integerToken.test(value)) {
        const integer = Number(value);
        if (Number.isSafeInteger(integer)) return integer;
      }
      return new LosslessNumber(value);
    },
  });
  rejectDuplicateKeys(source);
  return document;
}
