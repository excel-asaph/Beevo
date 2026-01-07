import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '../', '');
    return {
        server: {
            port: 3000,
            host: '0.0.0.0',
            proxy: {
                '/ws': {
                    target: 'ws://localhost:3001',
                    ws: true,
                }
            }
        },
        plugins: [react()],
        define: {
            'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
            'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
            'process.env.WS_URL': JSON.stringify('ws://localhost:3001')
        },
        resolve: {
            alias: {
                '@': path.resolve(__dirname, './src'),
                '@shared': path.resolve(__dirname, '../shared'),
            }
        }
    };
});
