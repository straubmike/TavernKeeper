import { createPublicClient, http, type Address, type WalletClient, parseEther, formatEther, encodeFunctionData, encodeAbiParameters, keccak256 } from 'viem';
import { monad } from '../chains';
import { CONTRACT_ADDRESSES } from '../contracts/addresses';

// Type definitions (inline to avoid ethers dependency in typechain types)
type PoolKeyStruct = {
    currency0: Address;
    currency1: Address;
    fee: number;
    tickSpacing: number;
    hooks: Address;
};

type SwapParamsStruct = {
    zeroForOne: boolean;
    amountSpecified: bigint;
    sqrtPriceLimitX96: bigint;
};

/**
 * Uniswap V4 Swap Service
 *
 * Handles swaps between MON (native) and KEEP (ERC20) tokens
 * via the Uniswap V4 pool with CellarHook
 */

export interface SwapQuote {
    amountIn: bigint;
    amountOut: bigint;
    priceImpact: number; // Percentage
    sqrtPriceX96?: bigint;
    liquidity?: bigint;
}

export interface SwapParams {
    tokenIn: 'MON' | 'KEEP';
    tokenOut: 'MON' | 'KEEP';
    amountIn: bigint;
    slippageTolerance?: number; // Percentage (default 0.5%)
}

export interface PoolKey {
    currency0: Address; // MON (native) = address(0)
    currency1: Address; // KEEP token address
    fee: number; // 10000 (1%)
    tickSpacing: number; // 200
    hooks: Address; // CellarHook address
}

/**
 * Get the PoolKey for the KEEP/MON pool
 */
export function getPoolKey(): PoolKey {
    return {
        currency0: '0x0000000000000000000000000000000000000000' as Address, // MON (native)
        currency1: CONTRACT_ADDRESSES.KEEP_TOKEN, // KEEP token
        fee: 10000, // 1.0% fee
        tickSpacing: 200,
        hooks: CONTRACT_ADDRESSES.THE_CELLAR, // CellarHook address
    };
}

/**
 * Convert PoolKey to the format expected by contracts
 */
export function poolKeyToStruct(poolKey: PoolKey): PoolKeyStruct {
    return {
        currency0: poolKey.currency0,
        currency1: poolKey.currency1,
        fee: poolKey.fee,
        tickSpacing: poolKey.tickSpacing,
        hooks: poolKey.hooks,
    };
}

/**
 * Calculate pool ID from PoolKey (keccak256 of encoded PoolKey)
 */
function calculatePoolId(poolKey: PoolKey): `0x${string}` {
    const encoded = encodeAbiParameters(
        [
            { type: 'address', name: 'currency0' },
            { type: 'address', name: 'currency1' },
            { type: 'uint24', name: 'fee' },
            { type: 'int24', name: 'tickSpacing' },
            { type: 'address', name: 'hooks' },
        ],
        [
            poolKey.currency0,
            poolKey.currency1,
            poolKey.fee,
            poolKey.tickSpacing,
            poolKey.hooks,
        ]
    );

    return keccak256(encoded);
}

/**
 * Get pool state from PoolManager
 */
export async function getPoolState(): Promise<{
    sqrtPriceX96: bigint;
    tick: number;
    liquidity: bigint;
} | null> {
    try {
        const rpcUrl = process.env.NEXT_PUBLIC_MONAD_RPC_URL ||
            (monad.id === 143 ? 'https://rpc.monad.xyz' : 'https://testnet-rpc.monad.xyz');

        const publicClient = createPublicClient({
            chain: monad,
            transport: http(rpcUrl),
        });

        const poolKey = getPoolKey();
        const poolId = calculatePoolId(poolKey);

        // Read slot0 and liquidity
        const [slot0Result, liquidityResult] = await Promise.all([
            publicClient.readContract({
                address: CONTRACT_ADDRESSES.POOL_MANAGER,
                abi: [
                    {
                        inputs: [{ name: 'id', type: 'bytes32' }],
                        name: 'getSlot0',
                        outputs: [
                            { name: 'sqrtPriceX96', type: 'uint160' },
                            { name: 'tick', type: 'int24' },
                            { name: 'protocolFee', type: 'uint24' },
                            { name: 'lpFee', type: 'uint24' },
                        ],
                        stateMutability: 'view',
                        type: 'function',
                    },
                ],
                functionName: 'getSlot0',
                args: [poolId],
            }),
            publicClient.readContract({
                address: CONTRACT_ADDRESSES.POOL_MANAGER,
                abi: [
                    {
                        inputs: [{ name: 'id', type: 'bytes32' }],
                        name: 'getLiquidity',
                        outputs: [{ name: '', type: 'uint128' }],
                        stateMutability: 'view',
                        type: 'function',
                    },
                ],
                functionName: 'getLiquidity',
                args: [poolId],
            }),
        ]) as [any, bigint];

        // Handle different response formats
        const sqrtPriceX96 = slot0Result[0] || slot0Result?.sqrtPriceX96 || 0n;
        const tick = slot0Result[1] || slot0Result?.tick || 0;

        console.log('getPoolState: sqrtPriceX96:', sqrtPriceX96.toString());
        console.log('getPoolState: tick:', tick);
        console.log('getPoolState: liquidity:', liquidityResult.toString());

        if (sqrtPriceX96 === 0n) {
            console.warn('⚠️ Pool not initialized (sqrtPriceX96 = 0)');
            return null; // Pool not initialized
        }

        return {
            sqrtPriceX96: BigInt(sqrtPriceX96),
            tick: Number(tick),
            liquidity: BigInt(liquidityResult),
        };
    } catch (error) {
        console.error('Error getting pool state:', error);
        return null;
    }
}

/**
 * Calculate swap quote (simplified - for exact calculation would need to simulate swap)
 * This is a basic estimate based on pool price
 */
export async function getSwapQuote(params: SwapParams): Promise<SwapQuote | null> {
    const poolState = await getPoolState();
    if (!poolState || poolState.liquidity === 0n) {
        return null;
    }

    // Calculate price from sqrtPriceX96
    // price = (sqrtPriceX96 / 2^96)^2
    // Pool stores price as sqrtPriceX96 = sqrt(amount1/amount0) * 2^96
    // So price (amount1/amount0) = (sqrtPriceX96 / 2^96)^2
    const Q96 = 2n ** 96n;
    const sqrtPrice = Number(poolState.sqrtPriceX96) / Number(Q96);
    const price = sqrtPrice * sqrtPrice;

    // MON is currency0 (native), KEEP is currency1
    // Price represents: amount of KEEP per MON

    let amountOut: bigint;
    let priceImpact = 0;

    if (params.tokenIn === 'MON' && params.tokenOut === 'KEEP') {
        // Swapping MON (currency0) for KEEP (currency1)
        // amountOut = amountIn * price * (1 - fee)
        const feeMultiplier = 99n; // 99% after 1% fee
        const priceBigInt = BigInt(Math.floor(price * 1e18)); // Scale to wei precision
        amountOut = (params.amountIn * priceBigInt * feeMultiplier) / (BigInt(1e18) * 100n);

        // Simple price impact estimate
        const impactPercent = Number((params.amountIn * 10000n) / (poolState.liquidity + params.amountIn));
        priceImpact = Math.min(impactPercent, 100);
    } else {
        // Swapping KEEP (currency1) for MON (currency0)
        // amountOut = amountIn / price * (1 - fee)
        const feeMultiplier = 99n;
        if (price === 0) return null;
        const priceBigInt = BigInt(Math.floor(price * 1e18));
        amountOut = (params.amountIn * BigInt(1e18) * feeMultiplier) / (priceBigInt * 100n);

        const impactPercent = Number((params.amountIn * 10000n) / (poolState.liquidity + params.amountIn));
        priceImpact = Math.min(impactPercent, 100);
    }

    return {
        amountIn: params.amountIn,
        amountOut,
        priceImpact,
        sqrtPriceX96: poolState.sqrtPriceX96,
        liquidity: poolState.liquidity,
    };
}

/**
 * Execute swap transaction using SwapRouterV4
 */
export async function executeSwap(
    walletClient: WalletClient,
    params: SwapParams
): Promise<`0x${string}`> {
    if (!walletClient.account) {
        throw new Error('Wallet not connected');
    }

    const rpcUrl = process.env.NEXT_PUBLIC_MONAD_RPC_URL ||
        (monad.id === 143 ? 'https://rpc.monad.xyz' : 'https://testnet-rpc.monad.xyz');

    const publicClient = createPublicClient({
        chain: monad,
        transport: http(rpcUrl),
    });

    const poolKey = poolKeyToStruct(getPoolKey());

    // Determine swap direction
    // zeroForOne: true means swapping currency0 for currency1 (MON -> KEEP)
    // zeroForOne: false means swapping currency1 for currency0 (KEEP -> MON)
    const zeroForOne = params.tokenIn === 'MON';

    // amountSpecified must be positive for exact input
    // For exact input, we use positive amountSpecified
    const amountSpecified = params.amountIn;

    // sqrtPriceLimitX96: 0 means no limit
    const swapParams: SwapParamsStruct = {
        zeroForOne,
        amountSpecified: amountSpecified,
        sqrtPriceLimitX96: 0n, // No price limit
    };

    // Get SwapRouterV4 address (will need to be deployed first)
    // For now, check if it exists in addresses, otherwise throw helpful error
    let swapRouterAddress: Address;
    try {
        // Try to get from addresses.ts or use a known address
        // TODO: Add SWAP_ROUTER_V4 to addresses.ts after deployment
        swapRouterAddress = CONTRACT_ADDRESSES.SWAP_ROUTER_V4 || '0x0000000000000000000000000000000000000000' as Address;

        if (swapRouterAddress === '0x0000000000000000000000000000000000000000') {
            throw new Error('SWAP_ROUTER_V4 not deployed. Please deploy SwapRouterV4 first.');
        }
    } catch (e) {
        throw new Error(
            'SwapRouterV4 not deployed. ' +
            'Please deploy SwapRouterV4 contract first using: ' +
            'npx hardhat run scripts/deploy_swap_router.ts --network monad'
        );
    }

    // Prepare transaction
    const value = params.tokenIn === 'MON' ? params.amountIn : 0n;

    // For ERC20 (KEEP), user must approve router first
    if (params.tokenIn === 'KEEP') {
        // Check allowance
        const allowance = await publicClient.readContract({
            address: CONTRACT_ADDRESSES.KEEP_TOKEN,
            abi: [
                {
                    inputs: [
                        { name: 'owner', type: 'address' },
                        { name: 'spender', type: 'address' },
                    ],
                    name: 'allowance',
                    outputs: [{ name: '', type: 'uint256' }],
                    stateMutability: 'view',
                    type: 'function',
                },
            ],
            functionName: 'allowance',
            args: [walletClient.account.address, swapRouterAddress],
        }) as bigint;

        if (allowance < params.amountIn) {
            // Need to approve - this should be done in the UI before swap
            throw new Error(
                `Insufficient KEEP allowance. Please approve SwapRouterV4 to spend ${formatEther(params.amountIn)} KEEP first.`
            );
        }
    }

    // Execute swap via router
    const hash = await walletClient.writeContract({
        address: swapRouterAddress,
        abi: [
            {
                inputs: [
                    {
                        name: 'key',
                        type: 'tuple',
                        components: [
                            { name: 'currency0', type: 'address' },
                            { name: 'currency1', type: 'address' },
                            { name: 'fee', type: 'uint24' },
                            { name: 'tickSpacing', type: 'int24' },
                            { name: 'hooks', type: 'address' },
                        ],
                    },
                    {
                        name: 'params',
                        type: 'tuple',
                        components: [
                            { name: 'zeroForOne', type: 'bool' },
                            { name: 'amountSpecified', type: 'int256' },
                            { name: 'sqrtPriceLimitX96', type: 'uint160' },
                        ],
                    },
                    { name: 'recipient', type: 'address' },
                ],
                name: 'swapExactInput',
                outputs: [{ name: 'delta', type: 'int256' }],
                stateMutability: 'payable',
                type: 'function',
            },
        ],
        functionName: 'swapExactInput',
        args: [poolKey, swapParams, walletClient.account.address],
        value: value,
        account: walletClient.account,
        chain: monad,
    });

    return hash;
}

/**
 * Check if pool is initialized and has liquidity
 */
export async function isPoolReady(): Promise<boolean> {
    try {
        // Check if pool has liquidity (this is the most reliable check)
        const poolLiquidity = await getPoolLiquidity();
        if (!poolLiquidity) {
            console.log('Pool ready check: No liquidity data available');
            return false;
        }

        // Pool is ready if it has both MON and KEEP (two-sided liquidity)
        const hasBothAssets = poolLiquidity.mon > 0n && poolLiquidity.keep > 0n;

        // Also try to check pool state, but don't fail if it doesn't work
        let hasValidPrice = false;
        try {
            const state = await getPoolState();
            hasValidPrice = state !== null && state.sqrtPriceX96 > 0n;
        } catch (e) {
            console.warn('Could not check pool state, using liquidity check only:', e);
        }

        // Pool is ready if it has both assets OR has valid price
        const isReady = hasBothAssets || hasValidPrice;

        console.log('Pool ready check:', {
            hasBothAssets,
            poolMon: formatEther(poolLiquidity.mon),
            poolKeep: formatEther(poolLiquidity.keep),
            hasValidPrice,
            isReady
        });

        return isReady;
    } catch (error) {
        console.error('Error checking pool readiness:', error);
        // If we can't check, assume not ready to be safe
        return false;
    }
}

/**
 * Get pool liquidity balances (MON and KEEP in the pool)
 */
export async function getPoolLiquidity(): Promise<{
    mon: bigint;
    keep: bigint;
} | null> {
    try {
        const rpcUrl = process.env.NEXT_PUBLIC_MONAD_RPC_URL ||
            (monad.id === 143 ? 'https://rpc.monad.xyz' : 'https://testnet-rpc.monad.xyz');

        console.log('getPoolLiquidity: Using RPC:', rpcUrl);
        console.log('getPoolLiquidity: PoolManager address:', CONTRACT_ADDRESSES.POOL_MANAGER);
        console.log('getPoolLiquidity: KEEP_TOKEN address:', CONTRACT_ADDRESSES.KEEP_TOKEN);

        const publicClient = createPublicClient({
            chain: monad,
            transport: http(rpcUrl),
        });

        // Get balances from PoolManager (where liquidity actually is)
        const [monBalance, keepBalance] = await Promise.all([
            publicClient.getBalance({ address: CONTRACT_ADDRESSES.POOL_MANAGER }),
            publicClient.readContract({
                address: CONTRACT_ADDRESSES.KEEP_TOKEN,
                abi: [
                    {
                        inputs: [{ name: 'account', type: 'address' }],
                        name: 'balanceOf',
                        outputs: [{ name: '', type: 'uint256' }],
                        stateMutability: 'view',
                        type: 'function',
                    },
                ],
                functionName: 'balanceOf',
                args: [CONTRACT_ADDRESSES.POOL_MANAGER],
            }) as Promise<bigint>,
        ]);

        console.log('getPoolLiquidity: MON balance (wei):', monBalance.toString());
        console.log('getPoolLiquidity: KEEP balance (wei):', keepBalance.toString());
        console.log('getPoolLiquidity: MON balance (formatted):', formatEther(monBalance));
        console.log('getPoolLiquidity: KEEP balance (formatted):', formatEther(keepBalance));

        return {
            mon: monBalance,
            keep: keepBalance,
        };
    } catch (error) {
        console.error('❌ Error fetching pool liquidity:', error);
        if (error instanceof Error) {
            console.error('   Error message:', error.message);
            console.error('   Error stack:', error.stack);
        }
        return null;
    }
}

/**
 * Get token balances for an address
 */
export async function getTokenBalances(address: Address): Promise<{
    mon: bigint;
    keep: bigint;
}> {
    const publicClient = createPublicClient({
        chain: monad,
        transport: http(),
    });

    const [monBalance, keepBalance] = await Promise.all([
        publicClient.getBalance({ address }),
        publicClient.readContract({
            address: CONTRACT_ADDRESSES.KEEP_TOKEN,
            abi: [
                {
                    inputs: [{ name: 'account', type: 'address' }],
                    name: 'balanceOf',
                    outputs: [{ name: '', type: 'uint256' }],
                    stateMutability: 'view',
                    type: 'function',
                },
            ],
            functionName: 'balanceOf',
            args: [address],
        }) as Promise<bigint>,
    ]);

    return {
        mon: monBalance,
        keep: keepBalance,
    };
}

