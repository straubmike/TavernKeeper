'use client';

import { ReactNode, useEffect, useState } from 'react';
import sdk from '@farcaster/miniapp-sdk';
import { MiniappProvider } from './providers/MiniappProvider';
import { Web3Provider } from './providers/Web3Provider';
import { UnifiedWeb3Provider } from './providers/UnifiedWeb3Provider';
import { AuthProvider } from './providers/AuthProvider';

type ProviderSelectorProps = {
    children: ReactNode;
};

export function ProviderSelector({ children }: ProviderSelectorProps) {
    const [isMiniapp, setIsMiniapp] = useState<boolean | null>(null);

    useEffect(() => {
        const detectEnvironment = async () => {
            // 1. Fast, synchronous check: Are we in an iframe?
            // Most miniapps run in iframes. If we are the top window, we are definitely NOT in a miniapp.
            // However, dev mode might not be in an iframe, so strictly relying on this might be tricky if testing locally without frame.
            // But for production miniapps, window.parent !== window is true.

            try {
                // 2. Authoritative async check from SDK
                const isClientInMiniapp = await sdk.isInMiniApp();
                setIsMiniapp(isClientInMiniapp);
            } catch (error) {
                console.error('Error detecting Miniapp context:', error);
                // Fallback to web if detection fails
                setIsMiniapp(false);
            }
        };

        detectEnvironment();
    }, []);

    // Render nothing while detecting (or a loading spinner if preferred)
    // This blocks ANY provider from initializing until we know for sure.
    if (isMiniapp === null) {
        return (
            <div className="flex h-screen items-center justify-center bg-black text-white font-press-start">
                <div className="animate-pulse">Loading Tavern...</div>
            </div>
        );
    }

    if (isMiniapp) {
        // Miniapp Context: Only MiniappProvider
        // We strictly exclude Web3Provider (Privy) and UnifiedWeb3Provider (RainbowKit/Wagmi for Web)
        // to prevent them from seizing control or throwing errors.
        return (
            <MiniappProvider>
                {children}
            </MiniappProvider>
        );
    }

    // Web Context: Standard Provider Stack
    // Web3Provider (Privy) -> UnifiedWeb3Provider (RainbowKit) -> AuthProvider (App Logic)
    return (
        <Web3Provider>
            <UnifiedWeb3Provider>
                <AuthProvider>
                    {children}
                </AuthProvider>
            </UnifiedWeb3Provider>
        </Web3Provider>
    );
}
