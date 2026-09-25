import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';

// Relative base so the build works at https://<user>.github.io/<repo>/ without hard-coding the repo name.
export default defineConfig({
  base: './',
  plugins: [preact()],
});
