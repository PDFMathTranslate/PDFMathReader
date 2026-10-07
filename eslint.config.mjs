import js from '@eslint/js';
import globals from 'globals';
import vue from 'eslint-plugin-vue';
import prettier from 'eslint-config-prettier';

export default [
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      'dist-pages/**',
      'release/**',
      '.cache/**',
      '.codegraph/**',
      '.cursor/**',
    ],
  },
  js.configs.recommended,
  ...vue.configs['flat/essential'],
  {
    files: ['**/*.{js,mjs,cjs,vue}'],
    languageOptions: { globals: { ...globals.es2025 } },
    rules: {
      // Keep this first rollout focused on correctness and formatting, not dead-code cleanup.
      'no-unused-vars': 'off',
      'no-useless-assignment': 'off',
      'preserve-caught-error': 'off',
      'no-empty': ['error', { allowEmptyCatch: true }],
    },
  },
  {
    // These sanitizers intentionally strip control characters.
    files: ['electron/main.mjs', 'src/features/reader/sidebar-outline.mjs'],
    rules: { 'no-control-regex': 'off' },
  },
  {
    files: [
      'electron/**/*.{mjs,cjs}',
      'server/**/*.mjs',
      'runtime/**/*.mjs',
      'scripts/**/*.mjs',
      '.github/**/*.{mjs,cjs}',
      'tests/**/*.mjs',
      '*.{js,mjs}',
    ],
    languageOptions: { globals: globals.node },
  },
  { files: ['src/App.vue'], rules: { 'vue/multi-word-component-names': 'off' } },

  {
    files: ['src/**/*.{js,mjs,vue}'],
    languageOptions: { globals: { ...globals.browser } },
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              regex: '^(?:node:|electron$)|(?:^|/)(?:electron|server|runtime)/',
              message:
                'Renderer features use shared contracts and the preload bridge, not Node/main/server modules.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['server/**/*.mjs'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              regex: '(?:^|/)(?:src|electron)/|^(?:vue|@macvue/|@fluentui/)',
              message: 'Backend domains must not depend on renderer or desktop UI.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['shared/**/*.mjs'],
    languageOptions: {
      globals: { URL: 'readonly', URLSearchParams: 'readonly', console: 'readonly' },
    },
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              regex:
                '^(?:node:|electron$|vue$|@macvue/|@fluentui/)|(?:^|/)(?:src|electron|server|runtime)/',
              message: 'Shared modules contain only platform-independent contracts and pure logic.',
            },
          ],
        },
      ],
      'no-restricted-globals': [
        'error',
        'window',
        'document',
        'navigator',
        'localStorage',
        'process',
        'Buffer',
        'fetch',
      ],
      'no-restricted-properties': [
        'error',
        ...['window', 'document', 'navigator', 'localStorage', 'process', 'Buffer', 'fetch'].map(
          (property) => ({
            object: 'globalThis',
            property,
            message: 'Pass runtime values into shared functions explicitly.',
          }),
        ),
      ],
    },
  },
  {
    files: ['electron/**/*.mjs'],
    ignores: ['electron/main/backend/backend-process.mjs', 'electron/build/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              regex: '(?:^|/)(?:src|server)/|^(?:vue|@macvue/|@fluentui/)',
              message:
                'Desktop main owns OS services; only the backend process entry crosses into server.',
            },
          ],
        },
      ],
    },
  },
  prettier,
];
