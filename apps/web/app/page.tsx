'use client';

import { usePrivy } from '@privy-io/react-auth';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { ChatOverlay } from '../components/ChatOverlay';
import { HomeInfoDisplay } from '../components/HomeInfoDisplay';
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
    const { login, authenticated, user, logout } = usePrivy();
    const address = user?.wallet?.address;
    const [isInMiniapp, setIsInMiniapp] = useState(false);
    const [isMounted, setIsMounted] = useState(false);

    console.log('HomeContent Render:', { currentView, isMounted, isInMiniapp });

    // Check if in miniapp on client side only to avoid hydration mismatch
    useEffect(() => {
        setIsMounted(true);
        const inMiniapp = isInFarcasterMiniapp();
        setIsInMiniapp(inMiniapp);

        // Call sdk.actions.ready() if in miniapp context
        if (inMiniapp && sdk?.actions) {
            const timeout = setTimeout(() => {
                try {
                    sdk.actions.ready().catch(() => {});
                } catch (error) {
                    console.warn('Farcaster SDK not available:', error);
                }
            }, 1200);
            return () => clearTimeout(timeout);
        }
    }, []);

    // Fetch KEEP Balance
    useEffect(() => {
        if (!address) {
            setKeepBalance("0");
            return;
        }

        const fetchBalance = async () => {
            try {
                const balance = await keepTokenService.getBalance(address);
                setKeepBalance(balance);
            } catch (error) {
                console.error('Failed to fetch KEEP balance:', error);
                // Don't set to 0 on error, keep previous value
            }
        };

        fetchBalance();
        const interval = setInterval(fetchBalance, 10000); // Poll every 10s
        return () => clearInterval(interval);
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

    // Handle URL Query Params for View Switching
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

                {/* Mobile Container Wrapper - Filling Parent from Layout */}
                <div className="flex-1 relative flex flex-col overflow-hidden">

                    {/* --- TOP BAR: Title & Status --- */}
                    <div className="h-12 bg-[#2a1d17] border-b-4 border-[#1a120b] flex items-center justify-between px-2 z-20 shrink-0 overflow-visible">
                        <div className="flex items-center gap-2 flex-shrink-0">
                            <h1 className="text-yellow-400 text-sm md:text-lg font-bold tracking-widest px-2 drop-shadow-[2px_2px_0_rgba(0,0,0,1)] whitespace-nowrap">
                                TAVERN<span className="text-white">KEEPER</span>
                            </h1>
                        </div>

                        <div className="flex items-center gap-1 flex-shrink-0 min-w-0">
                            {/* Wallet Connect Menu - Show on web (not in Farcaster miniapp) */}
                            {isMounted && !isInMiniapp && (
                                <div className="flex items-center gap-2">
                                    {authenticated ? (
                                        <PixelButton variant="wood" onClick={logout} className="text-[10px] px-2 py-1">
                                            {address?.slice(0, 4)}...{address?.slice(-4)}
                                        </PixelButton>
                                    ) : (
                                        <PixelButton variant="primary" onClick={login} className="text-[10px] px-2 py-1">
                                            CONNECT
                                        </PixelButton>
                                    )}
                                </div>
                            )}

                            {/* DAY and KEEP Balance - Always visible */}
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
                        {currentView === GameView.INN && (
                            <InnScene />
                        )}
                        {currentView === GameView.MAP && (
                            <MapScene />
                        )}
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

                        {/* TAVERNKEEPER CHAT OVERLAY & THE OFFICE */}
                        {currentView === GameView.CHAT && (
                            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[95%] h-full z-30 pointer-events-none flex flex-col gap-4">
                                {/* The Office (King of the Hill) wrapping the Chat */}
                                <div className="pointer-events-auto w-full max-w-md mx-auto h-full flex flex-col">
                                    <TheOffice>
                                        <ChatOverlay />
                                    </TheOffice>
                                </div>
                            </div>
                        )}

                        {/* The Office for INN and CELLAR views (without chat) */}
                        {currentView === GameView.INN && (
                            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full sm:w-[95%] max-w-md mx-auto h-full z-30 pointer-events-none flex flex-col">
                                <div className="pointer-events-auto w-full h-full flex flex-col">
                                    <TheOffice>
                                        <div className="flex-1 overflow-y-auto [scrollbar-width:thin] [scrollbar-color:rgba(255,255,255,0.2)_transparent] [-ms-overflow-style:auto] [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-white/20 [&::-webkit-scrollbar-thumb]:rounded-full">
                                            <HomeInfoDisplay address={address} />
                                        </div>
                                    </TheOffice>
                                </div>
                            </div>
                        )}

                        {currentView === GameView.CELLAR && (
                            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[95%] h-full z-30 pointer-events-none flex flex-col gap-4">
                                <div className="pointer-events-auto w-full max-w-md mx-auto h-full flex flex-col">
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
