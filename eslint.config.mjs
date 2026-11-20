import js from '@eslint/js';
import globals from 'globals';

export default [
  { ignores: ['src/vendor/**', 'dist/**', 'node_modules/**'] },
  js.configs.recommended,
  {
    // данные клиники: объявляют глобальный CONFIG
    files: ['src/config.js'],
    languageOptions: { ecmaVersion: 2022, sourceType: 'script', globals: globals.browser },
    rules: { 'no-unused-vars': ['error', { varsIgnorePattern: '^CONFIG$' }] },
  },
  {
    files: ['src/js/main.js', 'src/card/card.js'],
    languageOptions: { ecmaVersion: 2022, sourceType: 'script', globals: { ...globals.browser, CONFIG: 'readonly' } },
  },
  {
    files: ['src/js/*.js'],
    ignores: ['src/js/main.js'],
    languageOptions: { ecmaVersion: 2022, sourceType: 'module', globals: globals.browser },
  },
  {
    files: ['tools/**/*.js', 'tests/**/*.js'],
    languageOptions: { ecmaVersion: 2022, sourceType: 'commonjs', globals: globals.node },
  },
];
