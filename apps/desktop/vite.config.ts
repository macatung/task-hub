import { defineConfig } from 'vite';
import path from 'node:path';
import electron from 'vite-plugin-electron/simple';
import vue from '@vitejs/plugin-vue';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  return {
    plugins: [
      vue(),
      electron({
        main: {
          entry: 'electron/main.ts',
          onstart(args) {
            if (mode === 'ide' || mode === 'mascot') {
              args.startup(['.', `--mode=${mode}`, '--no-sandbox']);
            } else {
              args.startup(['.', '--no-sandbox']);
            }
          },
          vite: {
            build: {
              rollupOptions: {
                external: ['node-pty'],
              },
            },
          },
        },
        preload: {
          input: path.join(__dirname, 'electron/preload.ts'),
        },
        renderer: {},
      }),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    build: {
      rollupOptions: {
        // node-pty loads a platform/ABI-specific .node file at runtime.
        // Bundling it makes Rollup rewrite the dynamic require and breaks Electron.
        external: ['node-pty'],
      },
    },
  };
});
