import { constants } from 'node:buffer';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const helper = fileURLToPath(new URL('../../scripts/read_regular_file.py', import.meta.url));

/** Read build assets through a native no-follow handle, including on Windows. */
export function readRegularFile(path: string): Buffer {
  const python = process.env.TWIN_PYTHON || (process.platform === 'win32' ? 'python' : 'python3');
  try {
    return execFileSync(python, ['-I', helper, path], {
      // Preserve the Buffer API's size limit rather than execFile's 1 MiB default.
      maxBuffer: constants.MAX_LENGTH,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });
  } catch (error: unknown) {
    const diagnostic =
      error instanceof Error && 'stderr' in error && Buffer.isBuffer(error.stderr)
        ? error.stderr.toString().trim()
        : '';
    const failure: NodeJS.ErrnoException = new Error(
      diagnostic || 'Native file reader could not run; set TWIN_PYTHON to Python 3.12+.',
      { cause: error },
    );
    const nativeCode = /^([A-Z][A-Z0-9_]+): /.exec(diagnostic)?.[1];
    if (nativeCode) failure.code = nativeCode;
    else if (error instanceof Error && 'code' in error && typeof error.code === 'string')
      failure.code = error.code;
    throw failure;
  }
}
