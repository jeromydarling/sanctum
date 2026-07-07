import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@sanctum/shared': path.resolve(__dirname, '../../packages/shared/src/index.ts'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:8787',
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        // Split heavy vendors into cacheable chunks so the initial payload stays
        // lean. recharts (~350KB) only loads with the Analytics route; the React
        // and Sentry runtimes are cached across deploys instead of re-downloaded.
        manualChunks(id: string) {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('recharts') || id.includes('/d3-') || id.includes('victory')) return 'charts';
          if (id.includes('@sentry')) return 'sentry';
          if (id.includes('react-dom') || id.includes('react-router') || id.includes('/scheduler/')) return 'react-vendor';
          return 'vendor';
        },
      },
    },
  },
});
