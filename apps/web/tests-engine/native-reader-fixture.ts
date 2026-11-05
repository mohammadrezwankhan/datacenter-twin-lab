import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

/** Execute real filesystem mutations at the helper's native acquisition boundary. */
export function nativeReaderCase(name: string): void {
  execFileSync(
    process.env.TWIN_PYTHON || (process.platform === 'win32' ? 'python' : 'python3'),
    ['-m', 'unittest', `tests.test_read_regular_file.RegularFileTests.${name}`],
    {
      cwd: fileURLToPath(new URL('../../../', import.meta.url)),
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 30_000,
      windowsHide: true,
    },
  );
}
