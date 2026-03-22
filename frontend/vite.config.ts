import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import wasm from 'vite-plugin-wasm';

const base = process.env.VITE_BASE_PATH || '/wasm-test/';

export default defineConfig({
  plugins: [
    vue(),
    wasm(),
  ],
  base,
  worker: {
    format: 'es'
  },
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
  optimizeDeps: {
    exclude: ['wasm-benchmark']
  }
});