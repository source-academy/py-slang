import tseslint from 'typescript-eslint'
import { defineConfig } from 'eslint/config'
import eslintConfigPrettierFlat from 'eslint-config-prettier/flat'

export default defineConfig([
  {
    // global ignores
    ignores: ['dist', 'docs', 'node_modules']
  },
  tseslint.configs.recommended,
  eslintConfigPrettierFlat,
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        projectService: {
          allowDefaultProject: ['src/tests/*.ts']
        }
      }
    },
    plugins: {
      '@typescript-eslint': tseslint.plugin
    },
    rules: {
      '@typescript-eslint/no-namespace': 'off',
      '@typescript-eslint/ban-ts-comment': 'warn',
      '@typescript-eslint/no-import-type-side-effects': 'error',
      '@typescript-eslint/no-unnecessary-type-assertion': 'error',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/require-await': 'error',
      '@typescript-eslint/return-await': ['error', 'in-try-catch']
    }
  },
  {
    files: ['src/**/*.js'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off'
    }
  }
])
