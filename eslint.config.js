import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist', 'node_modules', 'data'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    // stdout is the MCP protocol channel: console.log would corrupt it.
    rules: { 'no-console': ['error', { allow: ['error', 'warn'] }] }
  }
);
