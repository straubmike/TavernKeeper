import { createPublicClient, formatEther, http, parseEther } from 'viem';
import { monad } from '../chains';
import { CONTRACT_REGISTRY, getContractAddress } from '../contracts/registry';

export interface CellarState {
    potSize: string; // ETH in the contract
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

            console.log('THECELLAR: Using contract address:', contractAddress);
            console.log('THECELLAR: Chain ID:', monad.id);
            console.log('THECELLAR: Network:', monad.name);

            // Use RPC from env or default based on chain ID
            const rpcUrl = process.env.NEXT_PUBLIC_MONAD_RPC_URL ||
                (monad.id === 143 ? 'https://rpc.monad.xyz' : 'https://testnet-rpc.monad.xyz');

            console.log('THECELLAR: Using RPC:', rpcUrl);

            const publicClient = createPublicClient({
                chain: monad,
                transport: http(rpcUrl),
            });

            const results = await Promise.allSettled([
                publicClient.readContract({
                    address: contractAddress,
                    abi: contractConfig.abi,
                    functionName: 'potBalance',
                    args: [],
                }),
                publicClient.readContract({
                    address: contractAddress,
                    abi: contractConfig.abi,
                    functionName: 'slot0',
                    args: [],
                }),
                publicClient.readContract({
                    address: contractAddress,
                    abi: contractConfig.abi,
                    functionName: 'getAuctionPrice',
                    args: [],
                }),
            ]);

            let potSize = 0n;
            let slot0: any = {
                epochId: 0,
                initPrice: 0n,
                startTime: 0,
            };
            let currentPrice = 0n;
            // Payment token is the CellarHook contract itself (CLP)
            let paymentToken = contractAddress;

            // Log any failures for debugging
            if (results[0].status === 'fulfilled') {
                potSize = results[0].value as bigint;
                console.log('✅ potBalance read successfully:', formatEther(potSize), 'MON');
            } else {
                const error = results[0].reason as any;
                console.error('❌ Failed to fetch potBalance:', error?.message || error);
                console.error('   Error details:', error);
            }

            if (results[1].status === 'fulfilled') {
                slot0 = results[1].value;
                console.log('✅ slot0 read successfully, epochId:', slot0.epochId);
            } else {
                const error = results[1].reason as any;
                console.error('❌ Failed to fetch slot0:', error?.message || error);
                console.error('   Error details:', error);
            }

            if (results[2].status === 'fulfilled') {
                currentPrice = results[2].value as bigint;
                console.log('✅ getAuctionPrice read successfully:', formatEther(currentPrice), 'LP');
            } else {
                const error = results[2].reason as any;
                console.error('❌ Failed to fetch getAuctionPrice:', error?.message || error);
                console.error('   Error details:', error);
            }

            const newState = {
                potSize: formatEther(potSize),
                currentPrice: formatEther(currentPrice),
                epochId: Number(slot0.epochId),
                startTime: Number(slot0.startTime) * 1000,
                initPrice: formatEther(slot0.initPrice),
                paymentToken,
            };

            this._cache.data = newState;
            this._cache.timestamp = now;

            return newState;
        } catch (error) {
            console.error("Error fetching cellar state:", error);
            if (this._cache.data) return this._cache.data;
            return {
                potSize: '0',
                currentPrice: '0',
                epochId: 0,
                startTime: Date.now(),
                initPrice: '0',
                paymentToken: '0x0000000000000000000000000000000000000000',
            };
        }
    },

    async getAllowance(owner: string, tokenAddress: string): Promise<bigint> {
        // CellarHook (CLP) is the token and the spender (burner).
        // Since raid() calls _burn(msg.sender), no approval is needed.
        // We return max uint256 to simulate infinite approval.
        return 115792089237316195423570985008687907853269984665640564039457584007913129639935n;
    },

    async approve(client: any, tokenAddress: string, amount: bigint) {
        // No-op for CellarHook raid
        return "0x";
    },

    async claim(client: any, accountAddress?: string) {
        const contractConfig = CONTRACT_REGISTRY.THECELLAR;
        const contractAddress = getContractAddress(contractConfig);

        if (!contractAddress) throw new Error("TheCellar contract not found");

        let account = client.account;
        if (!account && accountAddress) {
            account = accountAddress as `0x${string}`;
        }

        if (!account) {
            throw new Error("Account not found.");
        }

        const state = await this.getCellarState();

        // Add buffer to max price (5%)
        const price = parseEther(state.currentPrice);
        const maxPaymentAmount = (price * 105n) / 100n;

        const hash = await client.writeContract({
            address: contractAddress,
            abi: contractConfig.abi,
            functionName: 'raid',
            chain: monad,
            account: account,
            args: [maxPaymentAmount],
        });

        return hash;
    },

    async getUserLpBalance(address: string): Promise<bigint> {
        const contractConfig = CONTRACT_REGISTRY.THECELLAR;
        const contractAddress = getContractAddress(contractConfig);
        if (!contractAddress) {
            console.error('THECELLAR: Contract address not found');
            return 0n;
        }

        try {
            // Use RPC from env or default based on chain ID
            const rpcUrl = process.env.NEXT_PUBLIC_MONAD_RPC_URL ||
                (monad.id === 143 ? 'https://rpc.monad.xyz' : 'https://testnet-rpc.monad.xyz');

            const publicClient = createPublicClient({
                chain: monad,
                transport: http(rpcUrl),
            });

            const balance = await publicClient.readContract({
                address: contractAddress,
                abi: contractConfig.abi,
                functionName: 'balanceOf',
                args: [address as `0x${string}`],
            });

            return balance as bigint;
        } catch (error: any) {
            console.error('❌ Error fetching LP balance:', error?.message || error);
            console.error('   Address:', address);
            console.error('   Contract:', contractAddress);
            console.error('   Full error:', error);
            return 0n;
        }
    },

    async getKeepAllowance(owner: string, spender: string): Promise<bigint> {
        const keepConfig = CONTRACT_REGISTRY.KEEP_TOKEN;
        const keepAddress = getContractAddress(keepConfig);
        if (!keepAddress) return 0n;

        // Use RPC from env or default based on chain
        const rpcUrl = process.env.NEXT_PUBLIC_MONAD_RPC_URL ||
            (monad.id === 143 ? 'https://rpc.monad.xyz' : 'https://testnet-rpc.monad.xyz');

        const publicClient = createPublicClient({
            chain: monad,
            transport: http(rpcUrl),
        });

        const allowance = await publicClient.readContract({
            address: keepAddress,
            abi: keepConfig.abi,
            functionName: 'allowance',
            args: [owner, spender],
        });

        return allowance as bigint;
    },

    async approveKeep(client: any, spender: string, amount: bigint) {
        const keepConfig = CONTRACT_REGISTRY.KEEP_TOKEN;
        const keepAddress = getContractAddress(keepConfig);
        if (!keepAddress) throw new Error("KEEP token not found");

        const hash = await client.writeContract({
            address: keepAddress,
            abi: keepConfig.abi,
            functionName: 'approve',
            chain: monad,
            account: client.account,
            args: [spender, amount],
        });

        return hash;
    }
};
