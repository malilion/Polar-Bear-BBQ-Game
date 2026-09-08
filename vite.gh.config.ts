import tailwindcss from '@tailwindcss/postcss';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Static build for GitHub Pages. The game is entirely client-side, so the
// vinext/Cloudflare server build is not needed to host it.
export default defineConfig({
  base: process.env.PAGES_BASE ?? '/Polar-Bear-BBQ-Game/',
  root: 'web',
  publicDir: '../public',
  css: { postcss: { plugins: [tailwindcss()] } },
  plugins: [react()],
  build: { outDir: '../gh-dist', emptyOutDir: true },
});
