import { defineConfig, loadEnv } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

// Simple plugin to run Vercel API routes locally in Vite
const vercelApiPlugin = () => ({
  name: 'vercel-api-plugin',
  configureServer(server) {
    server.middlewares.use('/api', (req, res, next) => {
      // We must handle this async carefully
      (async () => {
        try {
          const urlPath = req.url.split('?')[0];
          const modulePath = path.resolve(__dirname, `./api${urlPath}.js`);
          
          // Import the Vercel function
          const module = await import(`file://${modulePath}?t=${Date.now()}`);
          const handler = module.default;
          
          // Helper for Vercel-like JSON response
          res.json = (data) => {
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(data));
          };
          res.status = (code) => {
            res.statusCode = code;
            return res;
          };

          if (req.method === 'POST' || req.method === 'PUT') {
            let body = '';
            req.on('data', chunk => { body += chunk.toString(); });
            req.on('end', async () => {
              try {
                req.body = body ? JSON.parse(body) : {};
              } catch (e) {
                req.body = body;
              }
              await handler(req, res);
            });
          } else {
            await handler(req, res);
          }
        } catch (err) {
          // If the file doesn't exist, just pass to next middleware (e.g. 404)
          next();
        }
      })();
    });
  }
});

export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  // Set the third parameter to '' to load all env regardless of the `VITE_` prefix.
  Object.assign(process.env, loadEnv(mode, process.cwd(), ''));

  return {
    plugins: [
      // The React and Tailwind plugins are both required for Make, even if
      // Tailwind is not being actively used – do not remove them
      react(),
      tailwindcss(),
      vercelApiPlugin()
    ],
    server: {
      host: true,
      port: 3000,
      strictPort: false,
    },
    resolve: {
      alias: {
        // Alias @ to the src directory
        '@': path.resolve(__dirname, './src'),
      },
    },
  };
})
