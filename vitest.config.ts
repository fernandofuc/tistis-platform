import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'node',
    include: ['**/__tests__/**/*.test.ts', '**/__tests__/**/*.test.tsx'],
    exclude: ['node_modules', 'dist', '.next'],
    // Use jsdom for React component tests (.tsx files)
    environmentMatchGlobs: [
      ['**/__tests__/**/*.test.tsx', 'jsdom'],
    ],
    setupFiles: ['./vitest.setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      exclude: [
        'node_modules/**',
        '**/__tests__/**',
        '**/*.d.ts',
      ],
    },
    testTimeout: 10000,
  },
  resolve: {
    alias: {
      // Match Jest's moduleNameMapper for path aliases
      // More specific paths first
      '@/shared': path.resolve(__dirname, './src/shared'),
      '@/features': path.resolve(__dirname, './src/features'),
      '@/src/shared': path.resolve(__dirname, './src/shared'),
      '@/src/features': path.resolve(__dirname, './src/features'),
      '@/src': path.resolve(__dirname, './src'),
      // Root-level directories
      '@/lib': path.resolve(__dirname, './lib'),
      '@/components': path.resolve(__dirname, './components'),
      '@/app': path.resolve(__dirname, './app'),
      '@/hooks': path.resolve(__dirname, './src/hooks'),
      '@/utils': path.resolve(__dirname, './src/utils'),
      '@/types': path.resolve(__dirname, './src/types'),
      // Fallback to root
      '@': path.resolve(__dirname, '.'),
    },
  },
});
