import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { readRegularFile } from '../read-regular-file.ts';
import { nativeReaderCase } from './native-reader-fixture.ts';

void test('regular-file reads reject a late same-inode symlink at native acquisition', () => {
  nativeReaderCase('test_late_same_inode_symlink');
});

void test('regular-file reads reject pathname replacement after opening the original inode', () => {
  nativeReaderCase('test_replacement_after_metadata_open');
});

void test('regular-file reads close the descriptor when the pathname disappears during open', () => {
  nativeReaderCase('test_disappearance_after_metadata_open');
});

void test('regular-file reads reject a transient same-inode symlink at acquisition', () => {
  nativeReaderCase('test_transient_same_inode_symlink');
});

void test('native file bridge preserves binary data beyond execFile default limits', (t) => {
  const root = mkdtempSync(join(tmpdir(), 'twin-binary-reader-'));
  t.after(() => {
    rmSync(root, { recursive: true, force: true });
  });
  const file = join(root, 'spaces & literal $(name).bin');
  const content = Buffer.alloc(2 * 1024 * 1024 + 1);
  for (let index = 0; index < content.length; index += 1) content[index] = index % 256;
  writeFileSync(file, content);
  assert.deepEqual(readRegularFile(file), content);
});

void test('native file bridge honors an explicitly configured Python without fallback', (t) => {
  const previous = process.env.TWIN_PYTHON;
  const root = mkdtempSync(join(tmpdir(), 'twin-python-selection-'));
  t.after(() => {
    if (previous === undefined) delete process.env.TWIN_PYTHON;
    else process.env.TWIN_PYTHON = previous;
    rmSync(root, { recursive: true, force: true });
  });
  const file = join(root, 'source');
  writeFileSync(file, 'content');
  process.env.TWIN_PYTHON = join(root, 'missing-python');
  assert.throws(() => readRegularFile(file), /set TWIN_PYTHON to Python 3.12/);
});
