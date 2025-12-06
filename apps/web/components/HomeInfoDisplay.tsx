'use client';

import { useEffect, useState } from 'react';
import { createPublicClient, formatEther, http } from 'viem';
import { monad } from '../lib/chains';
import { keepTokenService } from '../lib/services/keepToken';
import { theCellarService } from '../lib/services/theCellarService';
import { getPoolLiquidity } from '../lib/services/uniswapV4SwapService';
import { PixelBox } from './PixelComponents';
import { SwapInterface } from './SwapInterface';

interface HomeInfoDisplayProps {
    address: string | undefined;
}

export const HomeInfoDisplay: React.FC<HomeInfoDisplayProps> = ({ address }) => {
    const [lpBalance, setLpBalance] = useState<bigint>(0n);
    const [monBalance, setMonBalance] = useState<bigint>(0n);
    const [keepBalance, setKeepBalance] = useState<string>('0');
    const [poolMon, setPoolMon] = useState<bigint>(0n);
    const [poolKeep, setPoolKeep] = useState<bigint>(0n);

    // Fetch pool liquidity separately (doesn't need user address)
    useEffect(() => {
        const fetchPoolLiquidity = async () => {
            try {
                console.log('Fetching pool liquidity...');
                const poolLiquidity = await getPoolLiquidity();
                if (poolLiquidity) {
                    console.log('✅ Pool MON:', formatEther(poolLiquidity.mon));
                    console.log('✅ Pool KEEP:', formatEther(poolLiquidity.keep));
                    setPoolMon(poolLiquidity.mon);
                    setPoolKeep(poolLiquidity.keep);
                } else {
                    console.warn('❌ Failed to fetch pool liquidity - returned null');
                }
            } catch (error) {
                console.error('❌ Error fetching pool liquidity:', error);
            }
        };

        fetchPoolLiquidity();
        const interval = setInterval(fetchPoolLiquidity, 10000); // Poll every 10s
        return () => clearInterval(interval);
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
            try {
                console.log('Fetching user data for address:', address);

                // Fetch LP Balance
                const lp = await theCellarService.getUserLpBalance(address);
                console.log('LP Balance:', lp.toString());
                setLpBalance(lp);

                // Fetch KEEP Balance
                const keep = await keepTokenService.getBalance(address);
                console.log('KEEP Balance:', keep);
                setKeepBalance(keep);

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
        const interval = setInterval(fetchUserData, 10000); // Poll every 10s
        return () => clearInterval(interval);
    }, [address]);

    return (
        <div className="w-full p-2 sm:p-3 space-y-3 max-w-full overflow-x-hidden overflow-y-auto [scrollbar-width:thin] [scrollbar-color:rgba(255,255,255,0.2)_transparent] [-ms-overflow-style:auto] [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-white/20 [&::-webkit-scrollbar-thumb]:rounded-full">
            {/* Pool Liquidity - Compact */}
            <div className="grid grid-cols-2 gap-2">
                <PixelBox variant="dark" className="p-2 flex flex-col items-center justify-center">
                    <div className="text-[8px] text-zinc-400 uppercase tracking-wider mb-0.5">Pool MON</div>
                    <div className="text-yellow-400 font-bold text-xs font-mono">
                        {parseFloat(formatEther(poolMon)).toFixed(4)}
                    </div>
                </PixelBox>
                <PixelBox variant="dark" className="p-2 flex flex-col items-center justify-center">
                    <div className="text-[8px] text-zinc-400 uppercase tracking-wider mb-0.5">Pool KEEP</div>
                    <div className="text-orange-400 font-bold text-xs font-mono">
                        {parseFloat(formatEther(poolKeep)).toFixed(2)}
                    </div>
                </PixelBox>
            </div>

            {/* Swap Interface - Shows user balances internally */}
            <div className="w-full max-w-full overflow-hidden">
                <SwapInterface />
            </div>
        </div>
    );
};
