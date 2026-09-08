import tailwindcss from '@tailwindcss/postcss';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// The game is entirely client-side: no API routes, no server actions, no
// database. A plain static build is all it needs.
export default defineConfig(({ command }) => ({
  // Project pages are served from a sub-path; dev stays at the root.
  base: command === 'build' ? (process.env.PAGES_BASE ?? '/Polar-Bear-BBQ-Game/') : '/',
  root: 'web',
  publicDir: '../public',
  css: { postcss: { plugins: [tailwindcss()] } },
  plugins: [react()],
  build: { outDir: '../dist', emptyOutDir: true },
}));
