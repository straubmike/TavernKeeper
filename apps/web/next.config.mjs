import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@innkeeper/lib', '@innkeeper/engine', '@innkeeper/agents'],
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      'thread-stream': false,
      'pino-elasticsearch': false,
      'pino-pretty': false,
      'tap': false,
      'desm': false,
      'fastbench': false,
    };
    return config;
  },
  serverExternalPackages: ['pino', 'thread-stream'],
  // Turbopack disabled - it has issues with test files in dependencies (thread-stream, WalletConnect)
  // Webpack handles these edge cases better. Turbopack can still be used for dev with `next dev --turbo` if desired
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: "connect-src 'self' https://* wss://* *; img-src 'self' blob: data: *; font-src 'self' data:; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline';",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
