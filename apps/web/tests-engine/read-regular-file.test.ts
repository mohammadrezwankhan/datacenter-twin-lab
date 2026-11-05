import assert from 'node:assert/strict';
import fs, { mkdtempSync, renameSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test, { type TestContext } from 'node:test';
import { readRegularFile } from '../read-regular-file.ts';

interface OpenMutation {
  before?: () => void;
  after?: () => void;
  portable?: boolean;
}

function fixture(t: TestContext): { source: string; original: string } {
  const root = mkdtempSync(join(tmpdir(), 'twin-post-open-file-'));
  t.after(() => {
    rmSync(root, { recursive: true, force: true });
  });
  const source = join(root, 'source');
  writeFileSync(source, 'original content');
  return { source, original: join(root, 'original') };
}

function rejectedRead(
  t: TestContext,
  source: string,
  mutation: OpenMutation,
  expectedError: RegExp,
): void {
  const realOpen = fs.openSync;
  let descriptor: number | undefined;
  // Mutate real filesystem entries at the open boundary. File bytes and stat
  // results are never mocked, including when optional POSIX flags are removed.
  const opening = t.mock.method(fs, 'openSync', (...args: Parameters<typeof fs.openSync>) => {
    if (args[0] !== source) return realOpen(...args);
    mutation.before?.();
    const [path, flags, mode] = args;
    const openFlags =
      mutation.portable && typeof flags === 'number'
        ? flags & ~(fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK)
        : flags;
    descriptor = realOpen(path, openFlags, mode);
    mutation.after?.();
    return descriptor;
  });
  const contentReads = t.mock.method(fs, 'readFileSync');
  syncBuiltinESMExports();
  t.after(() => {
    opening.mock.restore();
    contentReads.mock.restore();
    syncBuiltinESMExports();
  });

  assert.throws(() => readRegularFile(source), expectedError);
  assert.equal(contentReads.mock.calls.length, 0, 'No content read may precede rejection');
  assert.equal(typeof descriptor, 'number');
  if (descriptor === undefined) throw new Error('The file was not opened');
  const openedDescriptor = descriptor;
  assert.throws(() => fs.fstatSync(openedDescriptor), /EBADF/);
}

void test('regular-file reads reject a late same-inode symlink without optional open flags', (t) => {
  const { source, original } = fixture(t);
  rejectedRead(
    t,
    source,
    {
      before() {
        renameSync(source, original);
        symlinkSync(original, source);
      },
      portable: true,
    },
    /regular file/,
  );
});

void test('regular-file reads reject pathname replacement after opening the original inode', (t) => {
  const { source, original } = fixture(t);
  rejectedRead(
    t,
    source,
    {
      after() {
        renameSync(source, original);
        writeFileSync(source, 'replacement content');
      },
    },
    /changed while opening/,
  );
});

void test('regular-file reads close the descriptor when the pathname disappears during open', (t) => {
  const { source, original } = fixture(t);
  rejectedRead(
    t,
    source,
    {
      after() {
        renameSync(source, original);
      },
    },
    /ENOENT/,
  );
});
