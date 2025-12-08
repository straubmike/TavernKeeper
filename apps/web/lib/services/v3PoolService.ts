
import { createPublicClient, formatEther, http, parseAbi, type Address } from 'viem';
import { monad } from '../chains';
import { CONTRACT_ADDRESSES } from '../contracts/addresses';

// V3 Pool ABI
const POOL_ABI = parseAbi([
    'function slot0() external view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)',
    'function liquidity() external view returns (uint128)',
    'function token0() external view returns (address)',
    'function token1() external view returns (address)',
    'function fee() external view returns (uint24)'
]);

export interface PoolState {
    sqrtPriceX96: bigint;
    tick: number;
    liquidity: bigint;
    token0: Address;
    token1: Address;
    fee: number;
    price: number;
    monReserves?: string;
    keepReserves?: string;
}

export async function getV3PoolState(): Promise<PoolState | null> {
    try {
        const rpcUrl = process.env.NEXT_PUBLIC_MONAD_RPC_URL || monad.rpcUrls.default.http[0];

        const client = createPublicClient({
            chain: monad,
            transport: http(rpcUrl),
        });

        // Ensure we have a pool address
        const poolAddress = CONTRACT_ADDRESSES.V3_POOL;
        if (!poolAddress || poolAddress === '0x0000000000000000000000000000000000000000') {
            console.warn('V3 Pool Address not configured');
            return null;
        }

        const [slot0, liquidity, token0, token1, fee] = await Promise.all([
            client.readContract({ address: poolAddress, abi: POOL_ABI, functionName: 'slot0' }),
            client.readContract({ address: poolAddress, abi: POOL_ABI, functionName: 'liquidity' }),
            client.readContract({ address: poolAddress, abi: POOL_ABI, functionName: 'token0' }),
            client.readContract({ address: poolAddress, abi: POOL_ABI, functionName: 'token1' }),
            client.readContract({ address: poolAddress, abi: POOL_ABI, functionName: 'fee' })
        ]);

        // Calculate Price
        const sqrtPriceX96 = slot0[0];
        const Q96 = 2n ** 96n;
        const sqrtPrice = Number(sqrtPriceX96) / Number(Q96);
        const price = sqrtPrice * sqrtPrice; // amount1 per amount0 (or inverse, depends on token order)

        // Calculate Reserves (Approximate from Liquidity)
        // Note: Real reserves require `balanceOf` on the pool contract
        const monIsToken0 = token0.toLowerCase() < token1.toLowerCase(); // WMON usually < KEEP?
        // Wait, check explicit token addresses to know which is which.
        // For simplicity, let's just fetch balances.

        const [balance0, balance1] = await Promise.all([
            client.readContract({
                address: token0,
                abi: parseAbi(['function balanceOf(address) view returns (uint256)']),
                functionName: 'balanceOf',
                args: [poolAddress]
            }),
            client.readContract({
                address: token1,
                abi: parseAbi(['function balanceOf(address) view returns (uint256)']),
                functionName: 'balanceOf',
                args: [poolAddress]
            })
        ]);

        return {
            sqrtPriceX96,
            tick: slot0[1],
            liquidity: liquidity,
            token0,
            token1,
            fee: fee,
            price,
            monReserves: formatEther(monIsToken0 ? balance0 : balance1), // Assuming token0 is WMON if sorted? Need to verify logic.
            keepReserves: formatEther(monIsToken0 ? balance1 : balance0)
        };

    } catch (e) {
        console.error('Error fetching V3 Pool State:', e);
        return null;
    }
}
