'use client';

import { PrivyProvider } from '@privy-io/react-auth';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React, { useEffect } from 'react';

import { monad } from '../../lib/chains';

const queryClient = new QueryClient();

export function Web3Provider({ children }: { children: React.ReactNode }) {
    // Get Privy app ID - require it to be set, no fallback to invalid ID
    const privyAppId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;


    // Suppress Privy console errors in dev mode (origin not whitelisted is common)
    useEffect(() => {
        if (process.env.NODE_ENV === 'development') {
            const originalError = console.error;
            const originalWarn = console.warn;

            // Intercept console errors/warnings from Privy
            const errorInterceptor = (...args: any[]) => {
                const message = args[0]?.toString() || '';
                if (message.includes('Origin not allowed') ||
                    message.includes('auth.privy.io') ||
                    message.includes('403') ||
                    message.includes('Privy')) {
                    // Suppress Privy origin errors in dev - they're expected if localhost isn't whitelisted
                    return;
                }
                originalError.apply(console, args);
            };

            const warnInterceptor = (...args: any[]) => {
                const message = args[0]?.toString() || '';
                if (message.includes('Origin not allowed') ||
                    message.includes('auth.privy.io') ||
                    message.includes('Privy')) {
                    // Suppress Privy warnings in dev
                    return;
                }
                originalWarn.apply(console, args);
            };

            console.error = errorInterceptor;
            console.warn = warnInterceptor;

            return () => {
                console.error = originalError;
                console.warn = originalWarn;
            };
        }
    }, []);

    // During build/SSR, if no app ID is set, render children without Privy
    // This prevents build errors when Privy isn't configured
    if (typeof window === 'undefined' && !privyAppId) {
        return (
            <QueryClientProvider client={queryClient}>
                {children}
            </QueryClientProvider>
        );
    }

    // If no app ID in browser, show warning and render without Privy
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
