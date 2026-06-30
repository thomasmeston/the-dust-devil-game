import { defineConfig } from 'vite';
import { resolve } from 'path';
import { devObjectSavePlugin } from './vite-plugins/devObjectSave';

export default defineConfig({
  base: './',
  plugins: [devObjectSavePlugin()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  server: {
    port: 5173,
    open: true,
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
  },
});
