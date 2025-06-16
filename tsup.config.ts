import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/cli/index.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  sourcemap: true,
  clean: true,
  target: 'es2018',
  onSuccess: 'node scripts/generate-bin.js',
  treeshake: true,
  banner: {
    js: '#!/usr/bin/env node',
  },
});
