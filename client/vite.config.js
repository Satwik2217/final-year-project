// Vite config — React dev server on port 3000 with REACT_APP_ env prefix.
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: { port: 3000, open: true },
  envPrefix: 'REACT_APP_',
});
