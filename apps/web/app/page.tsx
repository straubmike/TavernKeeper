'use client';

import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount } from 'wagmi';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { ChatOverlay } from '../components/ChatOverlay';
import TavernLanding from '../components/TavernLanding';
import { PixelButton } from '../components/PixelComponents';
import { BattleScene } from '../components/scenes/BattleScene';
import { InnScene } from '../components/scenes/InnScene';
import { MapScene } from '../components/scenes/MapScene';
import { TheOffice } from '../components/TheOffice';
import { WelcomeModal } from '../components/WelcomeModal';
import { useGameStore } from '../lib/stores/gameStore';
import { GameView } from '../lib/types';

import { formatEther } from 'viem';

import sdk from '@farcaster/miniapp-sdk';
import { keepTokenService } from '../lib/services/keepToken';
import { isInFarcasterMiniapp } from '../lib/utils/farcasterDetection';

function SearchParamsHandler({ onViewChange }: { onViewChange: (view: string | null) => void }) {
    const searchParams = useSearchParams();

    useEffect(() => {
        const view = searchParams.get('view');
        onViewChange(view);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchParams]);

    return null;
}

function HomeContent() {
    const { currentView, switchView, party, keepBalance, setKeepBalance } = useGameStore();
    const [isInMiniapp, setIsInMiniapp] = useState(false);
    const [isMounted, setIsMounted] = useState(false);
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    // Wagmi hooks for wallet state
    const { address, isConnected } = useAccount();

    // Redirect to /miniapp if accessing root route inside Farcaster miniapp
    useEffect(() => {
        if (typeof window === 'undefined') return;

        const inMiniapp = isInFarcasterMiniapp();
        setIsInMiniapp(inMiniapp);
        setIsMounted(true);

        if (inMiniapp && pathname === '/') {
            const queryString = searchParams.toString();
            const redirectPath = queryString ? `/miniapp?${queryString}` : '/miniapp';
            router.replace(redirectPath);
            return;
        }
    }, [pathname, router, searchParams]);

    console.log('HomeContent Render:', { currentView, isMounted, isInMiniapp });

    if (isMounted && isInMiniapp && pathname === '/') {
        return <div className="h-full w-full flex items-center justify-center bg-black text-white">Redirecting...</div>;
    }

    // Fetch KEEP Balance
    useEffect(() => {
        if (!address) {
            setKeepBalance("0");
            return;
        }

        let cancelled = false;

        const fetchBalance = async () => {
            await new Promise(resolve => setTimeout(resolve, 1000));
            if (cancelled) return;
            try {
                const balance = await keepTokenService.getBalance(address);
                if (!cancelled) setKeepBalance(balance);
            } catch (error) {
                if (!cancelled) console.error('Failed to fetch KEEP balance:', error);
            }
        };

        fetchBalance();
        const interval = setInterval(fetchBalance, 30000);
        return () => { cancelled = true; clearInterval(interval); };
    }, [address, setKeepBalance]);

    // Initial Greeting
    useEffect(() => {
        const hasGreeted = sessionStorage.getItem('innkeeper_greeted');
        if (!hasGreeted) {
            useGameStore.getState().addLog({
                id: Date.now(),
                message: "Welcome back, traveler! The hearth is warm. How can I help you today?",
                type: 'dialogue',
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            });
            sessionStorage.setItem('innkeeper_greeted', 'true');
        }
    }, []);

    const handleViewChange = (view: string | null) => {
        if (view === 'map') switchView(GameView.MAP);
        if (view === 'battle') switchView(GameView.BATTLE);
        if (view === 'inn') switchView(GameView.INN);
    };

    return (
        <>
            <Suspense fallback={null}>
                <SearchParamsHandler onViewChange={handleViewChange} />
            </Suspense>
            <main className="h-full w-full flex flex-col font-pixel">
                <WelcomeModal onClose={() => { }} />

                <div className="flex-1 relative flex flex-col overflow-hidden">

                    {/* --- TOP BAR --- */}
                    <div className="h-12 bg-[#2a1d17] border-b-4 border-[#1a120b] flex items-center justify-between px-2 z-20 shrink-0 overflow-visible">
                        <div className="flex items-center gap-2 flex-shrink-0">
                            <h1 className="text-yellow-400 text-sm md:text-lg font-bold tracking-widest px-2 drop-shadow-[2px_2px_0_rgba(0,0,0,1)] whitespace-nowrap">
                                TAVERN<span className="text-white">KEEPER</span>
                            </h1>
                        </div>

                        <div className="flex items-center gap-1 flex-shrink-0 min-w-0">
                            {/* Wallet Connect - RainbowKit - ALWAYS VISIBLE */}
                            {!isInMiniapp && (
                                <div className="flex items-center gap-2 z-50 relative" style={{ minWidth: '120px' }}>
                                    <ConnectButton
                                        accountStatus="full"
                                        showBalance={false}
                                        chainStatus="none"
                                    />
                                </div>
                            )}

                            {/* DAY and KEEP Balance */}
                            <div className="flex items-center gap-2 px-2 bg-black/30 py-1 rounded border border-white/5">
                                <div className="text-[10px] text-yellow-400 flex flex-col items-end leading-tight">
                                    <span>DAY 1</span>
                                    <span className="text-white/50">{parseFloat(formatEther(BigInt(keepBalance))).toFixed(2)} KEEP</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* --- MAIN SCENE AREA --- */}
                    <div className="flex-1 relative bg-black overflow-hidden">
                        {currentView === GameView.INN && <InnScene />}
                        {currentView === GameView.MAP && <MapScene />}
                        {currentView === GameView.BATTLE && (
                            <BattleScene
                                party={party}
                                onComplete={(success) => {
                                    useGameStore.getState().addLog({
                                        id: Date.now(),
                                        message: success ? "Victory! The party returns to the inn." : "Defeat... The party retreats.",
                                        type: 'combat',
                                        timestamp: new Date().toLocaleTimeString()
                                    });
                                    switchView(GameView.INN);
                                }}
                            />
                        )}

                        {/* CHAT VIEW */}
                        {currentView === GameView.CHAT && (
                            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[95%] h-full z-30 pointer-events-none flex flex-col gap-4">
                                <div className="pointer-events-auto w-full max-w-md mx-auto h-full flex flex-col">
                                    <TheOffice>
                                        <ChatOverlay />
                                    </TheOffice>
                                </div>
                            </div>
                        )}

                        {/* TAVERN VIEW (Landing/Welcome) */}
                        {currentView === GameView.INN && (
                            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[90%] max-w-sm h-full z-30 pointer-events-none flex flex-col">
                                <div className="pointer-events-auto w-full h-full flex flex-col overflow-hidden">
                                    <TheOffice>
                                        <div className="flex-1 overflow-y-auto [scrollbar-width:thin] [scrollbar-color:rgba(255,255,255,0.2)_transparent] [-ms-overflow-style:auto] [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-white/20 [&::-webkit-scrollbar-thumb]:rounded-full">
                                            <TavernLanding />
                                        </div>
                                    </TheOffice>
                                </div>
                            </div>
                        )}

                        {/* CELLAR VIEW */}
                        {currentView === GameView.CELLAR && (
                            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[90%] max-w-sm h-full z-30 pointer-events-none flex flex-col gap-4">
                                <div className="pointer-events-auto w-full h-full flex flex-col overflow-hidden">
                                    <TheOffice />
                                </div>
                            </div>
                        )}

                    </div>
                </div>
            </main>
        </>
    );
}

export default function Home() {
    return (
        <Suspense fallback={<div className="h-full w-full flex items-center justify-center bg-black text-white">Loading...</div>}>
            <HomeContent />
        </Suspense>
    );
}
