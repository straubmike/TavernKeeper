'use client';

import { useEffect, useRef } from 'react';
import { useAccount, useConnect } from 'wagmi';
import { monad } from '../lib/chains';
import { isInFarcasterMiniapp } from '../lib/utils/farcasterDetection';

/**
 * Auto-connects wallet when in Farcaster miniapp context
 * This ensures wallet stays connected across all miniapp pages
 */
export function AutoConnectWallet() {
    const isMiniapp = isInFarcasterMiniapp();
    const { isConnected } = useAccount();
    const { connectors, connectAsync, isPending: isConnecting } = useConnect();
    const autoConnectAttempted = useRef(false);
    const primaryConnector = connectors[0];

    // Only run in miniapp context
    if (!isMiniapp) {
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
        connectAsync({
            connector: primaryConnector,
            chainId: monad.id,
        }).catch(() => {
            // Reset on connection failure so we can retry
            autoConnectAttempted.current = false;
        });
    }, [connectAsync, isConnected, isConnecting, primaryConnector]);

    return null;
}

