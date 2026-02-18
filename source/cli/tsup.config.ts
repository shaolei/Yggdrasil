import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/bin.ts'],
  format: ['esm'],
  target: 'node22',
  outDir: 'dist',
  clean: true,
  dts: true,
  sourcemap: true,
  splitting: false,
  // Copy templates to dist after build (cross-platform)
  onSuccess: 'node scripts/copy-templates.cjs',
});
