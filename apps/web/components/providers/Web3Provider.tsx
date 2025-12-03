'use client';

import { PrivyProvider } from '@privy-io/react-auth';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { monad } from '../../lib/chains';

const queryClient = new QueryClient();

export function Web3Provider({ children }: { children: React.ReactNode }) {
    // Get Privy app ID - require it to be set, no fallback to invalid ID
    const privyAppId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;

    // During build/SSR, if no app ID is set, render children without Privy
    // This prevents build errors when Privy isn't configured
    if (typeof window === 'undefined' && !privyAppId) {
        return (
            <QueryClientProvider client={queryClient}>
                {children}
            </QueryClientProvider>
        );
    }

    // If no app ID in browser, show error or fallback
    if (!privyAppId) {
        console.warn('NEXT_PUBLIC_PRIVY_APP_ID is not set. Privy authentication will not work.');
        return (
            <QueryClientProvider client={queryClient}>
                {children}
            </QueryClientProvider>
        );
    }

    return (
        <PrivyProvider
            appId={privyAppId}
            config={{
                loginMethods: ['wallet'],
                appearance: {
                    theme: 'dark',
                    accentColor: '#676FFF',
                },
                supportedChains: [monad],
            }}
        >
            <QueryClientProvider client={queryClient}>
                {children}
            </QueryClientProvider>
        </PrivyProvider>
    );
}
