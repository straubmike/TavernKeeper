/**
 * Safe account hook that works in both web (Privy) and miniapp (Farcaster SDK) contexts
 *
 * - Web context: Uses Privy for wallet connection
 * - Miniapp context: Uses Farcaster SDK directly (no WagmiProvider needed)
 */

import { usePrivy } from '@privy-io/react-auth';
import { useEffect, useState } from 'react';
import type { Address } from 'viem';
import { getFarcasterWalletAddress } from '../services/farcasterWallet';
import { isInFarcasterMiniapp } from '../utils/farcasterDetection';

export function useSafeAccount() {
    const privy = usePrivy();
    const isMiniapp = isInFarcasterMiniapp();
    const [farcasterAddress, setFarcasterAddress] = useState<Address | null>(null);
    const [farcasterConnected, setFarcasterConnected] = useState(false);

    // Fetch Farcaster wallet address when in miniapp
    useEffect(() => {
        if (!isMiniapp) {
            setFarcasterAddress(null);
            setFarcasterConnected(false);
            return;
        }

        let mounted = true;
        let retryCount = 0;
        const maxRetries = 5;

        const checkFarcasterWallet = async () => {
            if (!mounted) return;

            try {
                const address = await getFarcasterWalletAddress();
                if (mounted) {
                    setFarcasterAddress(address);
                    setFarcasterConnected(!!address);
                    retryCount = 0; // Reset retry count on success
                }
            } catch (error) {
                console.debug('Farcaster wallet not available:', error);
                if (mounted) {
                    // Only set to null if we've retried multiple times
                    if (retryCount >= maxRetries) {
                        setFarcasterAddress(null);
                        setFarcasterConnected(false);
                    } else {
                        retryCount++;
                    }
                }
            }
        };

        // Check immediately
        checkFarcasterWallet();

        // Poll more frequently initially, then less frequently
        const fastInterval = setInterval(() => {
            if (retryCount < maxRetries) {
                checkFarcasterWallet();
            }
        }, 500); // Check every 500ms initially

        const slowInterval = setInterval(() => {
            checkFarcasterWallet();
        }, 2000); // Also check every 2s

        return () => {
            mounted = false;
            clearInterval(fastInterval);
            clearInterval(slowInterval);
        };
    }, [isMiniapp]);

    // Use Farcaster SDK in miniapp, Privy otherwise
    const address = isMiniapp && farcasterAddress ? farcasterAddress : privy.user?.wallet?.address;
    const authenticated = isMiniapp ? farcasterConnected : privy.authenticated;

    return {
        address,
        authenticated,
        isConnected: authenticated,
    };
}
