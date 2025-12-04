import React, { useEffect, useMemo, useState } from 'react';
import { useRunEvents } from '../../lib/hooks/useRunEvents';
import { useRunStatus } from '../../lib/hooks/useRunStatus';
import { getEntityName, parseCombatEvent } from '../../lib/services/eventParser';
import { useGameStore } from '../../lib/stores/gameStore';
import { GameView } from '../../lib/types';
import { PixelBox, PixelButton } from '../PixelComponents';

interface BattleSceneProps {
    party: any[]; // Keep for compatibility, but we'll use token IDs from store
    onComplete: (success: boolean) => void;
}

interface EntityState {
    id: string;
    name: string;
    hp: number;
    maxHp: number;
    isPlayer: boolean;
}

export const BattleScene: React.FC<BattleSceneProps> = ({ onComplete }) => {
    const { currentRunId, selectedPartyTokenIds, switchView } = useGameStore();
    const { combatEvents, events } = useRunEvents(currentRunId);
    const { status: runStatus } = useRunStatus(currentRunId);

    const [battleLog, setBattleLog] = useState<string[]>(['Battle begins!']);
    const [shake, setShake] = useState(false);
    const [flash, setFlash] = useState(false);
    const [entityStates, setEntityStates] = useState<Map<string, EntityState>>(new Map());
    const [processedEventIds, setProcessedEventIds] = useState<Set<string>>(new Set());

    // Initialize entity states from party token IDs
    useEffect(() => {
        if (selectedPartyTokenIds.length > 0) {
            const newStates = new Map<string, EntityState>();
            selectedPartyTokenIds.forEach(tokenId => {
                newStates.set(tokenId, {
                    id: tokenId,
                    name: `Hero #${tokenId}`,
                    hp: 100, // Will be updated from events
                    maxHp: 100,
                    isPlayer: true,
                });
            });
            setEntityStates(newStates);
        }
    }, [selectedPartyTokenIds]);

    // Process new combat events
    useEffect(() => {
        combatEvents.forEach(event => {
            if (processedEventIds.has(event.id)) return;

            const parsed = parseCombatEvent(event);
            if (!parsed) return;

            setProcessedEventIds(prev => new Set([...prev, event.id]));
            setBattleLog(prev => [parsed.message, ...prev.slice(0, 9)]);

            // Update entity HP
            if (parsed.damage && parsed.targetId) {
                setEntityStates(prev => {
                    const newStates = new Map(prev);
                    const target = newStates.get(parsed.targetId!);
                    if (target) {
                        const newHp = Math.max(0, target.hp - parsed.damage!);
                        newStates.set(parsed.targetId!, {
                            ...target,
                            hp: newHp,
                        });
                    } else {
                        // New entity (enemy)
                        newStates.set(parsed.targetId!, {
                            id: parsed.targetId!,
                            name: getEntityName(parsed.targetId!, selectedPartyTokenIds),
                            hp: 100 - parsed.damage!,
                            maxHp: 100,
                            isPlayer: false,
                        });
                    }
                    return newStates;
                });
            }

            // Visual effects
            if (parsed.type === 'attack' && parsed.hit) {
                setShake(true);
                if (parsed.damage && parsed.damage > 0) {
                    setFlash(true);
                }
                setTimeout(() => {
                    setShake(false);
                    setFlash(false);
                }, 300);
            }
        });
    }, [combatEvents, processedEventIds, selectedPartyTokenIds]);

    // Check for victory/defeat
    useEffect(() => {
        if (!runStatus) return;

        if (runStatus.result === 'victory') {
            setTimeout(() => {
                onComplete(true);
                switchView(GameView.INN);
            }, 2000);
        } else if (runStatus.result === 'defeat') {
            setTimeout(() => {
                onComplete(false);
                switchView(GameView.INN);
            }, 2000);
        }
    }, [runStatus, onComplete, switchView]);

    // Separate players and enemies
    const players = useMemo(() => {
        return Array.from(entityStates.values()).filter(e => e.isPlayer);
    }, [entityStates]);

    const enemies = useMemo(() => {
        return Array.from(entityStates.values()).filter(e => !e.isPlayer);
    }, [entityStates]);

    const primaryEnemy = enemies[0] || { id: 'unknown', name: 'Enemy', hp: 100, maxHp: 100, isPlayer: false };

    if (!currentRunId) {
        return (
            <div className="w-full h-full bg-[#2a1d17] flex flex-col items-center justify-center font-pixel text-[#eaddcf] gap-4">
                <div className="text-4xl">⚠️</div>
                <div className="text-xl">No active run</div>
                <div className="text-sm text-slate-400">Please start a run from the map</div>
                <PixelButton variant="primary" onClick={() => switchView(GameView.MAP)}>
                    Go to Map
                </PixelButton>
            </div>
        );
    }

    if (players.length === 0) {
        return (
            <div className="w-full h-full bg-[#2a1d17] flex flex-col items-center justify-center font-pixel text-[#eaddcf] gap-4">
                <div className="text-4xl animate-pulse">⚔️</div>
                <div className="text-xl">Loading battle...</div>
                <div className="text-xs text-slate-400">Waiting for run events...</div>
            </div>
        );
    }

    return (
        <div className={`w-full h-full bg-[#2a1d17] relative flex flex-col font-pixel overflow-hidden ${shake ? 'animate-shake' : ''}`}>
            {/* Flash Effect */}
            <div className={`absolute inset-0 bg-white pointer-events-none z-50 transition-opacity duration-100 ${flash ? 'opacity-30' : 'opacity-0'}`} />

            {/* Combat Viewport */}
            <div className="flex-1 relative overflow-hidden bg-[#1a120b] border-b-4 border-[#5c4033]">
                {/* Background Pattern */}
                <div className="absolute inset-0 opacity-20" style={{
                    backgroundImage: 'radial-gradient(#4a3b32 2px, transparent 2px)',
                    backgroundSize: '20px 20px'
                }} />

                {/* Enemy Side */}
                <div className="absolute top-1/4 left-10 flex flex-col items-center">
                    <div className={`w-32 h-32 bg-green-600 border-4 border-green-800 shadow-xl transition-all duration-100 relative ${primaryEnemy.hp < primaryEnemy.maxHp ? 'animate-bounce' : ''}`}>
                        <div className="absolute inset-0 border-4 border-green-400 opacity-50"></div>
                        <div className="w-8 h-8 bg-black/40 absolute top-8 left-6"></div>
                        <div className="w-8 h-8 bg-black/40 absolute top-8 right-6"></div>
                        <div className="w-16 h-4 bg-black/40 absolute bottom-6 left-8"></div>
                    </div>

                    {/* Enemy HP Bar */}
                    <div className="mt-4 w-40 bg-[#2a1d17] border-2 border-[#8c7b63] p-1 relative">
                        <div className="h-3 bg-red-900 w-full absolute top-1 left-1" />
                        <div
                            className="h-3 bg-red-500 transition-all duration-300 relative z-10"
                            style={{ width: `${Math.max(0, Math.min(100, (primaryEnemy.hp / primaryEnemy.maxHp) * 100))}%` }}
                        />
                    </div>
                    <span className="mt-2 text-[#eaddcf] text-xs uppercase tracking-widest drop-shadow-md font-bold">
                        {primaryEnemy.name} <span className="text-yellow-500">HP: {primaryEnemy.hp}/{primaryEnemy.maxHp}</span>
                    </span>
                </div>

                {/* Party Side */}
                <div className="absolute bottom-10 right-10 flex gap-6">
                    {players.map((player) => (
                        <div key={player.id} className="transition-all duration-300 flex flex-col items-center gap-2 opacity-80">
                            {/* PFP / Sprite */}
                            <div className="w-24 h-24 border-4 shadow-lg relative group transition-colors duration-300 border-[#8c7b63] bg-[#2a1d17]">
                                {/* Placeholder Sprite */}
                                <div className="w-full h-full flex items-center justify-center text-4xl">
                                    ⚔️
                                </div>
                            </div>

                            {/* HP Bar */}
                            <div className="w-24 h-2 bg-[#2a1d17] border border-[#8c7b63] p-0.5">
                                <div
                                    className="h-full bg-emerald-500"
                                    style={{ width: `${Math.max(0, Math.min(100, (player.hp / player.maxHp) * 100))}%` }}
                                />
                            </div>

                            <div className="text-[10px] uppercase font-bold tracking-wider text-[#eaddcf]">
                                {player.name}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Battle UI Box */}
            <div className="h-1/3 bg-[#2a1d17] border-t-4 border-[#5c4033] p-6 flex gap-6">
                <PixelBox className="flex-1 text-sm leading-loose font-mono" title="Combat Log" variant="paper">
                    <div className="flex flex-col-reverse h-full overflow-hidden">
                        {battleLog.map((log, i) => (
                            <div key={i} className={`py-1 border-b border-amber-900/10 ${i === 0 ? 'text-amber-900 font-bold' : 'text-amber-900/60'}`}>
                                {i === 0 ? '> ' : '  '}{log}
                            </div>
                        ))}
                    </div>
                </PixelBox>

                <div className="w-48 flex flex-col gap-3 justify-center">
                    <PixelButton variant="primary" disabled className="w-full py-3 text-lg shadow-md">Attack</PixelButton>
                    <PixelButton variant="neutral" disabled className="w-full py-2 opacity-50">Magic</PixelButton>
                    <PixelButton variant="neutral" disabled className="w-full py-2 opacity-50">Item</PixelButton>
                </div>
            </div>
        </div>
    );
};
