import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base: './' keeps every asset path relative so the build works on GitHub Pages
// project sites (https://user.github.io/repo-name/) without 404s.
export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    target: 'es2019',
    chunkSizeWarningLimit: 1200,
  },
});
