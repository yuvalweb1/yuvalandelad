import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { spawn } from 'child_process';

function capSyncPlugin() {
  return {
    name: 'cap-sync',
    closeBundle() {
      // Skip Capacitor sync when SKIP_CAP_SYNC=1. The production server runs
      // `npm run build` to produce dist/ but doesn't need (and on Node < 22
      // can't run) the Capacitor CLI step that mirrors web assets into ios/
      // and android/ native projects.
      if (process.env.SKIP_CAP_SYNC === '1') return;
      spawn('npx', ['cap', 'sync'], { stdio: 'inherit', shell: true });
    },
  };
}

export default defineConfig({
  plugins: [react(), capSyncPlugin()],
  base: './',
  server: {
    port: 5173,
    open: true,
    watch: {
      ignored: ['**/ios/**', '**/android/**'],
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
});
