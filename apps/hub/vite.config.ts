import { defineConfig } from 'vite';
import laravel from 'laravel-vite-plugin';
import vue from '@vitejs/plugin-vue';
import path from 'path';
import fs from 'fs';

export default defineConfig({
  plugins: [
    {
      name: 'serve-index-html',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          const url = req.url ? req.url.split('?')[0] : '';
          if (url === '/' || url === '/index.html') {
            const htmlPath = path.resolve(__dirname, 'index.html');
            if (fs.existsSync(htmlPath)) {
              const html = fs.readFileSync(htmlPath, 'utf-8');
              server.transformIndexHtml(req.url || '/', html)
                .then((transformed) => {
                  res.setHeader('Content-Type', 'text/html');
                  res.end(transformed);
                })
                .catch(next);
              return;
            }
          }
          next();
        });
      },
    },
    laravel({
      input: ['resources/css/app.css', 'resources/js/app.ts'],
      refresh: true,
    }),
    vue({
      template: {
        transformAssetUrls: {
          base: null,
          includeAbsolute: false,
        },
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './resources/js'),
    },
  },
});
