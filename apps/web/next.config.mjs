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
  // Turbopack disabled - use webpack (specify --webpack flag in dev script)
  webpack: (config, { isServer }) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      'thread-stream': false,
      'pino-elasticsearch': false,
      'pino-pretty': false,
      'tap': false,
      'desm': false,
      'fastbench': false,
      // MetaMask SDK tries to import React Native packages - ignore them in web builds
      '@react-native-async-storage/async-storage': false,
    };

    // Ignore React Native modules that MetaMask SDK tries to import
    config.resolve.fallback = {
      ...config.resolve.fallback,
      '@react-native-async-storage/async-storage': false,
    };

    // Note: indexedDB ReferenceError during SSR is expected from dependencies
    // These are runtime warnings, not build errors - the build still succeeds

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
            value: "connect-src 'self' https://* wss://* https://explorer-api.walletconnect.com https://pulse.walletconnect.org https://rpc.monad.xyz https://testnet-rpc.monad.xyz https://farcaster.xyz https://client.farcaster.xyz https://warpcast.com https://client.warpcast.com https://wrpcd.net https://*.wrpcd.net https://privy.farcaster.xyz https://privy.warpcast.com https://auth.privy.io https://*.rpc.privy.systems https://cloudflareinsights.com *; img-src 'self' blob: data: *; font-src 'self' data:; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline';",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
