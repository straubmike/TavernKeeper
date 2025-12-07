/**
 * Unified Wagmi Config
 *
 * Works in both miniapp (Farcaster) and web (browser wallets) contexts
 * Includes all connectors - RainbowKit will show appropriate ones based on context
 */

import { farcasterMiniApp } from '@farcaster/miniapp-wagmi-connector';
import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { cookieStorage, createStorage, http } from 'wagmi';
import { monad } from './chains';

// Create a safe storage that works in both SSR and client
const noOpStorage = {
  getItem: () => null,
  setItem: () => { },
  removeItem: () => { },
};

const safeStorage = createStorage({
  storage: typeof window !== 'undefined' ? cookieStorage : noOpStorage,
});

export const wagmiConfig = getDefaultConfig({
  appName: 'TavernKeeper',
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || '1b99af504ddb38a0f6dc1b85e16ef5c9',
  chains: [monad],
  ssr: true,
  storage: safeStorage,
  transports: {
    [monad.id]: process.env.NEXT_PUBLIC_MONAD_RPC_URL
      ? http(process.env.NEXT_PUBLIC_MONAD_RPC_URL)
      : http(),
  },
});

// Manually append the Farcaster Miniapp connector
// This ensures it's available for autoconnection in the miniapp
// while keeping standard RainbowKit wallets (MetaMask, etc.) for mobile consumers
(wagmiConfig.connectors as any).push(farcasterMiniApp());

