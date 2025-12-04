'use client';

import { usePathname, useRouter } from 'next/navigation';
import React from 'react';
import { useGameStore } from '../lib/stores/gameStore';
import { GameView } from '../lib/types';
import { isInFarcasterMiniapp } from '../lib/utils/farcasterDetection';

export const BottomNav: React.FC = () => {
    const router = useRouter();
    const pathname = usePathname();
    const { switchView, currentView } = useGameStore();
    const isMiniapp = isInFarcasterMiniapp();
    const homePath = isMiniapp ? '/miniapp' : '/';

    const handleNavigation = (view: GameView) => {
        if (pathname !== homePath) {
            router.push(homePath);
            // Small timeout to allow navigation to start/complete
            setTimeout(() => switchView(view), 100);
        } else {
            switchView(view);
        }
    };

    const isActive = (view: GameView) => pathname === homePath && currentView === view;
    const isPartyPage = pathname === '/party';

    return (
        <nav className="h-20 bg-[#2a1d17] border-t-4 border-[#eaddcf] flex justify-around items-center px-2 z-50 shrink-0 shadow-[0_-4px_10px_rgba(0,0,0,0.5)]">
            <button
                onClick={() => handleNavigation(GameView.INN)}
                className="flex flex-col items-center gap-1 p-2 group"
            >
                <div className={`w-10 h-10 border-2 rounded-sm flex items-center justify-center text-xl shadow-md transition-all group-hover:-translate-y-1 ${isActive(GameView.INN) ? 'bg-[#5c4b40] border-[#eaddcf]' : 'bg-[#4a3b32] border-[#855e42] group-hover:border-[#eaddcf] group-hover:bg-[#5c4b40]'}`}>
                    🍺
                </div>
                <span className={`text-[8px] uppercase font-bold tracking-widest drop-shadow-md ${isActive(GameView.INN) ? 'text-white' : 'text-[#eaddcf] group-hover:text-white'}`}>Inn</span>
            </button>

            <button
                onClick={() => handleNavigation(GameView.CELLAR)}
                className={`flex flex-col items-center gap-1 p-2 group ${currentView === GameView.CELLAR ? 'text-primary' : 'text-muted-foreground hover:text-primary'
                    }`}
            >
                <div className={`w-10 h-10 border-2 rounded-sm flex items-center justify-center text-xl shadow-md transition-all ${isActive(GameView.CELLAR) ? 'bg-[#5c4b40] border-[#eaddcf]' : 'bg-[#4a3b32] border-[#855e42]'}`}>
                    🪜
                </div>
                <span className={`text-[8px] uppercase font-bold tracking-widest drop-shadow-md ${isActive(GameView.CELLAR) ? 'text-white' : 'text-[#eaddcf]'}`}>Cellar</span>
            </button>

            <button
                onClick={() => handleNavigation(GameView.MAP)}
                className="flex flex-col items-center gap-1 p-2 group"
            >
                <div className={`w-10 h-10 border-2 rounded-sm flex items-center justify-center text-xl shadow-md transition-all group-hover:-translate-y-1 ${isActive(GameView.MAP) ? 'bg-[#5c4b40] border-[#eaddcf]' : 'bg-[#4a3b32] border-[#855e42] group-hover:border-[#eaddcf] group-hover:bg-[#5c4b40]'}`}>
                    🗺️
                </div>
                <span className={`text-[8px] uppercase font-bold tracking-widest drop-shadow-md ${isActive(GameView.MAP) ? 'text-white' : 'text-[#eaddcf] group-hover:text-white'}`}>Map</span>
            </button>

            <button
                onClick={() => handleNavigation(GameView.BATTLE)}
                className="flex flex-col items-center gap-1 p-2 group"
            >
                <div className={`w-10 h-10 border-2 rounded-sm flex items-center justify-center text-xl shadow-md transition-all group-hover:-translate-y-1 ${isActive(GameView.BATTLE) ? 'bg-[#5c4b40] border-[#eaddcf]' : 'bg-[#4a3b32] border-[#855e42] group-hover:border-[#eaddcf] group-hover:bg-[#5c4b40]'}`}>
                    ⚔️
                </div>
                <span className={`text-[8px] uppercase font-bold tracking-widest drop-shadow-md ${isActive(GameView.BATTLE) ? 'text-white' : 'text-[#eaddcf] group-hover:text-white'}`}>Battle</span>
            </button>

            <button
                onClick={() => router.push('/party')}
                className="flex flex-col items-center gap-1 p-2 group"
            >
                <div className={`w-10 h-10 border-2 rounded-sm flex items-center justify-center text-xl shadow-md transition-all group-hover:-translate-y-1 ${isPartyPage ? 'bg-[#5c4b40] border-[#eaddcf]' : 'bg-[#4a3b32] border-[#855e42] group-hover:border-[#eaddcf] group-hover:bg-[#5c4b40]'}`}>
                    👥
                </div>
                <span className={`text-[8px] uppercase font-bold tracking-widest drop-shadow-md ${isPartyPage ? 'text-white' : 'text-[#eaddcf] group-hover:text-white'}`}>Party</span>
            </button>

            <button
                onClick={() => router.push('/tavern-regulars')}
                className="flex flex-col items-center gap-1 p-2 group"
            >
                <div className={`w-10 h-10 border-2 rounded-sm flex items-center justify-center text-xl shadow-md transition-all group-hover:-translate-y-1 ${pathname === '/tavern-regulars' ? 'bg-[#5c4b40] border-[#eaddcf]' : 'bg-[#4a3b32] border-[#855e42] group-hover:border-[#eaddcf] group-hover:bg-[#5c4b40]'}`}>
                    🍻
                </div>
                <span className={`text-[8px] uppercase font-bold tracking-widest drop-shadow-md ${pathname === '/tavern-regulars' ? 'text-white' : 'text-[#eaddcf] group-hover:text-white'}`}>Regulars</span>
            </button>

            <button
                onClick={() => router.push('/town-posse')}
                className="flex flex-col items-center gap-1 p-2 group"
            >
                <div className={`w-10 h-10 border-2 rounded-sm flex items-center justify-center text-xl shadow-md transition-all group-hover:-translate-y-1 ${pathname === '/town-posse' ? 'bg-[#5c4b40] border-[#eaddcf]' : 'bg-[#4a3b32] border-[#855e42] group-hover:border-[#eaddcf] group-hover:bg-[#5c4b40]'}`}>
                    🤠
                </div>
                <span className={`text-[8px] uppercase font-bold tracking-widest drop-shadow-md ${pathname === '/town-posse' ? 'text-white' : 'text-[#eaddcf] group-hover:text-white'}`}>Posse</span>
            </button>
        </nav>
    );
};
