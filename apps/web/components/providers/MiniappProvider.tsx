
'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode, useEffect, useState } from 'react';
import { WagmiProvider } from 'wagmi';
import { AutoConnectWallet } from '../AutoConnectWallet';
import { wagmiConfig } from '../../lib/wagmi-miniapp';
import sdk from '@farcaster/miniapp-sdk';

type MiniappProviderProps = {
  children: ReactNode;
};

export function MiniappProvider({ children }: MiniappProviderProps) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            refetchOnWindowFocus: false,
            staleTime: 15_000,
          },
        },
      }),
  );

  // Call sdk.actions.ready() IMMEDIATELY when provider mounts
  // This must be called as early as possible to hide the splash screen
  // Call sdk.actions.ready() IMMEDIATELY when provider mounts
  // This provider is strictly rendered ONLY in miniapp context by ProviderSelector
  useEffect(() => {
    // Signal to the parent Farcaster client that we are ready to be shown
    sdk.actions.ready();
    console.log('✅ sdk.actions.ready() called in MiniappProvider');
  }, []);

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <AutoConnectWallet forceConnect={true} />
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  );
}
