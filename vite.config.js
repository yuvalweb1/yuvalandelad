import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { spawn } from 'child_process';

function capSyncPlugin() {
  return {
    name: 'cap-sync',
    closeBundle() {
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
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
});
