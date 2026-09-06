import { defineConfig } from 'vite';

export default defineConfig({
  base: '/kaia-kitchen/',
  publicDir: 'public',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
