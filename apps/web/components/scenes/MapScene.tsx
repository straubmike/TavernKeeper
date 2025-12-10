import React, { useEffect, useState } from 'react';
import { useAccount } from 'wagmi';
import { useRunStatus } from '../../lib/hooks/useRunStatus';
import { runService } from '../../lib/services/runService';
import { useGameStore } from '../../lib/stores/gameStore';
import { GameView } from '../../lib/types';
import { PartySelector } from '../party/PartySelector';
import { PublicPartyLobby } from '../party/PublicPartyLobby';
import { PixelButton } from '../PixelComponents';

interface Room {
    id: string;
    name?: string;
    type: 'room' | 'corridor' | 'chamber' | 'boss';
    connections: string[];
}

interface DungeonMap {
    id: string;
    name: string;
    description?: string;
    geographyType: string;
    rooms: Room[];
}

export const MapScene: React.FC = () => {
    const { selectedPartyTokenIds, setSelectedPartyTokenIds, currentRunId, setCurrentRunId, switchView } = useGameStore();
    const { address, isConnected } = useAccount();
    const authenticated = isConnected;

    const [map, setMap] = useState<DungeonMap | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showPartySelector, setShowPartySelector] = useState(false);
    const [creatingRun, setCreatingRun] = useState(false);
    const [currentPartyId, setCurrentPartyId] = useState<string | null>(null);

    const [stats, setStats] = useState<{ dailyRuns: number; remainingFreeRuns: number } | null>(null);
    const [runCostMon, setRunCostMon] = useState<string>('0');

    // Poll run status if we have a current run
    const { status: runStatus } = useRunStatus(currentRunId);

    // Fetch Stats & Map
    useEffect(() => {
        const fetchMap = async () => {
            try {
                // Fetch a random dungeon from available dungeons
                const dungeonsRes = await fetch('/api/dungeons');
                if (!dungeonsRes.ok) throw new Error('Failed to load dungeons');
                const dungeonsData = await dungeonsRes.json();
                
                if (!dungeonsData.dungeons || dungeonsData.dungeons.length === 0) {
                    throw new Error('No dungeons available');
                }
                
                // Randomly select a dungeon
                const randomIndex = Math.floor(Math.random() * dungeonsData.dungeons.length);
                const selectedDungeon = dungeonsData.dungeons[randomIndex];
                
                // Fetch the map for the selected dungeon
                const res = await fetch(`/api/map?id=${selectedDungeon.id}`);
                if (!res.ok) throw new Error('Failed to load map');
                const data = await res.json();
                setMap(data);
            } catch (err) {
                console.error(err);
                setError('Could not load map data');
            } finally {
                setLoading(false);
            }
        };

        const fetchStats = async () => {
            if (!address) return;
            try {
                const res = await fetch(`/api/runs/stats?wallet=${address}`);
                if (res.ok) {
                    const data = await res.json();
                    setStats(data);
                }
            } catch (e) {
                console.error("Failed to fetch stats", e);
            }
        };

        const fetchPrice = async () => {
            try {
                const { calculateMonAmount } = await import('../../lib/services/monPriceService');
                const cost = await calculateMonAmount(0.25);
                setRunCostMon(cost);
            } catch (e) {
                console.error("Failed to fetch price", e);
            }
        };

        fetchMap();
        if (address) {
            fetchStats();
            fetchPrice();
        }
    }, [address]);

    // Transition to battle when run starts (has start_time but no end_time means it's running)
    useEffect(() => {
        if (runStatus && runStatus.start_time && !runStatus.end_time && currentRunId) {
            switchView(GameView.BATTLE);
        }
    }, [runStatus, currentRunId, switchView]);

    if (loading) {
        return (
            <div className="w-full h-full flex items-center justify-center text-white font-pixel">
                <div className="text-center">
                    <div className="text-2xl mb-4">🗺️</div>
                    <div>Loading Map...</div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="w-full h-full flex items-center justify-center text-red-400 font-pixel">
                <div className="text-center">
                    <div className="text-2xl mb-4">⚠️</div>
                    <div>{error}</div>
                    <PixelButton
                        variant="primary"
                        onClick={() => window.location.reload()}
                        className="mt-4"
                    >
                        Retry
                    </PixelButton>
                </div>
            </div>
        );
    }

    if (!map) return null;

    // Simple vertical layout for now, filtering for main rooms
    const mainRooms = map.rooms.filter(r => r.type !== 'corridor');

    async function handleEnterArea() {
        if (!authenticated || !address) {
            setError('Please connect your wallet');
            return;
        }

        // If no party selected, show party selector
        if (selectedPartyTokenIds.length === 0 && !currentPartyId) {
            setShowPartySelector(true);
            return;
        }

        // Check availability/payment logic here or in handleCreateRun
        if (stats && stats.remainingFreeRuns === 0) {
            const confirmPay = confirm(`Daily free runs used. Pay ${runCostMon} MON (~$0.25) to start run?`);
            if (!confirmPay) return;
        }

        // If we have a party selected, create run
        if (selectedPartyTokenIds.length > 0) {
            await handleCreateRun(selectedPartyTokenIds);
        }
    }

    async function handleCreateRun(tokenIds: string[]) {
        setCreatingRun(true);
        setError(null);

        try {
            // Payment handling mock
            let paymentHash: string | undefined = undefined;
            if (stats && stats.remainingFreeRuns === 0) {
                // Simulate payment tx
                console.log("Processing payment...");
                paymentHash = "0xmock_payment_hash_" + Date.now();
            }

            // If no specific dungeon selected, let the API randomly select one
            const result = await runService.createRun({
                dungeonId: map?.id || undefined, // Let API randomly select if not provided
                party: tokenIds,
                walletAddress: address as string,
                paymentHash
            });

            setCurrentRunId(result.id);

            // Refetch stats
            try {
                const res = await fetch(`/api/runs/stats?wallet=${address}`);
                if (res.ok) {
                    const data = await res.json();
                    setStats(data);
                }
            } catch (e) {
                console.error("Failed to refetch stats", e);
            }

            // Transition to battle view (will be handled by run status polling)
            switchView(GameView.BATTLE);
        } catch (err) {
            console.error('Failed to create run:', err);
            // Check if error is handling JSON or just message
            let errMsg = 'Failed to create run';
            if (err instanceof Error) {
                errMsg = err.message;
                // If locking error, it might be in the message
            }
            setError(errMsg);
        } finally {
            setCreatingRun(false);
        }
    }

    // Map Visualization
    return (
        <div className="w-full h-full bg-[#1a120b] flex flex-col items-center py-8 relative overflow-hidden font-pixel">
            {/* Background Image Layer */}
            <div className="absolute inset-0 opacity-30 pointer-events-none" style={{
                backgroundColor: '#2a1d17', // Fallback color
                backgroundImage: 'radial-gradient(#4a3b32 2px, transparent 2px)', // Procedural pattern
                backgroundSize: '20px 20px',
                filter: 'sepia(1) contrast(1.2)'
            }} />

            {/* Map Area */}
            <div className="flex-1 w-full max-w-md relative flex items-center justify-center min-h-0">
                {/* TODO: This flowchart visualization is a placeholder and does not accurately represent the actual dungeon structure.
                     The current implementation generates a simplified room list from dungeon depth, but the actual dungeon has:
                     - A levelLayout array with specific room types per level
                     - Mid-boss and final boss locations
                     - Actual room connections and structure
                     This needs to be updated to visualize the real dungeon structure from the dungeon.map.levelLayout data. */}
                {/* Connection Lines */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="w-1 h-[80%] bg-gradient-to-b from-amber-900/20 via-amber-700/40 to-amber-900/20 rounded-full" />
                </div>

                {/* Nodes Container */}
                <div className="flex flex-col gap-12 z-10 w-full items-center py-8">
                    {mainRooms.map((room, index) => {
                        // Mock status for visualization
                        const isCurrent = index === 0;
                        const isLocked = index > 1;
                        const isVisited = index === 0;
                        const isBoss = room.type === 'boss';

                        let icon = '📍';
                        if (room.type === 'boss') icon = '💀';
                        if (room.type === 'chamber') icon = '💎';
                        if (index === 0) icon = '⛺';

                        return (
                            <div key={room.id} className="group relative flex items-center justify-center">
                                {/* Node Button */}
                                <button
                                    disabled={isLocked}
                                    className={`
                                        w-16 h-16 rounded-full border-4 flex items-center justify-center text-2xl shadow-xl transition-all duration-300 relative
                                        ${isCurrent
                                            ? 'bg-[#eaddcf] border-amber-500 scale-110 shadow-[0_0_30px_rgba(245,158,11,0.4)] animate-pulse-slow'
                                            : 'bg-[#2a1d17] border-[#5c4033] hover:scale-105 hover:border-amber-700'}
                                        ${isLocked ? 'opacity-40 grayscale cursor-not-allowed' : 'cursor-pointer'}
                                        ${isBoss ? 'w-20 h-20 border-red-900 bg-red-950/50' : ''}
                                    `}
                                >
                                    <span className={`drop-shadow-md ${isLocked ? 'blur-[1px]' : ''}`}>{icon}</span>

                                    {/* Current Indicator Ring */}
                                    {isCurrent && (
                                        <div className="absolute inset-[-8px] border-2 border-amber-500/30 rounded-full animate-ping" />
                                    )}
                                </button>

                                {/* Label Tooltip (Always visible for current/next) */}
                                <div className={`
                                    absolute left-full ml-6 bg-black/80 border border-amber-900/50 px-3 py-2 rounded text-left w-32 backdrop-blur-sm transition-all
                                    ${isLocked ? 'opacity-0 group-hover:opacity-100' : 'opacity-100'}
                                `}>
                                    <div className={`text-[10px] uppercase font-bold tracking-wider ${isCurrent ? 'text-amber-400' : 'text-slate-400'}`}>
                                        {room.type}
                                    </div>
                                    <div className="text-[8px] text-slate-500 capitalize">
                                        {isLocked ? 'Locked' : isCurrent ? 'Current Location' : 'Next Area'}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Action Area */}
            <div className="w-full px-6 pb-6 z-20 mt-auto">
                <div className="flex flex-col gap-2 mb-4">
                    {stats && (
                        <div className="text-center font-pixel text-xs">
                            {stats.remainingFreeRuns > 0 ? (
                                <span className="text-green-400">Free Runs Available: {stats.remainingFreeRuns}/2</span>
                            ) : (
                                <span className="text-amber-400">Daily Limit Reached. Cost: {runCostMon} MON ($0.25)</span>
                            )}
                        </div>
                    )}
                </div>

                <PixelButton
                    variant="primary"
                    className="w-full py-4 text-sm tracking-widest shadow-[0_0_20px_rgba(0,0,0,0.5)] border-amber-600"
                    onClick={handleEnterArea}
                    disabled={creatingRun || !authenticated || !address}
                >
                    <div className="flex items-center justify-center gap-3">
                        <span className="text-xl">⚔️</span>
                        <span>
                            {creatingRun ? 'CREATING RUN...' :
                                (stats && stats.remainingFreeRuns === 0) ? 'START RUN (PAY)' : 'ENTER AREA'}
                        </span>
                    </div>
                </PixelButton>
                {!authenticated && (
                    <div className="text-xs text-red-400 text-center mt-2">
                        Please connect your wallet to start a run
                    </div>
                )}
                {authenticated && selectedPartyTokenIds.length === 0 && !currentPartyId && (
                    <div className="text-xs text-amber-400 text-center mt-2">
                        Select a party to begin
                    </div>
                )}
                {error && (
                    <div className="text-xs text-red-400 text-center mt-2 bg-red-900/20 p-2 border border-red-800 rounded">
                        {error}
                    </div>
                )}
            </div>

            {/* Party Selector Modal */}
            {showPartySelector && address && !currentPartyId && (
                <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
                    <div className="w-full max-w-2xl">
                        <PartySelector
                            walletAddress={address}
                            dungeonId={map?.id}
                            onConfirm={async (tokenIds, mode, partyId) => {
                                if (mode === 'public' && partyId) {
                                    // Show public lobby
                                    setCurrentPartyId(partyId);
                                    setShowPartySelector(false);
                                } else {
                                    // Solo or own-party: create run immediately
                                    setSelectedPartyTokenIds(tokenIds);
                                    setShowPartySelector(false);
                                    // Create run
                                    await handleCreateRun(tokenIds);
                                }
                            }}
                            onCancel={() => setShowPartySelector(false)}
                        />
                    </div>
                </div>
            )}

            {/* Public Party Lobby */}
            {currentPartyId && address && (
                <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
                    <div className="w-full max-w-2xl">
                        <PublicPartyLobby
                            partyId={currentPartyId}
                            walletAddress={address}
                            onPartyStart={(runId) => {
                                setCurrentRunId(runId);
                                setCurrentPartyId(null);
                            }}
                        />
                    </div>
                </div>
            )}
        </div>
    );
};
