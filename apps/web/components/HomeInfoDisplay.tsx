'use client';

import sdk from '@farcaster/miniapp-sdk';
import { useEffect, useState } from 'react';
import { createPublicClient, formatEther, http } from 'viem';
import { monad } from '../lib/chains';
import { CONTRACT_ADDRESSES } from '../lib/contracts/addresses';
import { keepTokenService } from '../lib/services/keepToken';
import { theCellarService } from '../lib/services/theCellarService';
import { getPoolLiquidity } from '../lib/services/uniswapV4SwapService';
import { isInFarcasterMiniapp } from '../lib/utils/farcasterDetection';
import { SmartLink } from '../lib/utils/smartNavigation';
import { PixelBox, PixelButton } from './PixelComponents';

interface HomeInfoDisplayProps {
    address: string | undefined;
}

export const HomeInfoDisplay: React.FC<HomeInfoDisplayProps> = ({ address }) => {
    const [lpBalance, setLpBalance] = useState<bigint>(0n);
    const [monBalance, setMonBalance] = useState<bigint>(0n);
    const [keepBalance, setKeepBalance] = useState<string>('0');
    const [poolMon, setPoolMon] = useState<bigint>(0n);
    const [poolKeep, setPoolKeep] = useState<bigint>(0n);
    const [copied, setCopied] = useState(false);

    const keepTokenAddress = CONTRACT_ADDRESSES.KEEP_TOKEN;

    const handleCopyAddress = async () => {
        try {
            await navigator.clipboard.writeText(keepTokenAddress);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error('Failed to copy address:', err);
        }
    };

    // Fetch pool liquidity separately (doesn't need user address) - delayed to avoid rate limits
    useEffect(() => {
        let cancelled = false;

        const fetchPoolLiquidity = async () => {
            // Delay initial fetch to let other components load first
            await new Promise(resolve => setTimeout(resolve, 1500));

            if (cancelled) return;

            try {
                console.log('Fetching pool liquidity...');
                const poolLiquidity = await getPoolLiquidity();
                if (poolLiquidity && !cancelled) {
                    console.log('✅ Pool MON:', formatEther(poolLiquidity.mon));
                    console.log('✅ Pool KEEP:', formatEther(poolLiquidity.keep));
                    setPoolMon(poolLiquidity.mon);
                    setPoolKeep(poolLiquidity.keep);
                } else if (!cancelled) {
                    console.warn('❌ Failed to fetch pool liquidity - returned null');
                }
            } catch (error) {
                if (!cancelled) {
                    console.error('❌ Error fetching pool liquidity:', error);
                }
            }
        };

        fetchPoolLiquidity();
        const interval = setInterval(fetchPoolLiquidity, 30000); // Poll every 30s
        return () => {
            cancelled = true;
            clearInterval(interval);
        };
    }, []); // Run once on mount, doesn't depend on address

    // Fetch user-specific data
    useEffect(() => {
        if (!address) {
            setLpBalance(0n);
            setMonBalance(0n);
            setKeepBalance('0');
            return;
        }

        const fetchUserData = async () => {
            // Delay user data fetch to avoid rate limits
            await new Promise(resolve => setTimeout(resolve, 2000));

            try {
                console.log('Fetching user data for address:', address);

                // Fetch LP Balance
                const lp = await theCellarService.getUserLpBalance(address);
                console.log('LP Balance:', lp.toString());
                setLpBalance(lp);

                // Small delay between calls
                await new Promise(resolve => setTimeout(resolve, 300));

                // Fetch KEEP Balance
                const keep = await keepTokenService.getBalance(address);
                console.log('KEEP Balance:', keep);
                setKeepBalance(keep);

                // Small delay between calls
                await new Promise(resolve => setTimeout(resolve, 300));

                // Fetch MON Balance (native token)
                const rpcUrl = process.env.NEXT_PUBLIC_MONAD_RPC_URL ||
                    (monad.id === 143 ? 'https://rpc.monad.xyz' : 'https://testnet-rpc.monad.xyz');

                const publicClient = createPublicClient({
                    chain: monad,
                    transport: http(rpcUrl),
                });
                const mon = await publicClient.getBalance({ address: address as `0x${string}` });
                console.log('MON Balance:', mon.toString());
                setMonBalance(mon);
            } catch (error) {
                console.error('Failed to fetch user data:', error);
            }
        };

        fetchUserData();
        const interval = setInterval(fetchUserData, 30000); // Poll every 30s
        return () => clearInterval(interval);
    }, [address]);

    return (
        <div className="w-full p-2 sm:p-3 space-y-2 max-w-full overflow-x-hidden [scrollbar-width:thin] [scrollbar-color:rgba(255,255,255,0.2)_transparent] [-ms-overflow-style:auto] [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-white/20 [&::-webkit-scrollbar-thumb]:rounded-full">
            {/* Pool Liquidity - Compact */}
            <div className="grid grid-cols-2 gap-2">
                <PixelBox variant="dark" className="p-2 flex flex-col items-center justify-center min-w-0">
                    <div className="text-[8px] text-zinc-400 uppercase tracking-wider mb-0.5">Pool MON</div>
                    <div className="text-yellow-400 font-bold text-xs font-mono truncate w-full text-center">
                        {parseFloat(formatEther(poolMon)).toFixed(4)}
                    </div>
                </PixelBox>
                <PixelBox variant="dark" className="p-2 flex flex-col items-center justify-center min-w-0">
                    <div className="text-[8px] text-zinc-400 uppercase tracking-wider mb-0.5">Pool KEEP</div>
                    <div className="text-orange-400 font-bold text-xs font-mono truncate w-full text-center">
                        {parseFloat(formatEther(poolKeep)).toFixed(2)}
                    </div>
                </PixelBox>
            </div>

            {/* KEEP Token Contract Address */}
            <PixelBox variant="dark" className="p-2">
                <div className="text-[8px] text-zinc-400 uppercase tracking-wider mb-1.5">KEEP Token</div>
                <div className="flex items-center gap-1.5">
                    <div className="flex-1 font-mono text-[10px] text-yellow-400 break-all">
                        {keepTokenAddress}
                    </div>
                    <PixelButton
                        variant="wood"
                        size="sm"
                        onClick={handleCopyAddress}
                        className="flex-shrink-0"
                    >
                        {copied ? '✓' : '📋'}
                    </PixelButton>
                </div>
            </PixelBox>

            {/* Navigation Links */}
            <div className="grid grid-cols-3 gap-1.5">
                <SmartLink href="/tutorial" className="block">
                    <PixelButton variant="wood" className="w-full h-8 text-[9px] font-bold uppercase tracking-wider">
                        Tutorial
                    </PixelButton>
                </SmartLink>
                <SmartLink href="/docs" className="block">
                    <PixelButton variant="wood" className="w-full h-8 text-[9px] font-bold uppercase tracking-wider">
                        Docs
                    </PixelButton>
                </SmartLink>
                <SmartLink href="/info" className="block">
                    <PixelButton variant="wood" className="w-full h-8 text-[9px] font-bold uppercase tracking-wider">
                        Info
                    </PixelButton>
                </SmartLink>
            </div>

            {/* Add Miniapp Button - Only show in miniapp context */}
            {isInFarcasterMiniapp() && (
                <PixelBox variant="dark" className="p-2 border-2 border-purple-500/50 bg-purple-900/20">
                    <div className="flex items-center justify-between gap-2">
                        <div className="flex flex-col">
                            <div className="text-[8px] text-purple-300 uppercase tracking-wider mb-0.5">
                                Get Notifications
                            </div>
                            <div className="text-[7px] text-zinc-400">
                                Add miniapp to receive updates
                            </div>
                        </div>
                        <PixelButton
                            variant="primary"
                            size="sm"
                            onClick={async () => {
                                try {
                                    await sdk.actions.addMiniapp();
                                } catch (error) {
                                    console.error('Failed to add miniapp:', error);
                                }
                            }}
                            className="flex-shrink-0 text-[8px] px-2"
                        >
                            Add
                        </PixelButton>
                    </div>
                </PixelBox>
            )}
        </div>
    );
};
