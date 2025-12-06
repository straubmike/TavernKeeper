'use client';

import sdk from '@farcaster/miniapp-sdk';
import { usePathname, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useRef, useState } from 'react';
import { formatEther } from 'viem';
import { useAccount } from 'wagmi';
import { ChatOverlay } from '../../components/ChatOverlay';
import { BattleScene } from '../../components/scenes/BattleScene';
import { InnScene } from '../../components/scenes/InnScene';
import { MapScene } from '../../components/scenes/MapScene';
import { TheOffice } from '../../components/TheOffice';
import { WelcomeModal } from '../../components/WelcomeModal';
import { monad } from '../../lib/chains';
import { keepTokenService } from '../../lib/services/keepToken';
import { useGameStore } from '../../lib/stores/gameStore';
import { GameView } from '../../lib/types';

type MiniAppContext = {
  user?: {
    fid: number;
    username?: string;
    displayName?: string;
    pfpUrl?: string;
  };
};

function SearchParamsHandler({ onViewChange }: { onViewChange: (view: string | null) => void }) {
    const searchParams = useSearchParams();

    useEffect(() => {
        const view = searchParams.get('view');
        onViewChange(view);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchParams]);

    return null;
}

function MiniappContent() {
    const { currentView, switchView, party, keepBalance, setKeepBalance } = useGameStore();
    const pathname = usePathname();
    const readyRef = useRef(false);
    const [context, setContext] = useState<MiniAppContext | null>(null);

    // Get user context from SDK
    useEffect(() => {
        let cancelled = false;
        const hydrateContext = async () => {
            try {
                const ctx = (await (sdk as unknown as {
                    context: Promise<MiniAppContext> | MiniAppContext;
                }).context) as MiniAppContext;
                if (!cancelled) {
                    setContext(ctx);
                }
            } catch {
                if (!cancelled) setContext(null);
            }
        };
        hydrateContext();
        return () => {
            cancelled = true;
        };
    }, []);

    // Call sdk.actions.ready() after delay
    useEffect(() => {
        const timeout = setTimeout(() => {
            if (!readyRef.current) {
                readyRef.current = true;
                sdk.actions.ready().catch(() => {});
            }
        }, 1200);
        return () => clearTimeout(timeout);
    }, []);

    // Wagmi hooks for wallet connection (auto-connect handled by AutoConnectWallet in provider)
    const { address } = useAccount();

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
            }
        };

        fetchBalance();
        const interval = setInterval(fetchBalance, 10000); // Poll every 10s
        return () => clearInterval(interval);
    }, [address, setKeepBalance]);

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
                            {/* Help/Docs Link */}
                            <a
                                href="/docs"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-2 py-1 text-yellow-400 hover:text-yellow-300 transition-colors"
                                title="Documentation"
                            >
                                <span className="text-lg">?</span>
                            </a>
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
                        {currentView === GameView.CELLAR && (
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
                        {(currentView === GameView.INN || currentView === GameView.CELLAR) && (
                            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[95%] h-full z-30 pointer-events-none flex flex-col gap-4">

                                {/* The Office (King of the Hill) wrapping the Chat */}
                                <div className="pointer-events-auto w-full max-w-md mx-auto h-full flex flex-col">
                                    <TheOffice userContext={context?.user}>
                                        <ChatOverlay />
                                    </TheOffice>
                                </div>
                            </div>
                        )}

                    </div>



                </div>
            </main>
        </>
    );
}

export default function MiniappPage() {
    return (
        <Suspense fallback={<div className="h-full w-full flex items-center justify-center bg-black text-white">Loading Miniapp...</div>}>
            <MiniappContent />
        </Suspense>
    );
}

