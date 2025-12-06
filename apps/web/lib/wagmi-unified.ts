/**
 * Unified Wagmi Config
 *
 * Works in both miniapp (Farcaster) and web (browser wallets) contexts
 * Includes all connectors - RainbowKit will show appropriate ones based on context
 */

import { farcasterMiniApp } from '@farcaster/miniapp-wagmi-connector';
import { injected, metaMask, walletConnect } from '@wagmi/connectors';
import { fallback, http, createStorage, cookieStorage } from 'wagmi';
import { createConfig } from 'wagmi';
import { monad } from './chains';

const monadTransports = process.env.NEXT_PUBLIC_MONAD_RPC_URL
  ? [http(process.env.NEXT_PUBLIC_MONAD_RPC_URL), http()]
  : [http()];

// Include all connectors - RainbowKit will filter/show appropriate ones
// Farcaster connector works in miniapp, others work in web
export const wagmiConfig = createConfig({
  chains: [monad],
  ssr: true,
  connectors: [
    farcasterMiniApp(), // For Farcaster miniapp
    injected(), // Browser extension wallets
    metaMask(), // MetaMask specifically
    walletConnect({
      projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || '1b99af504ddb38a0f6dc1b85e16ef5c9',
    }),
  ],
  transports: {
    [monad.id]: fallback(monadTransports),
  },
  storage: createStorage({
    storage: cookieStorage,
  }),
  pollingInterval: 12_000,
});

