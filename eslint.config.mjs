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
      'src/build-info.mjs',
    ],
  },
  js.configs.recommended,
  ...vue.configs['flat/essential'],
  {
    files: ['**/*.{js,mjs,cjs,vue}'],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
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
    files: ['electron/annotations.mjs', 'electron/main.mjs', 'src/sidebar-navigation.mjs'],
    rules: { 'no-control-regex': 'off' },
  },
  { files: ['src/App.vue'], rules: { 'vue/multi-word-component-names': 'off' } },
  prettier,
];
