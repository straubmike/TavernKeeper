
import { farcasterMiniApp } from '@farcaster/miniapp-wagmi-connector';
import { cookieStorage, createConfig, createStorage, fallback, http } from 'wagmi';
import { injected } from 'wagmi/connectors';
import { monad } from './chains';

// Use chain's RPC URL (which includes Alchemy if configured)
const monadRpcUrl = monad.rpcUrls.default.http[0];
const monadTransports = [http(monadRpcUrl), http()]; // Fallback to default if first fails

export const wagmiConfig = createConfig({
  chains: [monad],
  ssr: true,
  connectors: [
    farcasterMiniApp(),
    injected()
  ],
  transports: {
    [monad.id]: fallback(monadTransports),
  },
  storage: createStorage({
    storage: cookieStorage,
  }),
  pollingInterval: 12_000,
});
