import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const typedFiles = ['**/*.{ts,tsx,mts,cts}'];
const sourceFiles = ['**/*.{js,mjs,cjs,jsx,ts,tsx,mts,cts}'];

export default [
  {
    // Build outputs and dependency trees are scanned by the security gates.
    // Lint their maintained source rather than compiler-generated copies.
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/vendor/**',
      '**/.venv/**',
      '**/venv/**',
      '**/.security-tools/**',
      '**/hardening-artifacts/**',
      '**/.local/**',
      '**/.qa/**',
      '**/.runtime_deps/**',
      '**/.hallmark/**',
      '**/.cloudflare/**',
      '**/_site/**',
      '**/datacenter_twin/web/**',
    ],
  },
  {
    ...js.configs.recommended,
    files: ['**/*.{js,mjs,cjs,jsx}'],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
  },
  ...tseslint.configs.strictTypeChecked.map((config) => ({
    ...config,
    files: typedFiles,
  })),
  {
    files: typedFiles,
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
      parserOptions: { project: ['./tsconfig.eslint.json'], tsconfigRootDir: import.meta.dirname },
    },
  },
  {
    files: sourceFiles,
    linterOptions: { reportUnusedDisableDirectives: 'error' },
    rules: {
      'no-eval': 'error',
      'no-new-func': 'error',
      'no-implied-eval': 'error',
      'no-restricted-syntax': [
        'error',
        {
          selector: 'AssignmentExpression[left.property.name=/^(innerHTML|outerHTML)$/]',
          message: 'Use DOM builders and textContent instead of HTML assignment.',
        },
        {
          selector: 'AssignmentExpression[left.property.value=/^(innerHTML|outerHTML)$/]',
          message: 'Use DOM builders and textContent instead of computed HTML assignment.',
        },
        {
          selector: 'CallExpression[callee.property.name="insertAdjacentHTML"]',
          message: 'Use DOM builders and insertAdjacentElement.',
        },
        {
          selector: 'CallExpression[callee.property.value="insertAdjacentHTML"]',
          message: 'Use DOM builders and insertAdjacentElement.',
        },
      ],
    },
  },
];
