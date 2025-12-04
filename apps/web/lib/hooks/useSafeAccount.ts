/**
 * Safe account hook for web routes (uses Privy only)
 *
 * Note: Pages in (web) route group use Privy for wallet connection.
 * For miniapp functionality, use miniapp-specific routes that have WagmiProvider.
 */

import { usePrivy } from '@privy-io/react-auth';

export function useSafeAccount() {
    const privy = usePrivy();

    return {
        address: privy.user?.wallet?.address,
        authenticated: privy.authenticated,
        isConnected: privy.authenticated,
    };
}
