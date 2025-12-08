
import { createPublicClient, formatEther, http, parseEther, encodeFunctionData, parseAbi } from 'viem';
import { monad } from '../chains';
import { CONTRACT_REGISTRY, getContractAddress } from '../contracts/registry';
import { CONTRACT_ADDRESSES } from '../contracts/addresses';

export interface CellarState {
    potSize: string; // MON in the contract
    potSizeKeep?: string; // KEEP in the contract (optional for back compat if needed)
    currentPrice: string; // LP tokens required to buy
    epochId: number;
    startTime: number;
    initPrice: string;
    paymentToken: string;
}

export const theCellarService = {
    _cache: {
        data: null as CellarState | null,
        timestamp: 0,
        ttl: 10000 // 10 seconds cache
    },

    clearCache() {
        this._cache.data = null;
        this._cache.timestamp = 0;
    },

    async getCellarState(): Promise<CellarState> {
        const now = Date.now();
        if (this._cache.data && (now - this._cache.timestamp < this._cache.ttl)) {
            return this._cache.data;
        }

        try {
            const contractConfig = CONTRACT_REGISTRY.THECELLAR;
            const contractAddress = getContractAddress(contractConfig);

            if (!contractAddress) {
                console.error('THECELLAR: Contract address not found. Check CONTRACT_ADDRESSES.');
                throw new Error("TheCellar contract not found");
            }

            // Use RPC from env or default based on chain ID
            const rpcUrl = process.env.NEXT_PUBLIC_MONAD_RPC_URL ||
                (monad.id === 143 ? 'https://rpc.monad.xyz' : 'https://testnet-rpc.monad.xyz');

            const publicClient = createPublicClient({
                chain: monad,
                transport: http(rpcUrl),
            });

            // V3 Cellar calls: potBalanceMON, potBalanceKEEP, tokenId
            const results = await Promise.allSettled([
                publicClient.readContract({
                    address: contractAddress,
                    abi: contractConfig.abi,
                    functionName: 'potBalanceMON',
                    args: [],
                }),
                publicClient.readContract({
                    address: contractAddress,
                    abi: contractConfig.abi,
                    functionName: 'potBalanceKEEP',
                    args: [],
                }),
                publicClient.readContract({
                    address: contractAddress,
                    abi: contractConfig.abi,
                    functionName: 'tokenId',
                    args: [],
                }),
            ]);

            let potMON = 0n;
            let potKEEP = 0n;
            let tokenId = 0n;

            if (results[0].status === 'fulfilled') potMON = results[0].value as bigint;
            if (results[1].status === 'fulfilled') potKEEP = results[1].value as bigint;
            if (results[2].status === 'fulfilled') tokenId = results[2].value as bigint;

            const newState = {
                potSize: formatEther(potMON), // MON share of pot
                potSizeKeep: formatEther(potKEEP), // KEEP share of pot
                currentPrice: '1.05', // Fixed Raid Price? Or check contract for dynamic? For now assume V3 implementation standard
                epochId: Number(tokenId), // Using tokenId as "Epoch" concept for display
                startTime: now,
                initPrice: '1.05',
                paymentToken: contractAddress,
            };

            this._cache.data = newState;
            this._cache.timestamp = now;

            return newState;
        } catch (error) {
            console.error("Error fetching V3 cellar state:", error);
            if (this._cache.data) return this._cache.data;
            return {
                potSize: '0',
                potSizeKeep: '0',
                currentPrice: '0',
                epochId: 0,
                startTime: Date.now(),
                initPrice: '0',
                paymentToken: '0x0000000000000000000000000000000000000000',
            };
        }
    },

    async getAllowance(owner: string, tokenAddress: string): Promise<bigint> {
        const rpcUrl = process.env.NEXT_PUBLIC_MONAD_RPC_URL ||
            (monad.id === 143 ? 'https://rpc.monad.xyz' : 'https://testnet-rpc.monad.xyz');

        const publicClient = createPublicClient({
            chain: monad,
            transport: http(rpcUrl),
        });

        const contractConfig = CONTRACT_REGISTRY.THECELLAR;
        const contractAddress = getContractAddress(contractConfig);

        try {
            const allowance = await publicClient.readContract({
                address: tokenAddress as `0x${string}`,
                abi: parseAbi(['function allowance(address,address) view returns (uint256)']),
                functionName: 'allowance',
                args: [owner as `0x${string}`, contractAddress as `0x${string}`],
            });
            return allowance as bigint;
        } catch (error) {
            console.error("Error fetching allowance:", error);
            return 0n;
        }
    },

    // KEEP Token Allowance
    async getKeepAllowance(userAddress: string, spenderAddress: string): Promise<bigint> {
        return this.getAllowance(userAddress, CONTRACT_ADDRESSES.KEEP_TOKEN);
    },

    async approveKeep(client: any, spenderAddress: string, amount: bigint) {
        return this.approve(client, CONTRACT_ADDRESSES.KEEP_TOKEN, amount);
    },

    async approve(client: any, tokenAddress: string, amount: bigint) {
        const contractConfig = CONTRACT_REGISTRY.THECELLAR;
        const contractAddress = getContractAddress(contractConfig);

        const hash = await client.writeContract({
            address: tokenAddress as `0x${string}`,
            abi: parseAbi(['function approve(address,uint256) returns (bool)']),
            functionName: 'approve',
            chain: monad,
            account: client.account,
            args: [contractAddress, amount],
        });
        return hash;
    },

    async claim(client: any, lpBid: bigint) {
        const contractConfig = CONTRACT_REGISTRY.THECELLAR;
        const contractAddress = getContractAddress(contractConfig);

        if (!contractAddress) throw new Error("TheCellar contract not found");

        const hash = await client.writeContract({
            address: contractAddress,
            abi: contractConfig.abi,
            functionName: 'raid',
            chain: monad,
            account: client.account,
            args: [lpBid],
        });

        return hash;
    },

    async addLiquidity(client: any, amountMON: bigint, amountKEEP: bigint) {
        const contractConfig = CONTRACT_REGISTRY.THECELLAR;
        const contractAddress = getContractAddress(contractConfig);
        if (!contractAddress) throw new Error("TheCellar contract not found");

        const hash = await client.writeContract({
            address: contractAddress,
            abi: contractConfig.abi,
            functionName: 'addLiquidity',
            chain: monad,
            account: client.account,
            args: [amountMON, amountKEEP],
        });

        return hash;
    },

    async recoverLiquidity(client: any, lpAmount: bigint) {
        const contractConfig = CONTRACT_REGISTRY.THECELLAR;
        const contractAddress = getContractAddress(contractConfig);
        if (!contractAddress) throw new Error("TheCellar contract not found");

        const hash = await client.writeContract({
            address: contractAddress,
            abi: contractConfig.abi,
            functionName: 'withdraw',
            chain: monad,
            account: client.account,
            args: [lpAmount],
        });

        return hash;
    },

    async getUserLpBalance(userAddress: string): Promise<bigint> {
        // 1. Get TheCellar contract address
        const cellarConfig = CONTRACT_REGISTRY.THECELLAR;
        const cellarAddress = getContractAddress(cellarConfig);

        if (!cellarAddress) {
            console.error("TheCellar contract not found");
            return 0n;
        }

        const rpcUrl = process.env.NEXT_PUBLIC_MONAD_RPC_URL ||
            (monad.id === 143 ? 'https://rpc.monad.xyz' : 'https://testnet-rpc.monad.xyz');

        const publicClient = createPublicClient({
            chain: monad,
            transport: http(rpcUrl),
        });

        try {
            // 2. Fetch the correct LP token address from TheCellar contract
            const lpTokenAddress = await publicClient.readContract({
                address: cellarAddress as `0x${string}`,
                abi: parseAbi(['function cellarToken() view returns (address)']),
                functionName: 'cellarToken',
            }) as string;

            // 3. Get User Balance
            const balance = await publicClient.readContract({
                address: lpTokenAddress as `0x${string}`,
                abi: parseAbi(['function balanceOf(address) view returns (uint256)']),
                functionName: 'balanceOf',
                args: [userAddress as `0x${string}`],
            });
            return balance as bigint;
        } catch (error) {
            console.error("Error fetching LP balance:", error);
            return 0n;
        }
    },
};
