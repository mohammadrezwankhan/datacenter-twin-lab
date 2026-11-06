import { execFileSync } from 'node:child_process';
import type { TestContext } from 'node:test';
import { fileURLToPath } from 'node:url';

/** Execute real filesystem mutations at the helper's native acquisition boundary. */
export function nativeReaderCase(name: string, context: TestContext): void {
  const output = execFileSync(
    process.env.TWIN_PYTHON || (process.platform === 'win32' ? 'python' : 'python3'),
    [
      '-c',
      [
        'import json, sys, unittest',
        'suite = unittest.defaultTestLoader.loadTestsFromName(sys.argv[1])',
        'result = unittest.TextTestRunner(verbosity=2).run(suite)',
        'print(json.dumps([reason for _, reason in result.skipped]))',
        'sys.exit(not result.wasSuccessful())',
      ].join('\n'),
      `tests.test_read_regular_file.RegularFileTests.${name}`,
    ],
    {
      cwd: fileURLToPath(new URL('../../../', import.meta.url)),
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 30_000,
      windowsHide: true,
      encoding: 'utf8',
    },
  );
  const skipped: unknown = JSON.parse(output);
  if (!Array.isArray(skipped) || !skipped.every((reason: unknown) => typeof reason === 'string')) {
    throw new Error('Invalid native unittest skip report');
  }
  if (skipped.length > 0) context.skip(skipped.join('; '));
}
