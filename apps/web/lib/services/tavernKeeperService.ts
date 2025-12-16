import { createPublicClient, formatEther, http, parseEther, type Address } from 'viem';
import { monad } from '../chains';
import { CONTRACT_REGISTRY, getContractAddress } from '../contracts/registry';

export interface OfficeState {
    currentKing: string;
    currentPrice: string; // formatted string
    kingSince: number;
    officeRate: string; // formatted string (dps)
    officeRateUsd: string; // Mocked for now
    priceUsd: string; // Mocked for now
    totalEarned: string; // formatted string
    totalEarnedUsd: string; // Mocked for now
    // New fields for interpolation
    epochId: number;
    startTime: number;
    nextDps: string; // formatted string
    initPrice: string; // formatted string
    isPaused?: boolean; // Whether the office is paused
    canClaimOffice?: boolean; // Whether user can claim (cooldown expired)
    cooldownTimeRemaining?: number; // Seconds remaining in cooldown
    error?: string; // Error message if fetch failed
}

export const tavernKeeperService = {
    _cache: {
        data: null as OfficeState | null,
        timestamp: 0,
        ttl: 10000 // 10 seconds cache (reduced for Dutch Auction)
    },

    async getOfficeState(forceRefresh = false): Promise<OfficeState> {
        // Return cached data if valid and not forced
        const now = Date.now();
        if (!forceRefresh && this._cache.data && (now - this._cache.timestamp < this._cache.ttl)) {
            return this._cache.data;
        }

        try {
            const contractConfig = CONTRACT_REGISTRY.TAVERNKEEPER;
            const contractAddress = getContractAddress(contractConfig);

            if (!contractAddress) throw new Error("TavernKeeper contract not found");

            const rpcUrl = monad.rpcUrls.default.http[0];
            const publicClient = createPublicClient({
                chain: monad,
                transport: http(rpcUrl),
            });

            // Retry helper
            const retry = async <T>(fn: () => Promise<T>, retries = 3, delay = 1000): Promise<T> => {
                try {
                    return await fn();
                } catch (error: any) {
                    if (retries === 0) throw error;
                    if (error.message?.includes('429') || error.message?.includes('Too Many Requests') || error.message?.includes('timeout')) {
                        await new Promise(resolve => setTimeout(resolve, delay));
                        return retry(fn, retries - 1, delay * 2);
                    }
                    throw error;
                }
            };

            // Multicall would be better, but doing individual reads for now
            const results = await Promise.allSettled([
                retry(() => publicClient.readContract({
                    address: contractAddress,
                    abi: contractConfig.abi,
                    functionName: 'getSlot0',
                    args: [],
                })),
                retry(() => publicClient.readContract({
                    address: contractAddress,
                    abi: contractConfig.abi,
                    functionName: 'getPrice',
                    args: [],
                })),
                retry(() => publicClient.readContract({
                    address: contractAddress,
                    abi: contractConfig.abi,
                    functionName: 'getDps',
                    args: [],
                })),
                retry(() => publicClient.readContract({
                    address: contractAddress,
                    abi: contractConfig.abi,
                    functionName: 'getPendingOfficeRewards',
                    args: [],
                })),
                // Check if paused (may not exist on older contracts, so we catch errors)
                retry(() => publicClient.readContract({
                    address: contractAddress,
                    abi: contractConfig.abi,
                    functionName: 'paused',
                    args: [],
                }).catch(() => false)), // Default to false if function doesn't exist
            ]);


            // Default values
            let slot0: any = {
                miner: '0x0000000000000000000000000000000000000000',
                startTime: BigInt(Math.floor(Date.now() / 1000)),
                dps: 0n,
                epochId: 0,
                initPrice: 0n,
            };
            let currentPrice = 0n;
            let nextDps = 0n;
            let pendingRewards = 0n;
            let isPaused = false;

            if (results[0].status === 'fulfilled') {
                slot0 = results[0].value;
            }
            if (results[1].status === 'fulfilled') {
                currentPrice = results[1].value as bigint;
            }
            if (results[2].status === 'fulfilled') {
                nextDps = results[2].value as bigint;
            }
            if (results[3].status === 'fulfilled') {
                pendingRewards = results[3].value as bigint;
            }
            if (results[4].status === 'fulfilled') {
                isPaused = results[4].value as boolean;
            }

            const currentKing = slot0.miner;
            const kingSince = Number(slot0.startTime);
            const officeRate = slot0.dps;

            // Calculate total earned based on time passed (Legacy/Total view)
            // For UI "Pending Rewards", we use the value from contract
            const duration = BigInt(Math.floor(Date.now() / 1000)) - BigInt(kingSince);
            const earned = duration > 0n ? duration * officeRate : 0n;

            const newState = {
                currentKing,
                currentPrice: formatEther(currentPrice),
                kingSince: kingSince * 1000,
                officeRate: formatEther(officeRate),
                officeRateUsd: '$0.00', // TODO: Fetch price
                priceUsd: '$0.00', // TODO: Fetch price
                totalEarned: formatEther(pendingRewards), // Use pending rewards for display
                totalEarnedUsd: '$0.00',
                epochId: Number(slot0.epochId),
                startTime: kingSince,
                nextDps: formatEther(nextDps),
                initPrice: formatEther(slot0.initPrice),
                isPaused,
                canClaimOffice: true, // Will be updated by checkCooldown if needed
                cooldownTimeRemaining: 0,
                error: undefined
            };

            // Update Cache
            this._cache.data = newState;
            this._cache.timestamp = now;

            return newState;
        } catch (error) {
            console.error("Error fetching office state:", error);
            // Return cached data if available even if expired
            if (this._cache.data) {
                return { ...this._cache.data, error: "Using cached data (Connection Failed)" };
            }

            return {
                currentKing: 'OFFLINE',
                currentPrice: '0',
                kingSince: 0, // Explicitly 0 to indicate error
                officeRate: '0',
                officeRateUsd: '$0.00',
                priceUsd: '$0.00',
                totalEarned: '0',
                totalEarnedUsd: '$0.00',
                epochId: 0,
                startTime: 0,
                nextDps: '0',
                initPrice: '0',
                canClaimOffice: true,
                cooldownTimeRemaining: 0,
                error: "Failed to connect to blockchain"
            };
        }
    },

    /**
     * Check if a wallet can claim the office (cooldown status)
     * @param walletAddress The wallet address to check
     * @returns Object with canClaim status and time remaining
     */
    async checkCooldown(walletAddress: string): Promise<{ canClaim: boolean; timeRemaining: number }> {
        try {
            const contractConfig = CONTRACT_REGISTRY.TAVERNKEEPER;
            const contractAddress = getContractAddress(contractConfig);
            if (!contractAddress) {
                return { canClaim: true, timeRemaining: 0 };
            }

            const publicClient = createPublicClient({
                chain: monad,
                transport: http(),
            });

            // Try to call canClaimOffice (may not exist on older contracts)
            try {
                const [canClaim, timeRemaining] = await publicClient.readContract({
                    address: contractAddress,
                    abi: contractConfig.abi,
                    functionName: 'canClaimOffice',
                    args: [walletAddress as Address],
                });

                return {
                    canClaim: canClaim as boolean,
                    timeRemaining: Number(timeRemaining as bigint),
                };
            } catch (e) {
                // Function doesn't exist on older contracts, assume can claim
                return { canClaim: true, timeRemaining: 0 };
            }
        } catch (error) {
            console.error("Error checking cooldown:", error);
            // On error, assume can claim (fail open)
            return { canClaim: true, timeRemaining: 0 };
        }
    },

    async takeOfficeWithWriteContract(
        writeContract: any,
        value: string,
        accountAddress: `0x${string}`,
        message: string = ""
    ) {
        const contractConfig = CONTRACT_REGISTRY.TAVERNKEEPER;
        const contractAddress = getContractAddress(contractConfig);

        if (!contractAddress) throw new Error("TavernKeeper contract not found");
        if (!accountAddress) {
            throw new Error("Account not found. Please ensure your wallet is connected and unlocked.");
        }

        // Fetch FRESH state to get exact epochId and price
        const state = await this.getOfficeState(true);
        const epochId = BigInt(state.epochId);
        const deadline = BigInt(Math.floor(Date.now() / 1000) + 300); // 5 minutes deadline

        // Calculate price with slippage
        const currentPriceWei = parseEther(state.currentPrice);
        const minPriceWei = parseEther('1000.0'); // Contract enforces 1000 MON minimum
        const effectivePriceWei = currentPriceWei < minPriceWei ? minPriceWei : currentPriceWei;
        const buffer = (effectivePriceWei * 5n) / 100n;
        const safePrice = effectivePriceWei + buffer;
        const maxPrice = safePrice;

        console.log(`Taking Office: Epoch ${epochId}, Price ${state.currentPrice}, Sending ${formatEther(safePrice)}`);

        const hash = await writeContract({
            address: contractAddress,
            abi: contractConfig.abi,
            functionName: 'takeOffice',
            value: safePrice,
            args: [epochId, deadline, maxPrice, message],
            account: accountAddress,
            chainId: monad.id,
        });

        return hash;
    },

    async takeOffice(client: any, value: string, accountAddress?: string, message: string = "") {
        const contractConfig = CONTRACT_REGISTRY.TAVERNKEEPER;
        const contractAddress = getContractAddress(contractConfig);

        if (!contractAddress) throw new Error("TavernKeeper contract not found");

        let account = client.account;

        if (!account && accountAddress) {
            account = accountAddress as `0x${string}`;
        }

        if (!account && typeof client.getAddresses === 'function') {
            const addresses = await client.getAddresses();
            if (addresses && addresses.length > 0) {
                account = addresses[0];
            }
        }

        if (!account) {
            throw new Error("Account not found. Please ensure your wallet is connected and unlocked.");
        }

        // Fetch FRESH state to get exact epochId and price
        // Force refresh to ensure we have the latest on-chain data
        const state = await this.getOfficeState(true);
        const epochId = BigInt(state.epochId);
        const deadline = BigInt(Math.floor(Date.now() / 1000) + 300); // 5 minutes deadline

        // Calculate price with slippage
        // The contract refunds any excess payment, so it is safe to send more.
        // We add 5% buffer to the current price to handle any price increase between fetch and tx.
        const currentPriceWei = parseEther(state.currentPrice);
        const minPriceWei = parseEther('1000.0'); // Contract enforces 1000 MON minimum

        // Enforce minimum price of 1000 MON
        const effectivePriceWei = currentPriceWei < minPriceWei ? minPriceWei : currentPriceWei;

        const buffer = (effectivePriceWei * 5n) / 100n;
        const safePrice = effectivePriceWei + buffer;

        // We set maxPrice to the safePrice to allow for the slippage
        const maxPrice = safePrice;

        console.log(`Taking Office: Epoch ${epochId}, Price ${state.currentPrice}, Sending ${formatEther(safePrice)}`);
        console.log(`Chain Config: ID=${monad.id}, RPC=${monad.rpcUrls.default.http[0]}`);

        // For localhost, skip simulation and use direct writeContract with high gas limit
        const isLocalhost = monad.id === 31337 || monad.rpcUrls.default.http[0]?.includes('127.0.0.1') || monad.rpcUrls.default.http[0]?.includes('localhost');

        if (isLocalhost) {
            // Direct write for localhost with high gas limit (matching test: 30M gas)
            const hash = await client.writeContract({
                address: contractAddress,
                abi: contractConfig.abi,
                functionName: 'takeOffice',
                value: safePrice,
                args: [epochId, deadline, maxPrice, message],
                gas: 30000000n, // 30M gas - matches test configuration
            });
            return hash;
        }

        // For testnet/mainnet, simulate first to get better error messages
        try {
            // Create a public client specifically for simulation
            // WalletClient does not support simulation directly in some configurations
            const rpcUrl = monad.rpcUrls.default.http[0];
            const publicClient = createPublicClient({
                chain: monad,
                transport: http(rpcUrl),
            });

            const { request } = await publicClient.simulateContract({
                address: contractAddress,
                abi: contractConfig.abi,
                functionName: 'takeOffice',
                value: safePrice,
                chain: monad,
                account: account,
                args: [epochId, deadline, maxPrice, message],
            });

            const hash = await client.writeContract(request);
            return hash;
        } catch (err) {
            console.error("Simulation failed:", err);
            throw err;
        }
    },

    async claimOfficeRewards(client: any, accountAddress?: string) {
        const contractConfig = CONTRACT_REGISTRY.TAVERNKEEPER;
        const contractAddress = getContractAddress(contractConfig);

        if (!contractAddress) throw new Error("TavernKeeper contract not found");

        let account = client.account;
        if (!account && accountAddress) {
            account = accountAddress as `0x${string}`;
        }

        if (!account) {
            throw new Error("Account not found");
        }

        const hash = await client.writeContract({
            address: contractAddress,
            abi: contractConfig.abi,
            functionName: 'claimOfficeRewards',
            args: [],
            chain: monad,
            account: account,
        });

        return hash;
    }
};
