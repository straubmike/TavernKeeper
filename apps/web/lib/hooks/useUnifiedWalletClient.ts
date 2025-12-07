/**
 * Unified Wallet Client Hook
 *
 * Wraps Wagmi hooks for backward compatibility during refactor.
 * Now that we use a unified Wagmi provider, this just proxies to standard Wagmi hooks.
 */

import { useWalletClient, useWriteContract } from 'wagmi';

export function useUnifiedWalletClient() {
    const { data: walletClient, isLoading } = useWalletClient();

    return { walletClient, isLoading };
}

/**
 * Hook for writeContract
 */
export function useUnifiedWriteContract() {
    return useWriteContract();
}


