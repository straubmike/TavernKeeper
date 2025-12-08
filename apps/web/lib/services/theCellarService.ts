
import { createPublicClient, formatEther, http, parseAbi } from 'viem';
import { monad } from '../chains';
import { CONTRACT_ADDRESSES } from '../contracts/addresses';
import { CONTRACT_REGISTRY, getContractAddress } from '../contracts/registry';

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

    async getCellarState(forceRefresh = false): Promise<CellarState> {
        const now = Date.now();
        if (!forceRefresh && this._cache.data && (now - this._cache.timestamp < this._cache.ttl)) {
            return this._cache.data;
        }

        try {
            const contractConfig = CONTRACT_REGISTRY.THECELLAR;
            const contractAddress = getContractAddress(contractConfig);

            if (!contractAddress) {
                console.error('THECELLAR: Contract address not found. Check CONTRACT_ADDRESSES.');
                throw new Error("TheCellar contract not found");
            }

            // Use chain's RPC URL (includes Alchemy if configured)
            const rpcUrl = process.env.NEXT_PUBLIC_MONAD_RPC_URL || monad.rpcUrls.default.http[0];

            const publicClient = createPublicClient({
                chain: monad,
                transport: http(rpcUrl),
            });

            // V3 Cellar calls: potBalanceMON, potBalanceKEEP, getAuctionPrice, slot0
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
                    functionName: 'getAuctionPrice',
                    args: [],
                }),
                publicClient.readContract({
                    address: contractAddress,
                    abi: contractConfig.abi,
                    functionName: 'slot0',
                    args: [],
                }),
            ]);

            let potMON = 0n;
            let potKEEP = 0n;
            let currentPrice = 0n;
            let slot0Data: any = null;

            if (results[0].status === 'fulfilled') potMON = results[0].value as bigint;
            if (results[1].status === 'fulfilled') potKEEP = results[1].value as bigint;
            if (results[2].status === 'fulfilled') currentPrice = results[2].value as bigint;
            if (results[3].status === 'fulfilled') slot0Data = results[3].value;

            // Extract slot0 data
            const epochId = slot0Data ? Number(slot0Data.epochId) : 0;
            const initPrice = slot0Data ? formatEther(slot0Data.initPrice) : '0';
            const startTime = slot0Data ? Number(slot0Data.startTime) * 1000 : now; // Convert to milliseconds

            const newState = {
                potSize: formatEther(potMON), // MON share of pot
                potSizeKeep: formatEther(potKEEP), // KEEP share of pot
                currentPrice: formatEther(currentPrice), // Current auction price from contract
                epochId: epochId,
                startTime: startTime,
                initPrice: initPrice,
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
        const rpcUrl = process.env.NEXT_PUBLIC_MONAD_RPC_URL || monad.rpcUrls.default.http[0];

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

        const rpcUrl = process.env.NEXT_PUBLIC_MONAD_RPC_URL || monad.rpcUrls.default.http[0];

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

    async getPoolStats(): Promise<{
        totalCLPSupply: bigint;
        positionLiquidity: bigint;
        totalLiquidity: bigint;
    } | null> {
        try {
            const cellarConfig = CONTRACT_REGISTRY.THECELLAR;
            const cellarAddress = getContractAddress(cellarConfig);

            if (!cellarAddress) {
                console.error("TheCellar contract not found");
                return null;
            }

            const rpcUrl = process.env.NEXT_PUBLIC_MONAD_RPC_URL ||
                (monad.id === 143 ? 'https://rpc.monad.xyz' : 'https://testnet-rpc.monad.xyz');

            const publicClient = createPublicClient({
                chain: monad,
                transport: http(rpcUrl),
            });

            // Get CLP token address
            const lpTokenAddress = await publicClient.readContract({
                address: cellarAddress as `0x${string}`,
                abi: parseAbi(['function cellarToken() view returns (address)']),
                functionName: 'cellarToken',
            }) as string;

            // Get tokenId and totalLiquidity from TheCellar
            const [tokenId, totalLiquidity] = await Promise.all([
                publicClient.readContract({
                    address: cellarAddress as `0x${string}`,
                    abi: parseAbi(['function tokenId() view returns (uint256)']),
                    functionName: 'tokenId',
                }),
                publicClient.readContract({
                    address: cellarAddress as `0x${string}`,
                    abi: parseAbi(['function totalLiquidity() view returns (uint256)']),
                    functionName: 'totalLiquidity',
                }),
            ]);

            if (tokenId === 0n) {
                return null;
            }

            // Get total CLP supply
            const totalCLPSupply = await publicClient.readContract({
                address: lpTokenAddress as `0x${string}`,
                abi: parseAbi(['function totalSupply() view returns (uint256)']),
                functionName: 'totalSupply',
            }) as bigint;

            // Get position liquidity from Position Manager
            const positionManagerAddress = CONTRACT_ADDRESSES.V3_POSITION_MANAGER;
            const position = await publicClient.readContract({
                address: positionManagerAddress as `0x${string}`,
                abi: parseAbi([
                    'function positions(uint256 tokenId) external view returns (uint96 nonce, address operator, address token0, address token1, uint24 fee, int24 tickLower, int24 tickUpper, uint128 liquidity, uint256 feeGrowthInside0LastX128, uint256 feeGrowthInside1LastX128, uint128 tokensOwed0, uint128 tokensOwed1)'
                ]),
                functionName: 'positions',
                args: [tokenId],
            });

            const positionLiquidity = BigInt(position[7].toString()); // liquidity is at index 7

            return {
                totalCLPSupply,
                positionLiquidity,
                totalLiquidity: totalLiquidity as bigint,
            };
        } catch (error) {
            console.error("Error fetching pool stats:", error);
            return null;
        }
    },
};
