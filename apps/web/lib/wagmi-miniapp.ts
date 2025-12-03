
import { farcasterMiniApp } from '@farcaster/miniapp-wagmi-connector';
import { fallback, http, createStorage, cookieStorage } from 'wagmi';
import { createConfig } from 'wagmi';
import { monad } from './chains';

const monadTransports = process.env.NEXT_PUBLIC_MONAD_RPC_URL
  ? [http(process.env.NEXT_PUBLIC_MONAD_RPC_URL), http()]
  : [http()];

export const wagmiConfig = createConfig({
  chains: [monad],
  ssr: true,
  connectors: [farcasterMiniApp()],
  transports: {
    [monad.id]: fallback(monadTransports),
  },
  storage: createStorage({
    storage: cookieStorage,
  }),
  pollingInterval: 12_000,
});
