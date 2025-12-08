
import { createPublicClient, formatEther, http, parseAbi, type Address, type WalletClient } from 'viem';
import { monad } from '../chains';
import { CONTRACT_ADDRESSES } from '../contracts/addresses';

// V3 Pool ABI
const POOL_ABI = parseAbi([
    'function slot0() view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)',
    'function liquidity() view returns (uint128)',
    'function fee() view returns (uint24)'
]);

// V3 Pool Token ABI (for token0/token1)
const V3_POOL_TOKEN_ABI = parseAbi([
    'function token0() view returns (address)',
    'function token1() view returns (address)'
]);

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

/**
 * Get pool state from V3 Pool (Direct Read)
 * Replaces V4 PoolManager Storage Read
 */
// Cache for pool state to reduce RPC calls
let poolStateCache: {
    data: {
        sqrtPriceX96: bigint;
        tick: number;
        liquidity: bigint;
    } | null;
    timestamp: number;
    ttl: number;
} = {
    data: null,
    timestamp: 0,
    ttl: 30000, // 30 seconds cache
};


/**
 * Get pool state from V3 Pool (Direct Read)
 * Replaces V4 PoolManager Storage Read
 * Includes caching to reduce RPC calls
 */
export async function getPoolState(forceRefresh = false): Promise<{
    sqrtPriceX96: bigint;
    tick: number;
    liquidity: bigint;
} | null> {
    // Check cache first
    const now = Date.now();
    if (!forceRefresh && poolStateCache.data && (now - poolStateCache.timestamp < poolStateCache.ttl)) {
        return poolStateCache.data;
    }

    try {
        const rpcUrl = process.env.NEXT_PUBLIC_MONAD_RPC_URL || monad.rpcUrls.default.http[0];

        const publicClient = createPublicClient({
            chain: monad,
            transport: http(rpcUrl, {
                timeout: 10000, // 10 second timeout
                retryCount: 0, // We handle retries manually
            }),
        });

        const poolAddress = CONTRACT_ADDRESSES.V3_POOL;
        if (!poolAddress || poolAddress === '0x0000000000000000000000000000000000000000') {
            console.warn('V3 Pool Address not configured');
            return poolStateCache.data; // Return cached data if available
        }

        const [slot0, liquidity] = await Promise.all([
            publicClient.readContract({
                address: poolAddress,
                abi: POOL_ABI,
                functionName: 'slot0'
            }),
            publicClient.readContract({
                address: poolAddress,
                abi: POOL_ABI,
                functionName: 'liquidity'
            })
        ]);

        const sqrtPriceX96 = slot0[0];
        const tick = slot0[1];

        if (sqrtPriceX96 === 0n) {
            console.warn('⚠️ Pool not initialized (sqrtPriceX96 = 0)');
            // Don't cache invalid state
            return poolStateCache.data; // Return cached data if available
        }

        const state = {
            sqrtPriceX96: BigInt(sqrtPriceX96),
            tick: Number(tick),
            liquidity: BigInt(liquidity),
        };

        // Update cache
        poolStateCache.data = state;
        poolStateCache.timestamp = now;

        return state;

    } catch (error: any) {
        console.error('Error getting pool state:', error);
        // Return cached data if available on error
        if (poolStateCache.data) {
            console.warn('Returning cached pool state due to error');
            return poolStateCache.data;
        }
        return null;
    }
}

/**
 * Clear pool state cache
 */
export function clearPoolStateCache() {
    poolStateCache.data = null;
    poolStateCache.timestamp = 0;
}

// ... Keep other functions compatible ...
// We'll update isPoolReady to use the V3 state

export async function isPoolReady(): Promise<boolean> {
    try {
        const state = await getPoolState();
        if (!state) return false;

        // Pool is ready if it's initialized (has a valid price)
        // Liquidity can be 0 initially - that's okay, users just can't swap yet
        const isReady = state.sqrtPriceX96 > 0n;
        return isReady;

    } catch (error) {
        console.error('Error checking pool readiness:', error);
        // Return false but don't throw - let UI handle retry
        return false;
    }
}

// getSwapQuote needs to be retained as it's used by UI
export async function getSwapQuote(params: SwapParams): Promise<SwapQuote | null> {
    const poolState = await getPoolState();
    if (!poolState || poolState.liquidity === 0n) {
        return null;
    }

    // Get actual token addresses from pool
    const rpcUrl = process.env.NEXT_PUBLIC_MONAD_RPC_URL || monad.rpcUrls.default.http[0];

    const publicClient = createPublicClient({
        chain: monad,
        transport: http(rpcUrl),
    });

    const poolAddress = CONTRACT_ADDRESSES.V3_POOL;
    if (!poolAddress) {
        return null;
    }

    // Get actual token0 and token1 from pool
    const [token0, token1] = await Promise.all([
        publicClient.readContract({
            address: poolAddress,
            abi: V3_POOL_TOKEN_ABI,
            functionName: 'token0',
        }) as Promise<Address>,
        publicClient.readContract({
            address: poolAddress,
            abi: V3_POOL_TOKEN_ABI,
            functionName: 'token1',
        }) as Promise<Address>,
    ]);

    const wmonAddress = CONTRACT_ADDRESSES.WMON;
    const keepAddress = CONTRACT_ADDRESSES.KEEP_TOKEN;

    // Determine which token is which
    const isToken0WMON = token0.toLowerCase() === wmonAddress.toLowerCase();
    const isToken1WMON = token1.toLowerCase() === wmonAddress.toLowerCase();
    const isToken0KEEP = token0.toLowerCase() === keepAddress.toLowerCase();
    const isToken1KEEP = token1.toLowerCase() === keepAddress.toLowerCase();

    if (!isToken0WMON && !isToken1WMON) {
        console.error('Pool token0/token1 do not match WMON address');
        return null;
    }
    if (!isToken0KEEP && !isToken1KEEP) {
        console.error('Pool token0/token1 do not match KEEP address');
        return null;
    }

    // Calculate price from sqrtPriceX96
    // price = (sqrtPriceX96 / 2^96)^2 = token1/token0
    const Q96 = 2n ** 96n;
    const sqrtPrice = Number(poolState.sqrtPriceX96) / Number(Q96);
    const priceToken1PerToken0 = sqrtPrice * sqrtPrice;

    // Determine actual price: KEEP per MON (or MON per KEEP)
    let keepPerMon: number;
    if (isToken0WMON && isToken1KEEP) {
        // token0 = WMON, token1 = KEEP
        // price = token1/token0 = KEEP/WMON = KEEP/MON
        keepPerMon = priceToken1PerToken0;
    } else if (isToken0KEEP && isToken1WMON) {
        // token0 = KEEP, token1 = WMON
        // price = token1/token0 = WMON/KEEP = MON/KEEP
        // So KEEP/MON = 1/price
        keepPerMon = 1 / priceToken1PerToken0;
    } else {
        console.error('Unexpected token order in pool');
        return null;
    }

    // Calculate ideal output (no price impact, just fee)
    const feeMultiplier = 99n; // 1% fee (10000 basis points = 1%)
    let idealOutput: bigint;
    let amountOut: bigint;

    // Get pool reserves for price impact calculation (Q96 already declared above)
    let reserveIn: bigint;
    let reserveOut: bigint;

    if (isToken0KEEP && isToken1WMON) {
        // Token0 = KEEP, Token1 = WMON
        if (params.tokenIn === 'MON' && params.tokenOut === 'KEEP') {
            // Swapping WMON -> KEEP: reserveIn = WMON, reserveOut = KEEP
            reserveIn = (poolState.liquidity * poolState.sqrtPriceX96) / Q96; // WMON (token1)
            reserveOut = (poolState.liquidity * Q96) / poolState.sqrtPriceX96; // KEEP (token0)
        } else {
            // Swapping KEEP -> WMON: reserveIn = KEEP, reserveOut = WMON
            reserveIn = (poolState.liquidity * Q96) / poolState.sqrtPriceX96; // KEEP (token0)
            reserveOut = (poolState.liquidity * poolState.sqrtPriceX96) / Q96; // WMON (token1)
        }
    } else {
        // Token0 = WMON, Token1 = KEEP
        if (params.tokenIn === 'MON' && params.tokenOut === 'KEEP') {
            // Swapping WMON -> KEEP: reserveIn = WMON, reserveOut = KEEP
            reserveIn = (poolState.liquidity * Q96) / poolState.sqrtPriceX96; // WMON (token0)
            reserveOut = (poolState.liquidity * poolState.sqrtPriceX96) / Q96; // KEEP (token1)
        } else {
            // Swapping KEEP -> WMON: reserveIn = KEEP, reserveOut = WMON
            reserveIn = (poolState.liquidity * poolState.sqrtPriceX96) / Q96; // KEEP (token1)
            reserveOut = (poolState.liquidity * Q96) / poolState.sqrtPriceX96; // WMON (token0)
        }
    }

    if (params.tokenIn === 'MON' && params.tokenOut === 'KEEP') {
        // Swapping MON (WMON) -> KEEP
        const keepPerMonBigInt = BigInt(Math.floor(keepPerMon * 1e18));
        // Ideal output (no price impact, just fee)
        idealOutput = (params.amountIn * keepPerMonBigInt * feeMultiplier) / (BigInt(1e18) * 100n);

        // Actual output with price impact using constant product: x * y = k
        // With fee: amountOut = (amountIn * 99 * reserveOut) / (100 * reserveIn + 99 * amountIn)
        const amountInAfterFee = (params.amountIn * feeMultiplier) / 100n;
        amountOut = (amountInAfterFee * reserveOut) / (reserveIn + amountInAfterFee);

        // Apply conservative buffer (2%) to account for simplified calculation
        amountOut = (amountOut * 98n) / 100n;
    } else if (params.tokenIn === 'KEEP' && params.tokenOut === 'MON') {
        // Swapping KEEP -> MON (WMON)
        const monPerKeep = 1 / keepPerMon;
        if (monPerKeep === 0) return null;
        const monPerKeepBigInt = BigInt(Math.floor(monPerKeep * 1e18));
        // Ideal output (no price impact, just fee)
        idealOutput = (params.amountIn * monPerKeepBigInt * feeMultiplier) / (BigInt(1e18) * 100n);

        // Actual output with price impact
        const amountInAfterFee = (params.amountIn * feeMultiplier) / 100n;
        amountOut = (amountInAfterFee * reserveOut) / (reserveIn + amountInAfterFee);

        // Apply conservative buffer (2%) to account for simplified calculation
        amountOut = (amountOut * 98n) / 100n;
    } else {
        return null;
    }

    // Calculate price impact as percentage difference from ideal
    let priceImpact = 0;
    if (idealOutput > 0n && amountOut < idealOutput) {
        const impact = Number((idealOutput - amountOut) * 10000n) / Number(idealOutput);
        priceImpact = Math.min(impact / 100, 100); // Convert to percentage, cap at 100%
    }

    return {
        amountIn: params.amountIn,
        amountOut,
        priceImpact,
        sqrtPriceX96: poolState.sqrtPriceX96,
        liquidity: poolState.liquidity,
    };
}

// Cache for pool liquidity
let poolLiquidityCache: {
    data: { mon: bigint; keep: bigint } | null;
    timestamp: number;
    ttl: number;
} = {
    data: null,
    timestamp: 0,
    ttl: 30000, // 30 seconds cache
};

export async function getPoolLiquidity(forceRefresh = false): Promise<{
    mon: bigint;
    keep: bigint;
} | null> {
    // Check cache first
    const now = Date.now();
    if (!forceRefresh && poolLiquidityCache.data && (now - poolLiquidityCache.timestamp < poolLiquidityCache.ttl)) {
        return poolLiquidityCache.data;
    }

    const state = await getPoolState(forceRefresh);
    if (!state || state.liquidity === 0n || state.sqrtPriceX96 === 0n) {
        // Return cached data if available
        return poolLiquidityCache.data;
    }

    // Get actual token addresses from pool to determine order
    const rpcUrl = process.env.NEXT_PUBLIC_MONAD_RPC_URL || monad.rpcUrls.default.http[0];

    const publicClient = createPublicClient({
        chain: monad,
        transport: http(rpcUrl),
    });

    const poolAddress = CONTRACT_ADDRESSES.V3_POOL;
    if (!poolAddress || poolAddress === '0x0000000000000000000000000000') {
        return poolLiquidityCache.data;
    }

    // Get actual token0 and token1 from pool
    const [token0, token1] = await Promise.all([
        publicClient.readContract({
            address: poolAddress,
            abi: V3_POOL_TOKEN_ABI,
            functionName: 'token0',
        }) as Promise<Address>,
        publicClient.readContract({
            address: poolAddress,
            abi: V3_POOL_TOKEN_ABI,
            functionName: 'token1',
        }) as Promise<Address>,
    ]);

    const wmonAddress = CONTRACT_ADDRESSES.WMON;
    const keepAddress = CONTRACT_ADDRESSES.KEEP_TOKEN;

    // Determine which token is which
    const isToken0WMON = token0.toLowerCase() === wmonAddress.toLowerCase();
    const isToken1KEEP = token1.toLowerCase() === keepAddress.toLowerCase();
    const isToken0KEEP = token0.toLowerCase() === keepAddress.toLowerCase();
    const isToken1WMON = token1.toLowerCase() === wmonAddress.toLowerCase();

    // Estimate based on liquidity and price
    const Q96 = 2n ** 96n;
    const liquidity = state.liquidity;
    const sqrtPriceX96 = state.sqrtPriceX96;

    let monAmount: bigint;
    let keepAmount: bigint;

    if (isToken0WMON && isToken1KEEP) {
        // token0 = WMON, token1 = KEEP
        // Amount0 (WMON/MON) = Liquidity / sqrtPrice
        monAmount = (liquidity * Q96) / sqrtPriceX96;
        // Amount1 (KEEP) = Liquidity * sqrtPrice
        keepAmount = (liquidity * sqrtPriceX96) / Q96;
    } else if (isToken0KEEP && isToken1WMON) {
        // token0 = KEEP, token1 = WMON
        // Amount0 (KEEP) = Liquidity / sqrtPrice
        keepAmount = (liquidity * Q96) / sqrtPriceX96;
        // Amount1 (WMON/MON) = Liquidity * sqrtPrice
        monAmount = (liquidity * sqrtPriceX96) / Q96;
    } else {
        console.error('Pool token order not recognized');
        return poolLiquidityCache.data;
    }

    const result = { mon: monAmount, keep: keepAmount };

    // Update cache
    poolLiquidityCache.data = result;
    poolLiquidityCache.timestamp = now;

    return result;
}

export async function getTokenBalances(address: Address): Promise<{ mon: bigint; keep: bigint; wmon: bigint }> {
    const rpcUrl = process.env.NEXT_PUBLIC_MONAD_RPC_URL || monad.rpcUrls.default.http[0];

    const publicClient = createPublicClient({ chain: monad, transport: http(rpcUrl) });

    const wmonAddress = CONTRACT_ADDRESSES.WMON;

    const [monBalance, keepBalance, wmonBalance] = await Promise.all([
        publicClient.getBalance({ address }),
        publicClient.readContract({
            address: CONTRACT_ADDRESSES.KEEP_TOKEN,
            abi: parseAbi(['function balanceOf(address) view returns (uint256)']),
            functionName: 'balanceOf',
            args: [address],
        }) as Promise<bigint>,
        wmonAddress && wmonAddress !== '0x0000000000000000000000000000000000000000'
            ? publicClient.readContract({
                address: wmonAddress,
                abi: parseAbi(['function balanceOf(address) view returns (uint256)']),
                functionName: 'balanceOf',
                args: [address],
            }) as Promise<bigint>
            : Promise.resolve(0n),
    ]);

    return {
        mon: monBalance, // Native MON (can be wrapped to WMON)
        keep: keepBalance,
        wmon: wmonBalance || 0n, // WMON balance for swaps
    };
}

// V3 Swap Router ABI
const V3_ROUTER_ABI = parseAbi([
    'function swapExactInput(address pool, uint256 amountIn, uint256 amountOutMinimum, address recipient, bool zeroForOne) external payable returns (uint256 amountOut)'
]);

// WMON ABI (for wrapping)
const WMON_ABI = parseAbi([
    'function deposit() payable',
    'function balanceOf(address) view returns (uint256)',
    'function approve(address, uint256) returns (bool)'
]);

/**
 * Execute swap using V3 Swap Router
 * Handles MON wrapping to WMON if needed
 */
export async function executeSwap(
    walletClient: WalletClient,
    params: SwapParams
): Promise<`0x${string}`> {
    const rpcUrl = process.env.NEXT_PUBLIC_MONAD_RPC_URL || monad.rpcUrls.default.http[0];

    const publicClient = createPublicClient({
        chain: monad,
        transport: http(rpcUrl),
    });

    const poolAddress = CONTRACT_ADDRESSES.V3_POOL;
    const routerAddress = CONTRACT_ADDRESSES.V3_SWAP_ROUTER;
    const wmonAddress = CONTRACT_ADDRESSES.WMON;
    const keepAddress = CONTRACT_ADDRESSES.KEEP_TOKEN;

    if (!poolAddress || !routerAddress || !wmonAddress || !keepAddress) {
        throw new Error('Missing contract addresses');
    }

    // Get pool token order
    const [token0, token1] = await Promise.all([
        publicClient.readContract({
            address: poolAddress,
            abi: V3_POOL_TOKEN_ABI,
            functionName: 'token0',
        }) as Promise<Address>,
        publicClient.readContract({
            address: poolAddress,
            abi: V3_POOL_TOKEN_ABI,
            functionName: 'token1',
        }) as Promise<Address>,
    ]);

    // Determine swap direction
    // Token0 = KEEP, Token1 = WMON (from earlier test)
    const isKEEPtoWMON = params.tokenIn === 'KEEP' && params.tokenOut === 'MON';
    const isWMONtoKEEP = params.tokenIn === 'MON' && params.tokenOut === 'KEEP';

    if (!isKEEPtoWMON && !isWMONtoKEEP) {
        throw new Error(`Invalid swap direction: ${params.tokenIn} → ${params.tokenOut}`);
    }

    // zeroForOne: true = token0→token1 (KEEP→WMON), false = token1→token0 (WMON→KEEP)
    const zeroForOne = isKEEPtoWMON;

    // Get quote for slippage protection
    const quote = await getSwapQuote(params);
    if (!quote) {
        throw new Error('Failed to get swap quote');
    }

    const slippageTolerance = params.slippageTolerance || 3.0;
    const amountOutMinimum = (quote.amountOut * BigInt(10000 - Math.floor(slippageTolerance * 100))) / 10000n;

    if (!walletClient.account) {
        throw new Error('Wallet not connected');
    }
    const account = walletClient.account.address;

    // Handle MON → KEEP: Need to wrap MON to WMON first
    if (isWMONtoKEEP) {
        // Check WMON balance
        const wmonBalance = await publicClient.readContract({
            address: wmonAddress,
            abi: WMON_ABI,
            functionName: 'balanceOf',
            args: [account],
        }) as bigint;

        // Wrap MON to WMON if needed
        if (wmonBalance < params.amountIn) {
            const wrapAmount = params.amountIn - wmonBalance;
            const nativeBalance = await publicClient.getBalance({ address: account });

            if (nativeBalance < wrapAmount) {
                throw new Error(`Insufficient MON balance. Need ${formatEther(wrapAmount)} MON to wrap, but only have ${formatEther(nativeBalance)} MON.`);
            }

            console.log(`Wrapping ${formatEther(wrapAmount)} MON to WMON...`);
            const wrapHash = await walletClient.writeContract({
                account: walletClient.account,
                address: wmonAddress,
                abi: WMON_ABI,
                functionName: 'deposit',
                value: wrapAmount,
                chain: monad,
            });
            await publicClient.waitForTransactionReceipt({ hash: wrapHash });
            console.log('MON wrapped to WMON');
        }

        // Approve WMON to router
        const routerAllowance = await checkAllowance(wmonAddress, account, routerAddress, params.amountIn);
        if (!routerAllowance) {
            console.log('Approving WMON to router...');
            const approveHash = await walletClient.writeContract({
                account: walletClient.account,
                address: wmonAddress,
                abi: WMON_ABI,
                functionName: 'approve',
                args: [routerAddress, params.amountIn],
                chain: monad,
            });
            await publicClient.waitForTransactionReceipt({ hash: approveHash });
            console.log('WMON approved');
        }
    } else {
        // KEEP → MON: Approve KEEP to router
        const routerAllowance = await checkAllowance(keepAddress, account, routerAddress, params.amountIn);
        if (!routerAllowance) {
            console.log('Approving KEEP to router...');
            const approveHash = await walletClient.writeContract({
                account: walletClient.account,
                address: keepAddress,
                abi: parseAbi(['function approve(address, uint256) returns (bool)']),
                functionName: 'approve',
                args: [routerAddress, params.amountIn],
                chain: monad,
            });
            await publicClient.waitForTransactionReceipt({ hash: approveHash });
            console.log('KEEP approved');
        }
    }

    // Execute swap
    console.log(`Executing swap: ${params.tokenIn} → ${params.tokenOut}`);
    console.log(`Amount in: ${formatEther(params.amountIn)}`);
    console.log(`Amount out (min): ${formatEther(amountOutMinimum)}`);
    console.log(`Direction: ${zeroForOne ? 'token0→token1' : 'token1→token0'}`);

    const swapHash = await walletClient.writeContract({
        account: walletClient.account,
        address: routerAddress,
        abi: V3_ROUTER_ABI,
        functionName: 'swapExactInput',
        args: [
            poolAddress,
            params.amountIn,
            amountOutMinimum,
            account, // recipient
            zeroForOne,
        ],
        chain: monad,
    });

    return swapHash;
}

export async function checkAllowance(token: Address, owner: Address, spender: Address, amount: bigint): Promise<boolean> {
    const rpcUrl = process.env.NEXT_PUBLIC_MONAD_RPC_URL || monad.rpcUrls.default.http[0];
    const publicClient = createPublicClient({ chain: monad, transport: http(rpcUrl) });
    const allowance = await publicClient.readContract({
        address: token,
        abi: parseAbi(['function allowance(address,address) view returns (uint256)']),
        functionName: 'allowance',
        args: [owner, spender],
    }) as bigint;
    return allowance >= amount;
}

export async function getSwapCallArgs(params: SwapParams, recipient: Address) {
    // For wagmi/writeContract (miniapp path)
    // Note: This is async because we need to get the quote
    const poolAddress = CONTRACT_ADDRESSES.V3_POOL;
    const routerAddress = CONTRACT_ADDRESSES.V3_SWAP_ROUTER;

    if (!poolAddress || !routerAddress) {
        throw new Error('V3 Pool or Router address not configured');
    }

    // Determine zeroForOne
    const isKEEPtoWMON = params.tokenIn === 'KEEP' && params.tokenOut === 'MON';
    const zeroForOne = isKEEPtoWMON;

    // Get quote for slippage protection
    const quote = await getSwapQuote(params);
    if (!quote) {
        throw new Error('Failed to get swap quote');
    }

    const slippageTolerance = params.slippageTolerance || 3.0;
    const amountOutMinimum = (quote.amountOut * BigInt(10000 - Math.floor(slippageTolerance * 100))) / 10000n;

    return {
        address: routerAddress,
        abi: V3_ROUTER_ABI,
        functionName: 'swapExactInput',
        args: [
            poolAddress,
            params.amountIn,
            amountOutMinimum,
            recipient,
            zeroForOne,
        ],
    };
}

export function getPoolKey() {
    // Stub
    return {};
}
