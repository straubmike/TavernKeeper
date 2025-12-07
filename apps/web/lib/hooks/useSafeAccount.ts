/**
 * Safe account hook that works with the UnifiedWeb3Provider (Wagmi + RainbowKit)
 *
 * Checks Wagmi state, which handles both Web (injected/walletconnect) and Miniapp (SDK connector)
 */

import { useAccount } from 'wagmi';

export function useSafeAccount() {
    const { address, isConnected, status } = useAccount();

    return {
        address,
        authenticated: isConnected,
        isConnected,
        status
    };
}
