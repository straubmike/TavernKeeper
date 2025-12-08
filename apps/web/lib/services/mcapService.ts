/**
 * Market Cap (MCAP) Service
 * Calculates KEEP token market cap based on pool price and total supply
 */

import { createPublicClient, formatEther, http, parseAbi } from 'viem';
import { monad } from '../chains';
import { CONTRACT_REGISTRY, getContractAddress } from '../contracts/registry';
import { getMonPrice } from './monPriceService';
import { getPoolLiquidity } from './uniswapV4SwapService';

export interface KeepMcapData {
    totalSupply: string;        // Total KEEP supply (formatted)
    pricePerKeep: string;       // KEEP price in MON (formatted)
    pricePerKeepUsd: string;     // KEEP price in USD (formatted)
    mcap: string;               // Market cap in MON (formatted)
    mcapUsd: string;            // Market cap in USD (formatted)
}

let mcapCache: {
    data: KeepMcapData | null;
    timestamp: number;
    ttl: number;
} = {
    data: null,
    timestamp: 0,
    ttl: 30000, // 30 seconds cache
};

export const mcapService = {
    /**
     * Get KEEP token total supply from contract
     */
    async getKeepTotalSupply(): Promise<bigint> {
        try {
            const contractConfig = CONTRACT_REGISTRY.KEEP_TOKEN;
            const contractAddress = getContractAddress(contractConfig);

            if (!contractAddress || contractAddress === '0x0000000000000000000000000000000000000000') {
                console.error('KEEP token contract address not found');
                return 0n;
            }

            const rpcUrl = process.env.NEXT_PUBLIC_MONAD_RPC_URL || monad.rpcUrls.default.http[0];

            const publicClient = createPublicClient({
                chain: monad,
                transport: http(rpcUrl),
            });

            const totalSupply = await publicClient.readContract({
                address: contractAddress,
                abi: parseAbi(['function totalSupply() view returns (uint256)']),
                functionName: 'totalSupply',
            }) as bigint;

            return totalSupply;
        } catch (error) {
            console.error('Error fetching KEEP totalSupply:', error);
            return 0n;
        }
    },

    /**
     * Calculate KEEP price in MON from pool liquidity
     * Price = Pool MON / Pool KEEP
     */
    async getKeepPrice(): Promise<number | null> {
        try {
            const poolLiquidity = await getPoolLiquidity(true); // Force refresh for accurate price

            if (!poolLiquidity || poolLiquidity.mon === 0n || poolLiquidity.keep === 0n) {
                console.warn('Pool liquidity is zero, cannot calculate KEEP price');
                return null;
            }

            const poolMon = parseFloat(formatEther(poolLiquidity.mon));
            const poolKeep = parseFloat(formatEther(poolLiquidity.keep));

            if (poolKeep === 0) {
                return null;
            }

            // Price per KEEP in MON = Pool MON / Pool KEEP
            const pricePerKeep = poolMon / poolKeep;
            return pricePerKeep;
        } catch (error) {
            console.error('Error calculating KEEP price:', error);
            return null;
        }
    },

    /**
     * Get KEEP price in USD
     */
    async getKeepPriceUsd(): Promise<number | null> {
        try {
            const pricePerKeep = await this.getKeepPrice();
            if (pricePerKeep === null) {
                return null;
            }

            const monPriceUsd = await getMonPrice();
            const pricePerKeepUsd = pricePerKeep * monPriceUsd;
            return pricePerKeepUsd;
        } catch (error) {
            console.error('Error calculating KEEP price in USD:', error);
            return null;
        }
    },

    /**
     * Calculate KEEP token market cap
     * MCAP = totalSupply × pricePerKeep × monPriceUsd
     */
    async getKeepMcap(forceRefresh = false): Promise<KeepMcapData | null> {
        const now = Date.now();

        // Check cache first
        if (!forceRefresh && mcapCache.data && (now - mcapCache.timestamp < mcapCache.ttl)) {
            return mcapCache.data;
        }

        try {
            // Fetch all required data
            const [totalSupply, poolLiquidity, monPriceUsd] = await Promise.all([
                this.getKeepTotalSupply(),
                getPoolLiquidity(true), // Force refresh for accurate calculation
                getMonPrice(),
            ]);

            // Validate data
            if (totalSupply === 0n) {
                console.warn('KEEP totalSupply is zero');
                return mcapCache.data; // Return cached data if available
            }

            if (!poolLiquidity || poolLiquidity.mon === 0n || poolLiquidity.keep === 0n) {
                console.warn('Pool liquidity is zero, cannot calculate MCAP');
                return mcapCache.data; // Return cached data if available
            }

            // Calculate KEEP price in MON
            const poolMon = parseFloat(formatEther(poolLiquidity.mon));
            const poolKeep = parseFloat(formatEther(poolLiquidity.keep));
            const pricePerKeep = poolMon / poolKeep;

            // Calculate MCAP
            const totalSupplyFloat = parseFloat(formatEther(totalSupply));
            const mcap = totalSupplyFloat * pricePerKeep; // MCAP in MON
            const mcapUsd = mcap * monPriceUsd; // MCAP in USD
            const pricePerKeepUsd = pricePerKeep * monPriceUsd; // KEEP price in USD

            const result: KeepMcapData = {
                totalSupply: totalSupplyFloat.toFixed(2),
                pricePerKeep: pricePerKeep.toFixed(6),
                pricePerKeepUsd: pricePerKeepUsd.toFixed(6),
                mcap: mcap.toFixed(2),
                mcapUsd: mcapUsd.toFixed(2),
            };

            // Update cache
            mcapCache.data = result;
            mcapCache.timestamp = now;

            return result;
        } catch (error) {
            console.error('Error calculating KEEP MCAP:', error);
            // Return cached data if available, even if expired
            return mcapCache.data;
        }
    },

    /**
     * Clear MCAP cache
     */
    clearCache() {
        mcapCache.data = null;
        mcapCache.timestamp = 0;
    },
};

