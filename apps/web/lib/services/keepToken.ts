import { createPublicClient, formatEther, http } from 'viem';
import { monad } from '../chains';
import { CONTRACT_REGISTRY, getContractAddress } from '../contracts/registry';

export const keepTokenService = {
    /**
     * Get KEEP token balance for an address
     */
    async getBalance(address: string): Promise<string> {
        try {
            const contractConfig = CONTRACT_REGISTRY.KEEP_TOKEN;
            const contractAddress = getContractAddress(contractConfig);

            if (!contractAddress || contractAddress === '0x0000000000000000000000000000000000000000') {
                console.error('CRITICAL: KEEP token contract address is missing or zero!');
                console.error('CONTRACT_ADDRESSES.KEEP_TOKEN:', contractConfig.proxyAddress);
                console.error('NEXT_PUBLIC_USE_LOCALHOST:', process.env.NEXT_PUBLIC_USE_LOCALHOST);
                console.error('This will break in production! Fix addresses.ts or set NEXT_PUBLIC_USE_LOCALHOST=true');
                return '0';
            }

            // Use RPC from env or default based on chain ID
            const rpcUrl = process.env.NEXT_PUBLIC_MONAD_RPC_URL || monad.rpcUrls.default.http[0];

            const publicClient = createPublicClient({
                chain: monad,
                transport: http(rpcUrl),
            });

            const balance = await publicClient.readContract({
                address: contractAddress,
                abi: contractConfig.abi,
                functionName: 'balanceOf',
                args: [address],
            }) as bigint;

            return balance.toString();
        } catch (error) {
            console.error('Error fetching KEEP balance:', error);
            return '0';
        }
    },

    /**
     * Get KEEP token balance for a Token Bound Account (TBA)
     * This is used to check how much gold/KEEP a specific hero/NPC has
     */
    async getTBABalance(tbaAddress: string): Promise<string> {
        return this.getBalance(tbaAddress);
    },

    /**
     * Format KEEP balance for display (e.g. "100.00")
     */
    formatBalance(balance: string | bigint): string {
        const val = typeof balance === 'string' ? BigInt(balance) : balance;
        return parseFloat(formatEther(val)).toFixed(2);
    }
};
