import { closeSync, constants, fstatSync, lstatSync, openSync, readFileSync } from 'node:fs';

/** Validate and read the same open file, without reopening a checked pathname. */
export function readRegularFile(path: string): Buffer {
  const expected = lstatSync(path, { bigint: true });
  if (!expected.isFile()) throw new Error(`Expected a regular file: ${path}`);
  // These flags are unavailable on Windows. The pathname/descriptor identity
  // checks also protect reads on platforms without them.
  const optionalFlags: Partial<Record<'O_NOFOLLOW' | 'O_NONBLOCK', number>> = constants;
  const descriptor = openSync(
    path,
    constants.O_RDONLY | (optionalFlags.O_NOFOLLOW ?? 0) | (optionalFlags.O_NONBLOCK ?? 0),
  );
  try {
    const actual = fstatSync(descriptor, { bigint: true });
    if (!actual.isFile()) throw new Error(`Expected a regular file: ${path}`);
    if (actual.dev !== expected.dev || actual.ino !== expected.ino) {
      throw new Error(`File changed while opening: ${path}`);
    }
    // Also reject a pathname replaced or removed during open, including a
    // symlink to the original inode on platforms without O_NOFOLLOW. This
    // recheck catches observed substitutions; it does not make opening atomic.
    const current = lstatSync(path, { bigint: true });
    if (!current.isFile()) throw new Error(`Expected a regular file: ${path}`);
    if (current.dev !== actual.dev || current.ino !== actual.ino) {
      throw new Error(`File changed while opening: ${path}`);
    }
    return readFileSync(descriptor);
  } finally {
    closeSync(descriptor);
  }
}
