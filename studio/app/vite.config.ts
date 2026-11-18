import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// The studio server serves the built app from /editor, so every asset path starts there.
export default defineConfig({
  base: '/editor/',
  plugins: [react()],
  build: { outDir: 'dist', emptyOutDir: true },
  test: { environment: 'node', include: ['src/**/*.test.{ts,tsx}'] },
});
