import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';
import { defineConfig, globalIgnores } from 'eslint/config';

// Custom rules for better code quality
const customRules = {
  // TypeScript specific
  '@typescript-eslint/no-explicit-any': 'warn',
  '@typescript-eslint/no-unused-vars': ['error', { 
    argsIgnorePattern: '^_',
    varsIgnorePattern: '^_',
    ignoreRestSiblings: true 
  }],
  '@typescript-eslint/explicit-function-return-type': 'off',
  '@typescript-eslint/explicit-module-boundary-types': 'off',
  '@typescript-eslint/consistent-type-imports': ['error', {
    prefer: 'type-imports',
    fixStyle: 'inline-type-imports',
  }],
  '@typescript-eslint/no-non-null-assertion': 'warn',
  '@typescript-eslint/no-empty-interface': 'warn',
  '@typescript-eslint/ban-ts-comment': 'warn',
  
  // React specific
  'react-hooks/rules-of-hooks': 'error',
  'react-hooks/exhaustive-deps': 'warn',
  'react-refresh/only-export-components': ['warn', { 
    allowConstantExport: true,
    allowExportNames: ['metadata', 'manifest'],
  }],
  
  // JavaScript/General
  'no-console': ['warn', { allow: ['warn', 'error', 'info'] }],
  'no-debugger': 'warn',
  'no-alert': 'warn',
  'prefer-const': 'error',
  'no-var': 'error',
  'eqeqeq': ['error', 'always'],
  'curly': ['error', 'all'],
  'no-unused-expressions': 'error',
  'no-useless-return': 'error',
  'no-useless-escape': 'warn',
  'no-empty': ['error', { allowEmptyCatch: true }],
  'no-duplicate-imports': 'error',
  'no-extra-semi': 'error',
};

export default defineConfig([
  // Global ignores
  globalIgnores([
    'dist',
    'build',
    'node_modules',
    'coverage',
    '.git',
    '.vscode',
    '.idea',
    '*.config.js',
    '*.config.ts',
    '*.config.cjs',
    '*.config.mjs',
    'capacitor.config.ts',
  ]),
  
  // Main configuration
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.es2020,
        ...globals.node,
        ...globals.serviceworker,
      },
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    linterOptions: {
      reportUnusedDisableDirectives: true,
    },
    settings: {
      react: {
        version: 'detect',
      },
      'import/resolver': {
        typescript: {
          project: './tsconfig.json',
        },
      },
    },
    rules: customRules,
  },
  
  // Test files specific rules
  {
    files: ['**/*.{test,spec}.{ts,tsx}', '**/test/**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      'no-console': 'off',
      'react-hooks/rules-of-hooks': 'off',
    },
  },
  
  // Configuration files specific rules
  {
    files: ['*.config.{js,ts}', 'vite.config.ts', 'capacitor.config.ts'],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
]);