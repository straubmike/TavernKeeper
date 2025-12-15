import React, { useEffect, useMemo, useState, useRef } from 'react';
import { useRunEvents } from '../../lib/hooks/useRunEvents';
import { useRunStatus } from '../../lib/hooks/useRunStatus';
import { useGameStore } from '../../lib/stores/gameStore';
import { GameView } from '../../lib/types';
import { PixelBox, PixelButton } from '../PixelComponents';

interface BattleSceneProps {
    party: any[]; // Keep for compatibility, but we'll use token IDs from store
    onComplete: (success: boolean) => void;
}

interface DungeonEvent {
    id: string;
    type: string;
    level: number;
    roomType: string;
    description: string;
    timestamp: string;
    combatTurns?: any[]; // Combat turn details if available
}

interface LevelProgress {
    level: number;
    events: DungeonEvent[];
    status: 'pending' | 'in_progress' | 'completed';
    roomType?: string;
}

interface CombatTurn {
    turnNumber: number;
    entityName: string;
    targetName?: string;
    actionType?: string;
    result?: any;
}

export const BattleScene: React.FC<BattleSceneProps> = ({ onComplete }) => {
    const { currentRunId, selectedPartyTokenIds, switchView } = useGameStore();
    const { events, loading: eventsLoading } = useRunEvents(currentRunId);
    const { status: runStatus } = useRunStatus(currentRunId);
    const [dungeonInfo, setDungeonInfo] = useState<{ name: string; depth: number; theme?: string } | null>(null);
    const [totalXP, setTotalXP] = useState(0);
    const [revealedEventCount, setRevealedEventCount] = useState(0);
    const hasInitializedRef = useRef(false);
    const revealIntervalRef = useRef<NodeJS.Timeout | null>(null);

    // Parse events from world_events (they're stored in the payload field)
    const dungeonEvents = useMemo(() => {
        console.log(`[BattleScene] Processing ${events.length} raw events`);
        const parsed: DungeonEvent[] = [];
        events.forEach((event, idx) => {
            // Events from world_events table have a payload field
            const eventData = event.payload || {};
            
            // Debug: log first few events to see structure
            if (idx < 3) {
                console.log(`[BattleScene] Event ${idx}:`, {
                    id: event.id,
                    type: event.type,
                    payload: eventData,
                    hasLevel: eventData.level !== undefined,
                });
            }
            
            // Check if this is a dungeon event (has level property)
            if (eventData.level !== undefined) {
                parsed.push({
                    id: event.id,
                    type: eventData.type || event.type,
                    level: eventData.level,
                    roomType: eventData.roomType || 'unknown',
                    description: eventData.description || eventData.text || `Event: ${event.type}`,
                    timestamp: event.timestamp,
                    combatTurns: eventData.combatTurns || eventData.turns || null,
                });
            } else {
                // Log events that don't have level for debugging
                if (event.type && (event.type.includes('combat') || event.type.includes('trap') || event.type.includes('room'))) {
                    console.warn(`[BattleScene] Event missing level:`, event);
                }
            }
        });
        
        console.log(`[BattleScene] Parsed ${parsed.length} dungeon events from ${events.length} total events`);
        if (parsed.length > 0) {
            console.log(`[BattleScene] Sample parsed event:`, parsed[0]);
        }
        
        return parsed.sort((a, b) => {
            // Sort by level first, then timestamp
            if (a.level !== b.level) return a.level - b.level;
            return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
        });
    }, [events]);

    // Mark as initialized once we have events or have tried loading
    useEffect(() => {
        if (events.length > 0 || (!eventsLoading && currentRunId)) {
            hasInitializedRef.current = true;
        }
    }, [events.length, eventsLoading, currentRunId]);

    // Group events by level
    const levelsProgress = useMemo(() => {
        const levels = new Map<number, LevelProgress>();
        let maxLevel = 0;

        dungeonEvents.forEach(event => {
            maxLevel = Math.max(maxLevel, event.level);
            if (!levels.has(event.level)) {
                levels.set(event.level, {
                    level: event.level,
                    events: [],
                    status: 'pending',
                });
            }
            const levelData = levels.get(event.level)!;
            levelData.events.push(event);
            
            // Update status based on event type
            if (event.type === 'room_enter') {
                levelData.status = 'in_progress';
                levelData.roomType = event.roomType;
            } else if (event.type === 'combat_victory' || event.type === 'trap_disarmed' || event.type === 'rest' || event.type === 'treasure_found') {
                levelData.status = 'completed';
            } else if (event.type === 'combat_defeat' || event.type === 'party_wipe') {
                levelData.status = 'completed';
            }
        });

        // Create array for all levels up to max
        const result: LevelProgress[] = [];
        const maxDepth = dungeonInfo?.depth || Math.max(maxLevel, 1);
        for (let i = 1; i <= maxDepth; i++) {
            if (levels.has(i)) {
                result.push(levels.get(i)!);
            } else {
                result.push({
                    level: i,
                    events: [],
                    status: 'pending',
                });
            }
        }
        return result;
    }, [dungeonEvents, dungeonInfo]);

    // Calculate current level (highest level with events)
    const currentLevel = useMemo(() => {
        if (dungeonEvents.length === 0) return 1;
        return Math.max(...dungeonEvents.map(e => e.level));
    }, [dungeonEvents]);

    // Calculate total XP from events
    useEffect(() => {
        let xp = 0;
        dungeonEvents.forEach(event => {
            // Extract XP from description if present
            const xpMatch = event.description.match(/(\d+)\s*XP/i);
            if (xpMatch) {
                xp += parseInt(xpMatch[1], 10);
            }
        });
        setTotalXP(xp);
    }, [dungeonEvents]);

    // Fetch dungeon info
    useEffect(() => {
        if (!currentRunId) return;

        const fetchDungeonInfo = async () => {
            try {
                const res = await fetch(`/api/runs/${currentRunId}`);
                if (!res.ok) return;
                const data = await res.json();
                if (data.dungeon) {
                    const mapData = typeof data.dungeon.map === 'string' 
                        ? JSON.parse(data.dungeon.map) 
                        : data.dungeon.map;
                    setDungeonInfo({
                        name: mapData?.name || data.dungeon.name || 'Unknown Dungeon',
                        depth: mapData?.depth || 100,
                        theme: mapData?.theme?.name || mapData?.theme?.id,
                    });
                }
            } catch (error) {
                console.error('Error fetching dungeon info:', error);
            }
        };

        fetchDungeonInfo();
    }, [currentRunId]);

    // Progressive reveal of events (1 line every 6 seconds)
    // Accumulate events across all levels - don't reset when level changes
    useEffect(() => {
        // Calculate total items across ALL levels that have been reached
        let totalItems = 0;
        
        levelsProgress.forEach(levelData => {
            if (levelData.level > currentLevel) return; // Only count levels we've reached
            
            const roomEnterCount = levelData.events.filter(e => e.type === 'room_enter').length;
            const combatEvent = levelData.events.find(e => e.combatTurns && e.combatTurns.length > 0);
            const combatTurnsCount = combatEvent?.combatTurns?.length || 0;
            const otherEventsCount = levelData.events.filter(e => e.type !== 'room_enter' && !e.combatTurns).length;
            const levelItems = roomEnterCount + combatTurnsCount + otherEventsCount;
            
            totalItems += levelItems;
        });

        // Only start/continue interval if we have new items to reveal
        if (totalItems > revealedEventCount && !revealIntervalRef.current) {
            // Start revealing events progressively
            revealIntervalRef.current = setInterval(() => {
                setRevealedEventCount(prev => {
                    // Recalculate total items in case new events arrived
                    let newTotalItems = 0;
                    levelsProgress.forEach(levelData => {
                        if (levelData.level > currentLevel) return;
                        const roomEnterCount = levelData.events.filter(e => e.type === 'room_enter').length;
                        const combatEvent = levelData.events.find(e => e.combatTurns && e.combatTurns.length > 0);
                        const combatTurnsCount = combatEvent?.combatTurns?.length || 0;
                        const otherEventsCount = levelData.events.filter(e => e.type !== 'room_enter' && !e.combatTurns).length;
                        newTotalItems += roomEnterCount + combatTurnsCount + otherEventsCount;
                    });
                    
                    if (prev < newTotalItems) {
                        return prev + 1;
                    }
                    // Stop interval when all items are revealed
                    if (revealIntervalRef.current) {
                        clearInterval(revealIntervalRef.current);
                        revealIntervalRef.current = null;
                    }
                    return prev;
                });
            }, 6000); // 6 seconds per item
        }

        return () => {
            // Don't clear interval here - let it run until all events are revealed
        };
    }, [levelsProgress, currentLevel]); // Removed revealedEventCount from deps to prevent restart

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

    // Only show loading on very first load, use ref to prevent re-renders
    if (!hasInitializedRef.current && eventsLoading && dungeonEvents.length === 0) {
        return (
            <div className="w-full h-full bg-[#2a1d17] flex flex-col items-center justify-center font-pixel text-[#eaddcf] gap-4">
                <div className="text-4xl animate-pulse">⚔️</div>
                <div className="text-xl">Loading dungeon run...</div>
                <div className="text-xs text-slate-400">Waiting for simulation to start...</div>
            </div>
        );
    }

    // Get events for current level
    const currentLevelEvents = levelsProgress.find(l => l.level === currentLevel)?.events || [];
    const currentLevelData = levelsProgress.find(l => l.level === currentLevel);
    const completedLevels = levelsProgress.filter(l => l.status === 'completed').length;

    // Get room type emoji
    const getRoomEmoji = (roomType?: string) => {
        if (!roomType) return '❓';
        const type = roomType.toLowerCase();
        if (type.includes('combat') || type.includes('boss')) return '⚔️';
        if (type.includes('trap')) return '⚠️';
        if (type.includes('treasure')) return '💰';
        if (type.includes('safe')) return '💤';
        return '🚪';
    };

    // Calculate visible levels for centered map view
    const visibleLevels = useMemo(() => {
        const levelsToShow = 9; // Show 4 above, current, 4 below
        const startLevel = Math.max(1, currentLevel - 4);
        const endLevel = Math.min(levelsProgress.length, startLevel + levelsToShow);
        
        const visible: Array<{ level: number; data: LevelProgress | null; isVisited: boolean }> = [];
        for (let i = startLevel; i <= endLevel; i++) {
            const levelData = levelsProgress[i - 1] || null;
            visible.push({
                level: i,
                data: levelData,
                isVisited: levelData ? levelData.events.length > 0 : false,
            });
        }
        return visible;
    }, [currentLevel, levelsProgress]);

    // Format combat turn for display (similar to master-generator-tool.html)
    const formatCombatTurn = (turn: any): string => {
        const entityName = turn.entityName || 'Unknown';
        const targetName = turn.targetName || 'Unknown';
        let actionText = '';

        if (turn.action?.actionType === 'attack' || turn.actionType === 'attack') {
            const result = turn.result;
            if (result) {
                if (result.hit) {
                    const critText = result.criticalHit ? ' (CRITICAL!)' : '';
                    actionText = `attacks ${targetName} for ${result.damage || 0} damage${critText}`;
                } else {
                    actionText = `attacks ${targetName} but misses`;
                }
            } else {
                actionText = `attacks ${targetName}`;
            }
        } else if (turn.action?.actionType === 'heal' || turn.actionType === 'heal') {
            const result = turn.result;
            if (result) {
                actionText = `heals ${targetName} for ${result.amount || 0} HP`;
            } else {
                actionText = `heals ${targetName}`;
            }
        } else if (turn.action?.actionType === 'magic-attack' || turn.actionType === 'magic-attack') {
            const result = turn.result;
            if (result) {
                actionText = `casts spell at ${targetName} for ${result.damage || 0} damage`;
            } else {
                actionText = `casts spell at ${targetName}`;
            }
        } else {
            actionText = 'takes action';
        }

        return `Turn ${turn.turnNumber || '?'}: ${entityName} ${actionText}`;
    };

    // Extract combat turns from events
    const combatTurns = useMemo(() => {
        const turns: CombatTurn[] = [];
        currentLevelEvents.forEach(event => {
            if (event.combatTurns && Array.isArray(event.combatTurns)) {
                event.combatTurns.forEach(turn => {
                    turns.push({
                        turnNumber: turn.turnNumber || turns.length + 1,
                        entityName: turn.entityName || 'Unknown',
                        targetName: turn.targetName,
                        actionType: turn.action?.actionType || turn.actionType,
                        result: turn.result,
                    });
                });
            }
        });
        return turns.sort((a, b) => a.turnNumber - b.turnNumber);
    }, [currentLevelEvents]);

    // Get events to display (progressive reveal across ALL levels)
    const displayedEvents = useMemo(() => {
        const events: Array<{ type: string; content: React.ReactNode; isCombatTurn?: boolean }> = [];
        let itemIndex = 0;
        
        // Process events from ALL levels up to current level
        for (let level = 1; level <= currentLevel; level++) {
            const levelEvents = levelsProgress.find(l => l.level === level)?.events || [];
            if (levelEvents.length === 0) continue;
            
            // Add level header if we have events for this level
            if (level > 1 && itemIndex < revealedEventCount) {
                events.push({
                    type: 'level_header',
                    content: (
                        <div key={`level-${level}-header`} className="text-sm font-bold text-[#ffd700] mb-2 mt-4 border-b border-[#5c4033] pb-1">
                            Level {level}
                        </div>
                    ),
                });
            }
            
            // Room entry events (always show first)
            const roomEnterEvents = levelEvents.filter(e => e.type === 'room_enter');
            roomEnterEvents.forEach((event, idx) => {
                if (itemIndex < revealedEventCount) {
                    events.push({
                        type: 'room_enter',
                        content: (
                            <div key={event.id || `level-${level}-room-${idx}`} className="p-3 bg-[#2a1d17] border-l-4 border-[#5c4033] rounded">
                                <div className="flex items-start gap-2">
                                    <span className="text-lg shrink-0">🚪</span>
                                    <div className="flex-1 min-w-0">
                                        <div className="font-mono text-sm text-[#eaddcf]">
                                            {event.description}
                                        </div>
                                        <div className="text-xs text-[#8c7b63] mt-1">
                                            {new Date(event.timestamp).toLocaleTimeString()}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ),
                    });
                }
                itemIndex++;
            });

            // Combat turns for this level (revealed one by one)
            const levelCombatTurns = levelEvents
                .filter(e => e.combatTurns && Array.isArray(e.combatTurns))
                .flatMap(e => e.combatTurns)
                .map(turn => ({
                    turnNumber: turn.turnNumber || 0,
                    entityName: turn.entityName || 'Unknown',
                    targetName: turn.targetName,
                    actionType: turn.action?.actionType || turn.actionType,
                    result: turn.result,
                }))
                .sort((a, b) => a.turnNumber - b.turnNumber);
            
            if (itemIndex < revealedEventCount && levelCombatTurns.length > 0) {
                // Show combat turns header on first turn
                if (itemIndex === roomEnterEvents.length) {
                    events.push({
                        type: 'header',
                        content: (
                            <div key={`level-${level}-combat-header`} className="text-xs font-bold text-[#ffd700] mb-2 border-b border-[#5c4033] pb-1">
                                Combat Turns
                            </div>
                        ),
                    });
                }
                
                const turnsToShow = Math.min(levelCombatTurns.length, revealedEventCount - itemIndex);
                levelCombatTurns.slice(0, turnsToShow).forEach((turn, idx) => {
                const isAttack = turn.actionType === 'attack';
                const isHeal = turn.actionType === 'heal';
                const isMagic = turn.actionType === 'magic-attack';
                const result = turn.result;
                const hit = result?.hit;

                events.push({
                    type: 'combat_turn',
                    isCombatTurn: true,
                    content: (
                        <div
                            key={`turn-${turn.turnNumber}-${idx}`}
                            className={`p-2 bg-[#2a1d17] border-l-4 rounded text-xs font-mono ${
                                hit === false
                                    ? 'border-[#8c7b63] text-[#8c7b63]'
                                    : isHeal
                                    ? 'border-[#22c55e] text-[#22c55e]'
                                    : hit
                                    ? 'border-[#ef4444] text-[#ef4444]'
                                    : 'border-[#5c4033] text-[#eaddcf]'
                            }`}
                        >
                            {formatCombatTurn(turn)}
                        </div>
                    ),
                });
            });
                itemIndex += turnsToShow;
            }

            // Other events for this level (revealed after combat)
            const otherEvents = levelEvents.filter(e => e.type !== 'room_enter' && !e.combatTurns);
            const remainingReveals = revealedEventCount - itemIndex;
            otherEvents.slice(0, remainingReveals).forEach((event, idx) => {
            const getEventColor = () => {
                if (event.type.includes('victory') || event.type.includes('disarmed') || event.type === 'rest') {
                    return 'text-[#22c55e]';
                }
                if (event.type.includes('defeat') || event.type.includes('triggered') || event.type === 'party_wipe') {
                    return 'text-[#ef4444]';
                }
                if (event.type === 'treasure_found') {
                    return 'text-[#ffd700]';
                }
                return 'text-[#eaddcf]';
            };

            const getEventIcon = () => {
                if (event.type.includes('combat')) return '⚔️';
                if (event.type.includes('trap')) return '⚠️';
                if (event.type === 'treasure_found') return '💰';
                if (event.type === 'rest') return '💤';
                return '•';
            };

            events.push({
                type: event.type,
                content: (
                    <div
                        key={event.id || idx}
                        className={`p-3 bg-[#2a1d17] border-l-4 ${
                            event.type.includes('victory') || event.type.includes('disarmed')
                                ? 'border-[#22c55e]'
                                : event.type.includes('defeat') || event.type.includes('triggered')
                                ? 'border-[#ef4444]'
                                : event.type === 'treasure_found'
                                ? 'border-[#ffd700]'
                                : 'border-[#5c4033]'
                        } rounded`}
                    >
                        <div className="flex items-start gap-2">
                            <span className="text-lg shrink-0">{getEventIcon()}</span>
                            <div className="flex-1 min-w-0">
                                <div className={`font-mono text-sm ${getEventColor()}`}>
                                    {event.description}
                                </div>
                                <div className="text-xs text-[#8c7b63] mt-1">
                                    {new Date(event.timestamp).toLocaleTimeString()}
                                </div>
                            </div>
                        </div>
                    </div>
                ),
            });
            itemIndex += Math.min(otherEvents.length, remainingReveals);
            });
        }

        return events;
    }, [levelsProgress, currentLevel, revealedEventCount]);

    return (
        <div className="w-full h-full bg-[#2a1d17] relative flex flex-col font-pixel overflow-hidden">
            {/* Top Panel - Room Scene (1/2 height) */}
            <div className="h-1/2 shrink-0 bg-[#1a120b] border-b-4 border-[#5c4033] relative overflow-hidden">
                {/* Background Pattern */}
                <div className="absolute inset-0 opacity-20" style={{
                    backgroundImage: 'radial-gradient(#4a3b32 2px, transparent 2px)',
                    backgroundSize: '20px 20px'
                }} />
                
                {/* Room Title Overlay - Smaller text, cleaned up */}
                <div className="absolute top-3 left-3 z-10">
                    <div className="bg-[#2a1d17]/90 border-2 border-[#5c4033] rounded px-3 py-1.5">
                        <div className="text-sm text-[#ffd700] font-bold">
                            {dungeonInfo?.name || 'Loading...'} - Level {currentLevel}
                        </div>
                        <div className="text-xs text-[#8c7b63] flex items-center gap-2 mt-1">
                            <span>Party: {selectedPartyTokenIds.length}</span>
                            <span>•</span>
                            <span className="text-[#22c55e]">XP: {totalXP}</span>
                            <span>•</span>
                            <span className="text-[#3b82f6]">Progress: {completedLevels}/{dungeonInfo?.depth || '?'}</span>
                        </div>
                    </div>
                </div>

                {/* Room Scene Content - Placeholder for animations */}
                <div className="absolute inset-0 flex items-center justify-center">
                    {currentLevelData?.roomType === 'combat' || currentLevelData?.roomType === 'boss' || currentLevelData?.roomType === 'mid_boss' ? (
                        <div className="text-center">
                            <div className="text-6xl mb-4 animate-pulse">⚔️</div>
                            <div className="text-lg text-[#eaddcf]">Combat in Progress...</div>
                        </div>
                    ) : currentLevelData?.roomType === 'trap' ? (
                        <div className="text-center">
                            <div className="text-6xl mb-4">⚠️</div>
                            <div className="text-lg text-[#eaddcf]">Trap Encounter</div>
                        </div>
                    ) : currentLevelData?.roomType === 'treasure' ? (
                        <div className="text-center">
                            <div className="text-6xl mb-4">💰</div>
                            <div className="text-lg text-[#eaddcf]">Treasure Room</div>
                        </div>
                    ) : currentLevelData?.roomType === 'safe' ? (
                        <div className="text-center">
                            <div className="text-6xl mb-4">💤</div>
                            <div className="text-lg text-[#eaddcf]">Safe Room - Resting</div>
                        </div>
                    ) : (
                        <div className="text-center">
                            <div className="text-6xl mb-4">🚪</div>
                            <div className="text-lg text-[#eaddcf]">Exploring...</div>
                        </div>
                    )}
                </div>
            </div>

            {/* Bottom Section - Two Columns */}
            <div className="flex-1 min-h-0 flex gap-4 p-4 overflow-hidden">
                {/* Left Column - Dungeon Map (Flowchart Style, Thinner) - Using MapScene styling */}
                <PixelBox className="w-48 shrink-0 flex flex-col" title="Dungeon Map" variant="wood">
                    <div className="flex-1 min-h-0 overflow-y-auto p-4 flex flex-col items-center relative">
                        {/* Connection Line (vertical gradient like MapScene) */}
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <div className="w-1 h-[80%] bg-gradient-to-b from-amber-900/20 via-amber-700/40 to-amber-900/20 rounded-full" />
                        </div>

                        {/* Nodes Container (matching MapScene gap-12) */}
                        <div className="flex flex-col gap-12 z-10 w-full items-center py-8">
                            {visibleLevels.map((item, index) => {
                                const isCurrent = item.level === currentLevel;
                                const isCompleted = item.data?.status === 'completed';
                                const isVisited = item.isVisited;
                                
                                // For current level, check if we have any events to determine room type
                                let roomTypeForEmoji = item.data?.roomType;
                                if (isCurrent && !roomTypeForEmoji) {
                                    // Check current level events for room_enter to get room type
                                    const currentLevelEvents = levelsProgress.find(l => l.level === currentLevel)?.events || [];
                                    const roomEnterEvent = currentLevelEvents.find(e => e.type === 'room_enter');
                                    if (roomEnterEvent) {
                                        roomTypeForEmoji = roomEnterEvent.roomType;
                                    }
                                }
                                
                                // Current level should always show the actual room type if we have it, otherwise ?
                                const roomEmoji = isCurrent 
                                    ? (roomTypeForEmoji ? getRoomEmoji(roomTypeForEmoji) : '❓')
                                    : (item.isVisited ? getRoomEmoji(item.data?.roomType) : '❓');

                                return (
                                    <div key={item.level} className="group relative flex items-center justify-center">
                                        {/* Level number to the side - positioned outside the circle */}
                                        <div className={`absolute -left-10 text-right shrink-0 w-8 ${
                                            isCurrent ? 'text-[#ffd700]' : isCompleted ? 'text-[#22c55e]' : 'text-[#8c7b63]'
                                        }`}>
                                            <span className="text-sm font-bold">{item.level}.</span>
                                        </div>

                                        {/* Circle with emoji inside - matching MapScene (w-16 h-16, border-4, text-2xl) */}
                                        <div className={`w-16 h-16 rounded-full border-4 flex items-center justify-center shrink-0 relative shadow-xl transition-all duration-300 ${
                                            isCurrent
                                                ? 'bg-[#eaddcf] border-amber-500 scale-110 shadow-[0_0_30px_rgba(245,158,11,0.4)] animate-pulse-slow'
                                                : isCompleted
                                                ? 'bg-[#2a1d17] border-[#22c55e]'
                                                : isVisited
                                                ? 'bg-[#2a1d17] border-[#8c7b63]'
                                                : 'bg-[#2a1d17] border-[#5c4033] opacity-40'
                                        }`}>
                                            {/* Emoji with vertical offset to center it better */}
                                            <span className={`text-2xl drop-shadow-md leading-none flex items-center justify-center ${isCurrent ? '' : !isVisited ? 'blur-[1px]' : ''}`} style={{ marginTop: '-2px' }}>
                                                {roomEmoji}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </PixelBox>

                {/* Right Column - Current Room Details (Wider) */}
                <PixelBox className="flex-1 min-w-0 flex flex-col" title={`Level ${currentLevel} - Room Details`} variant="paper">
                    <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3">
                        {currentLevelEvents.length === 0 ? (
                            <div className="flex items-center justify-center h-full text-[#8c7b63]">
                                <div className="text-center">
                                    <div className="text-4xl mb-4">🚪</div>
                                    <div>Entering level {currentLevel}...</div>
                                    <div className="text-xs mt-2">Waiting for events...</div>
                                </div>
                            </div>
                        ) : (
                            <>
                                {/* Display events progressively */}
                                {displayedEvents.map((eventItem, idx) => (
                                    <React.Fragment key={idx}>
                                        {eventItem.content}
                                    </React.Fragment>
                                ))}
                            </>
                        )}
                    </div>
                </PixelBox>
            </div>

            {/* Bottom Status Bar */}
            <div className="h-14 shrink-0 bg-[#1a120b] border-t-4 border-[#5c4033] px-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    {runStatus && (
                        <div className="text-sm text-[#8c7b63]">
                            Status: <span className={`font-bold ${
                                runStatus.result === 'victory' ? 'text-[#22c55e]' :
                                runStatus.result === 'defeat' ? 'text-[#ef4444]' :
                                runStatus.status === 'timeout' ? 'text-[#ef4444]' :
                                'text-[#ffd700]'
                            }`}>
                                {runStatus.result || runStatus.status || 'In Progress'}
                            </span>
                            {events.length > 0 && (
                                <span className="text-xs ml-2 text-[#8c7b63]">
                                    ({events.length} events, {dungeonEvents.length} parsed)
                                </span>
                            )}
                        </div>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    <PixelButton variant="neutral" onClick={() => switchView(GameView.MAP)}>
                        Back to Map
                    </PixelButton>
                </div>
            </div>
        </div>
    );
};
