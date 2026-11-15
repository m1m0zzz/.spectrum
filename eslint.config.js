import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import prettier from 'eslint-config-prettier';
import svelte from 'eslint-plugin-svelte';
import globals from 'globals';
import ts from 'typescript-eslint';

export default defineConfig(
  {
    ignores: ['build/', '.svelte-kit/', 'package/']
  },
  js.configs.recommended,
  ts.configs.recommended,
  svelte.configs.recommended,
  prettier,
  svelte.configs.prettier,
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
        // vite.config.ts の define で埋め込む
        __FFMPEG_CORE_VERSION__: 'readonly'
      }
    }
  },
  {
    files: ['**/*.svelte', '**/*.svelte.ts', '**/*.svelte.js'],
    languageOptions: {
      parserOptions: {
        parser: ts.parser,
        extraFileExtensions: ['.svelte']
      }
    },
    // 未定義の名前は svelte-check（TypeScript）が見る。no-undef は型（VideoEncoderConfig など）を知らず誤検出するため、
    // typescript-eslint が .ts で無効にしているのと同じく .svelte でも無効にする
    rules: {
      'no-undef': 'off'
    }
  }
);
