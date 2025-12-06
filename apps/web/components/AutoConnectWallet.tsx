'use client';

import { useEffect, useRef } from 'react';
import { useAccount, useConnect } from 'wagmi';
import { monad } from '../lib/chains';
import { isInFarcasterMiniapp } from '../lib/utils/farcasterDetection';

/**
 * Auto-connects wallet when in Farcaster miniapp context
 * This ensures wallet stays connected across all miniapp pages
 */
export function AutoConnectWallet({ forceConnect = false }: { forceConnect?: boolean }) {
    const isMiniapp = isInFarcasterMiniapp();
    const { isConnected } = useAccount();
    const { connectors, connectAsync, isPending: isConnecting } = useConnect();
    const autoConnectAttempted = useRef(false);
    const primaryConnector = connectors[0];

    // Only run in miniapp context unless forced (e.g. by MiniappProvider)
    if (!isMiniapp && !forceConnect) {
        return null;
    }

    // Reset autoConnectAttempted when connection is lost
    useEffect(() => {
        if (!isConnected && autoConnectAttempted.current) {
            autoConnectAttempted.current = false;
        }
    }, [isConnected]);

    // Auto-connect when connector is available
    useEffect(() => {
        if (
            autoConnectAttempted.current ||
            isConnected ||
            !primaryConnector ||
            isConnecting
        ) {
            return;
        }

        autoConnectAttempted.current = true;

        const attemptConnect = async () => {
            // 1. Try Farcaster Connector (usually first)
            const fcConnector = connectors.find(c => c.id === 'farcaster-miniapp') || connectors[0];

            try {
                if (fcConnector) {
                    await connectAsync({ connector: fcConnector, chainId: monad.id });
                    return;
                }
            } catch (e) {
                console.warn('Farcaster connector failed, trying fallback...', e);
            }

            // 2. Try Injected/Others if Farcaster failed
            if (connectors.length > 1) {
                const fallbackConnector = connectors.find(c => c.id !== 'farcaster-miniapp');
                if (fallbackConnector) {
                    try {
                        await connectAsync({ connector: fallbackConnector, chainId: monad.id });
                    } catch (err) {
                        console.error('Fallback connection failed', err);
                        // Reset so we can try again if user takes action
                        autoConnectAttempted.current = false;
                    }
                }
            } else {
                autoConnectAttempted.current = false;
            }
        };

        attemptConnect();
    }, [connectAsync, isConnected, isConnecting, connectors]);

    return null;
}

