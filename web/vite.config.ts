import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  const apiProxy = env.HALO_API_PROXY || 'http://localhost:7310';

  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': new URL('./src', import.meta.url).pathname,
      },
    },
    server: {
      port: 5173,
      proxy: {
        '/api': apiProxy,
      },
    },
    build: {
      outDir: 'dist',
      emptyOutDir: true,
    },
  };
});
