import reactHooks from 'eslint-plugin-react-hooks'
import tsParser from '@typescript-eslint/parser'

// Minimalna konfiguracja skupiona na REGULACH HOOKOW - wychwytuje bledy typu
// "hook po wczesnym return" (React #310), ktory potrafi wywalic caly widok.
export default [
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: { ecmaFeatures: { jsx: true }, ecmaVersion: 2022, sourceType: 'module' },
    },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
    },
  },
]
