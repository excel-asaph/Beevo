import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '../', '');
    const isProduction = mode === 'production';

    return {
        server: {
            port: 3000,
            host: '0.0.0.0',
            proxy: {
                '/ws': {
                    target: 'ws://127.0.0.1:3001',
                    ws: true,
                },
                '/api': {
                    target: 'http://127.0.0.1:3001',
                    changeOrigin: true,
                    secure: false,
                }
            }
        },
        plugins: [react()],
        define: {
            'process.env.VITE_PROD': JSON.stringify(isProduction),
            'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
            'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
            'process.env.WS_URL': JSON.stringify(env.WS_URL || (isProduction ? '' : 'ws://localhost:3001'))
        },
        resolve: {
            alias: {
                '@': path.resolve(__dirname, './src'),
                '@shared': path.resolve(__dirname, '../shared'),
            }
        },
        build: {
            outDir: 'dist',
            emptyOutDir: true,
            rollupOptions: {
                output: {
                    manualChunks: {
                        vendor: ['react', 'react-dom', 'framer-motion'],
                    }
                }
            }
        }
    };
});
