
'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode, useState } from 'react';
import { WagmiProvider } from 'wagmi';
import { AutoConnectWallet } from '../AutoConnectWallet';
import { wagmiConfig } from '../../lib/wagmi-miniapp';

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

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <AutoConnectWallet />
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  );
}
