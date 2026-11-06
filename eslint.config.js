import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.expo/**',
      '**/.temp/**',
      '**/android/**',
      '**/ios/**',
      '**/coverage/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.node,
        ...globals.es2022,
      },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
      'no-console': 'off',
      eqeqeq: ['error', 'smart'],
      'prefer-const': 'error',
    },
  },
  {
    // Metro ve Jest yapılandırma dosyaları sözleşme gereği CommonJS'tir.
    files: ['**/metro.config.js', '**/jest.config.js'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
  {
    // Testler modül önbelleğini temizleyip yeniden yüklemek için `require` kullanır.
    files: ['**/__tests__/**/*.ts', '**/__tests__/**/*.tsx'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
  {
    files: ['supabase/functions/**/*.ts', 'tests/**/*.ts'],
    languageOptions: {
      globals: {
        Deno: 'readonly',
      },
    },
  },
  {
    files: ['apps/mobile/**/*.{ts,tsx}'],
    languageOptions: {
      globals: {
        ...globals.es2022,
        __DEV__: 'readonly',
        process: 'readonly',
        jest: 'readonly',
        console: 'readonly',
      },
    },
    rules: {
      'no-undef': 'off',
    },
  },
);