'use client';

import { useEffect, useState } from 'react';
import { formatEther, parseEther, createPublicClient, http, type Address } from 'viem';
import { PixelBox, PixelButton } from './PixelComponents';
import { useUnifiedWalletClient } from '../lib/hooks/useUnifiedWalletClient';
import {
    getSwapQuote,
    getTokenBalances,
    isPoolReady,
    executeSwap,
    type SwapParams,
    type SwapQuote,
    getPoolKey,
} from '../lib/services/uniswapV4SwapService';

export function SwapInterface() {
    const { walletClient } = useUnifiedWalletClient();
    const [tokenIn, setTokenIn] = useState<'MON' | 'KEEP'>('MON');
    const [tokenOut, setTokenOut] = useState<'MON' | 'KEEP'>('KEEP');
    const [amountIn, setAmountIn] = useState<string>('');
    const [quote, setQuote] = useState<SwapQuote | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [balances, setBalances] = useState<{ mon: bigint; keep: bigint } | null>(null);
    const [poolReady, setPoolReady] = useState<boolean>(false);
    const [isSwapping, setIsSwapping] = useState(false);

    const account = walletClient?.account?.address;

    // Fetch pool status (always check, doesn't need wallet)
    useEffect(() => {
        const checkPoolReady = async () => {
            try {
                const ready = await isPoolReady();
                setPoolReady(ready);
            } catch (err) {
                console.error('Error checking pool readiness:', err);
                setPoolReady(false);
            }
        };

        checkPoolReady();
        const interval = setInterval(checkPoolReady, 10000);
        return () => clearInterval(interval);
    }, []); // Run once on mount, doesn't depend on account

    // Fetch user balances (only when wallet is connected)
    useEffect(() => {
        if (!account) {
            setBalances(null);
            return;
        }

        const fetchBalances = async () => {
            try {
                const bal = await getTokenBalances(account as Address);
                setBalances(bal);
            } catch (err) {
                console.error('Error fetching balances:', err);
            }
        };

        fetchBalances();
        const interval = setInterval(fetchBalances, 10000);
        return () => clearInterval(interval);
    }, [account]);

    // Fetch quote when amount changes
    useEffect(() => {
        if (!amountIn || !poolReady) {
            setQuote(null);
            setError(null);
            return;
        }

        const fetchQuote = async () => {
            try {
                setIsLoading(true);
                setError(null);
                const amountInWei = parseEther(amountIn);
                const quoteResult = await getSwapQuote({
                    tokenIn,
                    tokenOut,
                    amountIn: amountInWei,
                    slippageTolerance: 0.5,
                });
                setQuote(quoteResult);
            } catch (err: any) {
                console.error('Error fetching quote:', err);
                setError(err.message || 'Failed to get quote');
                setQuote(null);
            } finally {
                setIsLoading(false);
            }
        };

        const debounceTimer = setTimeout(fetchQuote, 500);
        return () => clearTimeout(debounceTimer);
    }, [amountIn, tokenIn, tokenOut, poolReady]);

    const handleSwapDirection = () => {
        setTokenIn(tokenOut);
        setTokenOut(tokenIn);
        setAmountIn('');
        setQuote(null);
        setError(null);
    };

    const handleSwap = async () => {
        if (!walletClient || !account || !quote || !amountIn) {
            return;
        }

        try {
            setIsSwapping(true);
            setError(null);

            const amountInWei = parseEther(amountIn);
            const swapParams: SwapParams = {
                tokenIn,
                tokenOut,
                amountIn: amountInWei,
                slippageTolerance: 0.5,
            };

            console.log('Executing swap:', swapParams);
            const txHash = await executeSwap(walletClient, swapParams);
            console.log('Swap transaction hash:', txHash);

            // Wait for transaction confirmation
            const rpcUrl = process.env.NEXT_PUBLIC_MONAD_RPC_URL ||
                (typeof window !== 'undefined' && (window as any).__ENV__?.NEXT_PUBLIC_MONAD_RPC_URL) ||
                'https://rpc.monad.xyz';

            const { monad } = await import('../lib/chains');
            const publicClient = createPublicClient({
                chain: monad,
                transport: http(rpcUrl),
            });

            const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
            console.log('Swap confirmed:', receipt);

            // Clear input and refresh balances
            setAmountIn('');
            setQuote(null);

            // Refresh balances after a short delay
            setTimeout(() => {
                if (account) {
                    getTokenBalances(account as Address).then(setBalances).catch(console.error);
                }
            }, 2000);
        } catch (err: any) {
            console.error('Swap error:', err);
            setError(err.message || 'Swap failed');
        } finally {
            setIsSwapping(false);
        }
    };

    const getMaxBalance = () => {
        if (!balances) return '0';
        if (tokenIn === 'MON') {
            return formatEther(balances.mon);
        } else {
            return formatEther(balances.keep);
        }
    };

    const handleMax = () => {
        const max = getMaxBalance();
        // Leave a tiny bit for gas
        const maxMinusGas = (parseFloat(max) * 0.99).toFixed(4);
        setAmountIn(maxMinusGas);
    };

    const formatTokenAmount = (amount: bigint | undefined, token: 'MON' | 'KEEP') => {
        if (!amount) return '0';
        const formatted = formatEther(amount);
        return parseFloat(formatted).toFixed(token === 'MON' ? 4 : 2);
    };

    const amountOutDisplay = quote ? formatTokenAmount(quote.amountOut, tokenOut) : '0';

    if (!poolReady) {
        return (
            <PixelBox variant="dark" className="p-4">
                <div className="text-center text-sm text-yellow-400">
                    ⚠️ Pool not ready. Please ensure the pool is initialized and has liquidity.
                </div>
            </PixelBox>
        );
    }

    return (
        <PixelBox variant="dark" title="Swap" className="space-y-2.5 sm:space-y-3 max-w-full overflow-hidden [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden p-3 sm:p-4">
            {/* Token In Section */}
            <div className="space-y-2">
                <div className="flex items-center justify-between">
                    <label className="text-[10px] text-zinc-400 uppercase tracking-wider">Sell</label>
                    {balances && (
                        <button
                            onClick={handleMax}
                            className="text-[8px] text-blue-400 hover:text-blue-300 underline"
                        >
                            Max: {formatTokenAmount(tokenIn === 'MON' ? balances.mon : balances.keep, tokenIn)}
                        </button>
                    )}
                </div>
                <div className="flex gap-2">
                    <input
                        type="number"
                        value={amountIn}
                        onChange={(e) => setAmountIn(e.target.value)}
                        placeholder="0"
                        className="flex-1 bg-black/50 border-2 border-slate-700 px-2 sm:px-3 py-2 text-white text-xs sm:text-sm font-mono focus:outline-none focus:border-yellow-400 min-w-0"
                        step="any"
                        min="0"
                    />
                    <div className="flex items-center gap-1.5 sm:gap-2 bg-slate-800 px-2 sm:px-3 py-2 border-2 border-slate-700 shrink-0">
                        <span className="text-xs sm:text-sm font-bold text-white whitespace-nowrap">{tokenIn}</span>
                        <button
                            onClick={() => {
                                const newToken = tokenIn === 'MON' ? 'KEEP' : 'MON';
                                setTokenIn(newToken);
                                setTokenOut(newToken === 'MON' ? 'KEEP' : 'MON');
                                setAmountIn('');
                                setQuote(null);
                            }}
                            className="text-xs text-zinc-400 hover:text-white"
                        >
                            ▼
                        </button>
                    </div>
                </div>
                {balances && (
                    <div className="text-[8px] text-zinc-500 text-right">
                        Balance: {formatTokenAmount(tokenIn === 'MON' ? balances.mon : balances.keep, tokenIn)} {tokenIn}
                    </div>
                )}
            </div>

            {/* Swap Direction Button */}
            <div className="flex justify-center py-1">
                <button
                    onClick={handleSwapDirection}
                    className="w-8 h-8 sm:w-10 sm:h-10 bg-slate-800 border-2 border-slate-700 rounded-full flex items-center justify-center hover:bg-slate-700 transition-colors shrink-0"
                    aria-label="Swap direction"
                >
                    <svg className="w-4 h-4 sm:w-5 sm:h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                    </svg>
                </button>
            </div>

            {/* Token Out Section */}
            <div className="space-y-2">
                <label className="text-[10px] text-zinc-400 uppercase tracking-wider">Buy</label>
                <div className="flex gap-2">
                    <div className="flex-1 bg-black/30 border-2 border-slate-700 px-2 sm:px-3 py-2 text-white text-xs sm:text-sm font-mono flex items-center min-w-0 overflow-hidden">
                        {isLoading ? (
                            <span className="text-zinc-500 truncate">Calculating...</span>
                        ) : (
                            <span className="truncate">{amountOutDisplay}</span>
                        )}
                    </div>
                    <div className="flex items-center gap-1.5 sm:gap-2 bg-slate-800 px-2 sm:px-3 py-2 border-2 border-slate-700 shrink-0">
                        <span className="text-xs sm:text-sm font-bold text-white whitespace-nowrap">{tokenOut}</span>
                        <button
                            onClick={() => {
                                const newToken = tokenOut === 'MON' ? 'KEEP' : 'MON';
                                setTokenOut(newToken);
                                setTokenIn(newToken === 'MON' ? 'KEEP' : 'MON');
                                setAmountIn('');
                                setQuote(null);
                            }}
                            className="text-xs text-zinc-400 hover:text-white"
                        >
                            ▼
                        </button>
                    </div>
                </div>
                {balances && (
                    <div className="text-[8px] text-zinc-500 text-right">
                        Balance: {formatTokenAmount(tokenOut === 'MON' ? balances.mon : balances.keep, tokenOut)} {tokenOut}
                    </div>
                )}
            </div>

            {/* Price Info */}
            {quote && parseFloat(amountIn) > 0 && (
                <div className="text-[8px] text-zinc-500 space-y-1 border-t border-slate-700 pt-2 break-words">
                    <div className="flex justify-between">
                        <span>Rate:</span>
                        <span>
                            1 {tokenIn} ≈ {quote.amountIn > 0n ? formatTokenAmount((quote.amountOut * BigInt(1e18)) / quote.amountIn, tokenOut) : '0'} {tokenOut}
                        </span>
                    </div>
                    {quote.priceImpact > 0 && (
                        <div className="flex justify-between">
                            <span>Price Impact:</span>
                            <span className={quote.priceImpact > 5 ? 'text-yellow-400' : ''}>
                                {quote.priceImpact.toFixed(2)}%
                            </span>
                        </div>
                    )}
                </div>
            )}

            {/* Error Display */}
            {error && (
                <div className="bg-red-900/30 border-2 border-red-700 px-3 py-2 text-red-400 text-[10px]">
                    {error}
                </div>
            )}

            {/* Swap Button */}
            <PixelButton
                onClick={handleSwap}
                disabled={!account || !amountIn || !quote || isLoading || isSwapping || parseFloat(amountIn) <= 0}
                className="w-full"
                variant="primary"
            >
                {!account
                    ? 'Connect Wallet'
                    : !amountIn
                    ? 'Enter Amount'
                    : isLoading
                    ? 'Calculating...'
                    : isSwapping
                    ? 'Swapping...'
                    : 'Review Swap'}
            </PixelButton>

        </PixelBox>
    );
}

