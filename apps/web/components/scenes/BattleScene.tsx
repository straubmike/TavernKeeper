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
    const { currentRunId, selectedPartyTokenIds, switchView, setSelectedPartyTokenIds, setCurrentRunId } = useGameStore();
    const { events, loading: eventsLoading } = useRunEvents(currentRunId);
    const { status: runStatus } = useRunStatus(currentRunId);
    const [dungeonInfo, setDungeonInfo] = useState<{ name: string; depth: number; theme?: string } | null>(null);
    const [totalXP, setTotalXP] = useState(0);
    const [revealedEventCount, setRevealedEventCount] = useState(0);
    const [partyMembers, setPartyMembers] = useState<Array<{ tokenId: string; name: string; class?: string; metadata?: any }>>([]);
    const hasInitializedRef = useRef(false);
    const revealIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const transitionInitiatedRef = useRef(false);
    const roomDetailsScrollRef = useRef<HTMLDivElement>(null);
    const mapScrollRef = useRef<HTMLDivElement>(null);
    const previousLevelRef = useRef<number>(1);
    const lastPendingCountRef = useRef<number>(-1);
    const lastRevealedCountRef = useRef<number>(-1);
    const lastTransitionCheckRef = useRef<string>('');
    const revealedCountsByLevelRef = useRef<Map<number, number>>(new Map());
    const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const pollingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Fetch party member data using existing hero API (same as party page)
    useEffect(() => {
        const fetchPartyMembers = async () => {
            if (!currentRunId) {
                setPartyMembers([]);
                return;
            }

            try {
                // Get run data to get party token IDs
                const runRes = await fetch(`/api/runs/${currentRunId}`);
                if (!runRes.ok) {
                    // Fallback to selectedPartyTokenIds
                    if (selectedPartyTokenIds.length > 0) {
                        setPartyMembers(selectedPartyTokenIds.map(id => ({ tokenId: id, name: `Hero #${id}`, class: 'warrior' })));
                    }
                    return;
                }

                const runData = await runRes.json();
                const tokenIds = runData.party || selectedPartyTokenIds;

                if (!tokenIds || tokenIds.length === 0) {
                    setPartyMembers([]);
                    return;
                }

                // Use existing /api/heroes/token endpoint (same as party page uses)
                const members = await Promise.all(
                    tokenIds.map(async (tokenId: string) => {
                        try {
                            const heroRes = await fetch(`/api/heroes/token?tokenId=${tokenId}`);
                            if (heroRes.ok) {
                                let heroData = await heroRes.json();

                                // Client-side fallback if metadata is missing but URI is present
                                if ((!heroData.metadata || Object.keys(heroData.metadata).length === 0) && heroData.metadataUri) {
                                    console.log(`[BattleScene] Hero #${tokenId} missing metadata, attempting client-side fetch from: ${heroData.metadataUri}`);
                                    try {
                                        let fetchUri = heroData.metadataUri;
                                        // Handle ipfs:// protocol using a public gateway
                                        if (fetchUri.startsWith('ipfs://')) {
                                            fetchUri = fetchUri.replace('ipfs://', 'https://gateway.pinata.cloud/ipfs/');
                                        }

                                        // Handle base64 data URIs
                                        if (fetchUri.startsWith('data:application/json;base64,')) {
                                            const base64 = fetchUri.replace('data:application/json;base64,', '');
                                            const decoded = atob(base64);
                                            const parsedMetadata = JSON.parse(decoded);
                                            heroData.metadata = parsedMetadata;
                                        } else if (fetchUri.startsWith('http')) {
                                            const metadataRes = await fetch(fetchUri);
                                            if (metadataRes.ok) {
                                                const parsedMetadata = await metadataRes.json();
                                                heroData.metadata = parsedMetadata;
                                            }
                                        }

                                        // Update name and class from fetched metadata
                                        if (heroData.metadata) {
                                            heroData.name = heroData.metadata.name || heroData.name;
                                            console.log(`[BattleScene] ✅ Client-side fetch successful for Hero #${tokenId}: ${heroData.name}`);
                                        }
                                    } catch (clientFetchErr) {
                                        console.warn(`[BattleScene] Client-side metadata fetch failed for Hero #${tokenId}:`, clientFetchErr);
                                    }
                                }

                                const heroClass = heroData.metadata?.hero?.class ||
                                    heroData.metadata?.attributes?.find((a: any) => a.trait_type === 'Class')?.value ||
                                    'Warrior';
                                return {
                                    tokenId,
                                    name: heroData.name || `Hero #${tokenId}`,
                                    class: heroClass.toLowerCase(),
                                    metadata: heroData.metadata,
                                };
                            }
                            return { tokenId, name: `Hero #${tokenId}`, class: 'warrior' };
                        } catch (e) {
                            console.warn(`[BattleScene] Could not fetch hero ${tokenId}:`, e);
                            return { tokenId, name: `Hero #${tokenId}`, class: 'warrior' };
                        }
                    })
                );

                setPartyMembers(members);
                console.log(`[BattleScene] Loaded party:`, members.map(m => `${m.name} (${m.class})`).join(', '));
            } catch (error) {
                console.error('[BattleScene] Error fetching party members:', error);
                // Fallback to token IDs
                if (selectedPartyTokenIds.length > 0) {
                    setPartyMembers(selectedPartyTokenIds.map(id => ({ tokenId: id, name: `Hero #${id}`, class: 'warrior' })));
                }
            }
        };

        fetchPartyMembers();
    }, [currentRunId, selectedPartyTokenIds]);

    // Reset transition flag and level ref when run changes
    useEffect(() => {
        transitionInitiatedRef.current = false;
        currentLevelRef.current = 1;
        previousLevelRef.current = 1;
        revealedCountsByLevelRef.current.clear();
        setRevealedEventCount(0);
        setPartyMembers([]); // Clear party members on run change

        // Clear any running reveal interval
        if (revealIntervalRef.current) {
            clearInterval(revealIntervalRef.current);
            revealIntervalRef.current = null;
        }

        // Clear any polling intervals
        if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
        }
        if (pollingTimeoutRef.current) {
            clearTimeout(pollingTimeoutRef.current);
            pollingTimeoutRef.current = null;
        }
    }, [currentRunId]);

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

    // Track the current level in a ref to persist across renders
    const currentLevelRef = useRef<number>(1);

    // Calculate current level - only advance when all events for current level are revealed
    // This prevents levels from advancing prematurely before events are shown
    const currentLevel = useMemo(() => {
        if (dungeonEvents.length === 0) {
            currentLevelRef.current = 1;
            return 1;
        }

        // Get the highest level with events
        const maxLevelWithEvents = Math.max(...dungeonEvents.map(e => e.level));

        // Start with the current level from ref (don't go backwards)
        let levelToCheck = Math.max(currentLevelRef.current, 1);

        // Only check the current level - don't look ahead to future levels
        const levelData = levelsProgress.find(l => l.level === levelToCheck);
        if (!levelData || levelData.events.length === 0) {
            // No events for current level yet, stay on this level
            return levelToCheck;
        }

        // Calculate total items for current level
        const roomEnterCount = levelData.events.filter(e => e.type === 'room_enter').length;
        const combatEvents = levelData.events.filter(e => e.combatTurns && Array.isArray(e.combatTurns) && e.combatTurns.length > 0);
        const combatTurnsCount = combatEvents.reduce((sum, e) => sum + (e.combatTurns?.length || 0), 0);
        const eventsWithoutCombatTurns = levelData.events.filter(e =>
            e.type !== 'room_enter' && (!e.combatTurns || !Array.isArray(e.combatTurns) || e.combatTurns.length === 0)
        );
        const combatResultEvents = combatEvents.length;
        const otherEventsCount = eventsWithoutCombatTurns.length + combatResultEvents;
        const totalItemsForLevel = roomEnterCount + combatTurnsCount + otherEventsCount;

        // Get the revealed count for THIS level (use saved count if available, otherwise use current)
        const savedRevealedCount = revealedCountsByLevelRef.current.get(levelToCheck);
        const actualRevealedCount = (savedRevealedCount !== undefined && savedRevealedCount > revealedEventCount)
            ? savedRevealedCount
            : revealedEventCount;

        // Check if we've revealed all events for the current level
        // Only advance if ALL events are revealed AND the reveal interval has stopped
        if (actualRevealedCount >= totalItemsForLevel && totalItemsForLevel > 0 && !revealIntervalRef.current) {
            // All events revealed for current level, can advance to next level
            // But only advance by 1 level at a time - don't skip levels
            const nextLevel = levelToCheck + 1;
            if (nextLevel <= maxLevelWithEvents) {
                // Check if next level has events - if not, don't advance yet
                const nextLevelData = levelsProgress.find(l => l.level === nextLevel);
                if (nextLevelData && nextLevelData.events.length > 0) {
                    currentLevelRef.current = nextLevel;
                    return nextLevel;
                }
            }
        }

        // Still revealing events for current level, stay on this level
        return levelToCheck;
    }, [dungeonEvents, levelsProgress, revealedEventCount]);

    // Reset revealedEventCount when level changes (only show current level events)
    // But preserve revealed counts per level so returning to view doesn't reset progress
    useEffect(() => {
        if (previousLevelRef.current !== currentLevel) {
            // Save current revealed count for previous level BEFORE changing
            if (previousLevelRef.current > 0 && revealedEventCount > 0) {
                revealedCountsByLevelRef.current.set(previousLevelRef.current, revealedEventCount);
            }

            // Restore revealed count for new level, or start at 0 if first time
            const savedCount = revealedCountsByLevelRef.current.get(currentLevel) || 0;
            setRevealedEventCount(savedCount);

            // Update the currentLevelRef to match
            currentLevelRef.current = currentLevel;

            // Only log level changes (not initial load from 1 to 1)
            if (previousLevelRef.current !== 1 || currentLevel !== 1) {
                console.log(`[BattleScene] Level ${previousLevelRef.current} -> ${currentLevel} (restored ${savedCount} revealed, total for level: ${levelsProgress.find(l => l.level === currentLevel)?.events.length || 0})`);
            }
            previousLevelRef.current = currentLevel;
            // Reset logging refs on level change
            lastRevealedCountRef.current = -1;
            lastPendingCountRef.current = -1;

            // Center map on current level
            setTimeout(() => {
                if (mapScrollRef.current) {
                    const currentLevelElement = mapScrollRef.current.querySelector(`[data-level="${currentLevel}"]`);
                    if (currentLevelElement) {
                        currentLevelElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }
                }
            }, 100);
        }
    }, [currentLevel, levelsProgress]);

    // Save revealed count whenever it changes (for persistence across view switches)
    // This ensures progress is saved even if user switches views
    useEffect(() => {
        if (currentLevel > 0) {
            // Always save the current count, even if 0 (to mark level as started)
            revealedCountsByLevelRef.current.set(currentLevel, revealedEventCount);
        }
    }, [revealedEventCount, currentLevel]);

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
    // Only show events for CURRENT level - reset when level changes
    useEffect(() => {
        // Calculate total items for CURRENT level only
        // Events with combatTurns should be counted as: combatTurns.length + 1 (for the result event itself)
        const currentLevelData = levelsProgress.find(l => l.level === currentLevel);
        let totalItems = 0;
        let roomEnterCount = 0;
        let combatTurnsCount = 0;
        let otherEventsCount = 0;
        let combatEvents: DungeonEvent[] = [];

        if (currentLevelData) {
            roomEnterCount = currentLevelData.events.filter(e => e.type === 'room_enter').length;

            // Count combat turns from events that have combatTurns
            combatEvents = currentLevelData.events.filter(e => e.combatTurns && Array.isArray(e.combatTurns) && e.combatTurns.length > 0);
            combatTurnsCount = combatEvents.reduce((sum, e) => sum + (e.combatTurns?.length || 0), 0);

            // Count other events (events WITHOUT combatTurns, plus combat result events AFTER their turns)
            // Events with combatTurns are counted separately: turns + result event
            const eventsWithoutCombatTurns = currentLevelData.events.filter(e =>
                e.type !== 'room_enter' && (!e.combatTurns || !Array.isArray(e.combatTurns) || e.combatTurns.length === 0)
            );
            const combatResultEvents = combatEvents.length; // Each combat event gets 1 result event shown after turns
            otherEventsCount = eventsWithoutCombatTurns.length + combatResultEvents;

            totalItems = roomEnterCount + combatTurnsCount + otherEventsCount;

            // Log when level changes or total items changes significantly
            const logKey = `${currentLevel}-${totalItems}`;
            if (lastTransitionCheckRef.current !== logKey && totalItems > 0) {
                console.log(`[BattleScene] Level ${currentLevel}: ${totalItems} total events (${revealedEventCount} revealed)`);
                console.log(`[BattleScene] Level ${currentLevel} breakdown:`, {
                    roomEnterCount,
                    combatTurnsCount,
                    otherEventsCount,
                    combatEvents: combatEvents.length,
                    eventsWithoutCombatTurns: eventsWithoutCombatTurns.length,
                    totalEvents: currentLevelData.events.length
                });
                lastTransitionCheckRef.current = logKey;
            }
        }

        // Only start/continue interval if we have new items to reveal
        // Also ensure we start even if revealedEventCount is 0 (initial state)
        if (totalItems > 0 && totalItems > revealedEventCount && !revealIntervalRef.current) {
            // Log when starting the reveal interval
            console.log(`[BattleScene] Starting reveal interval for level ${currentLevel}: ${revealedEventCount}/${totalItems} revealed`);
            console.log(`[BattleScene] Current level data:`, {
                level: currentLevel,
                eventsCount: currentLevelData?.events.length || 0,
                roomEnterCount,
                combatTurnsCount,
                otherEventsCount,
                totalItems,
                hasRevealInterval: !!revealIntervalRef.current
            });

            // Start revealing events progressively
            revealIntervalRef.current = setInterval(() => {
                setRevealedEventCount(prev => {
                    // Recalculate total items for current level in case new events arrived
                    const currentLevelData = levelsProgress.find(l => l.level === currentLevel);
                    let newTotalItems = 0;
                    if (currentLevelData) {
                        const roomEnterCount = currentLevelData.events.filter(e => e.type === 'room_enter').length;

                        // Count combat turns from events that have combatTurns
                        let combatTurnsCount = 0;
                        const combatEvents = currentLevelData.events.filter(e => e.combatTurns && Array.isArray(e.combatTurns) && e.combatTurns.length > 0);
                        combatTurnsCount = combatEvents.reduce((sum, e) => sum + (e.combatTurns?.length || 0), 0);

                        // Count other events (events WITHOUT combatTurns, plus combat result events AFTER their turns)
                        const eventsWithoutCombatTurns = currentLevelData.events.filter(e =>
                            e.type !== 'room_enter' && (!e.combatTurns || !Array.isArray(e.combatTurns) || e.combatTurns.length === 0)
                        );
                        const combatResultEvents = combatEvents.length; // Each combat event gets 1 result event shown after turns
                        const otherEventsCount = eventsWithoutCombatTurns.length + combatResultEvents;

                        newTotalItems = roomEnterCount + combatTurnsCount + otherEventsCount;
                    }

                    if (prev < newTotalItems) {
                        const nextCount = prev + 1;
                        // Save progress to ref immediately
                        revealedCountsByLevelRef.current.set(currentLevel, nextCount);
                        // Log every 5 reveals to avoid spam
                        if (nextCount % 5 === 0 || nextCount === 1) {
                            console.log(`[BattleScene] Revealed ${nextCount}/${newTotalItems} events for level ${currentLevel}`);
                        }
                        return nextCount;
                    }
                    // Stop interval when all items are revealed
                    if (revealIntervalRef.current) {
                        clearInterval(revealIntervalRef.current);
                        revealIntervalRef.current = null;
                    }
                    // Save final count
                    revealedCountsByLevelRef.current.set(currentLevel, prev);
                    return prev;
                });
            }, 3000); // 3 seconds per item
        }

        return () => {
            // Cleanup: clear interval if component unmounts or dependencies change
            // But only if we're not actively revealing (to prevent clearing during normal operation)
            // The interval will clear itself when all events are revealed
            // NOTE: We intentionally don't clear the interval here to allow it to continue running
        };
    }, [levelsProgress, currentLevel]); // Removed revealedEventCount from deps to prevent restart, but interval will start when levelsProgress changes

    // Don't redirect immediately on mount - wait for events to be revealed
    // The transition logic below will handle redirecting after all events are shown

    // Check for victory/defeat - but wait for all events to be delivered AND revealed first
    useEffect(() => {
        if (!runStatus || !currentRunId) return;
        if (transitionInitiatedRef.current) {
            return; // Already transitioning - stop all checks
        }

        // Only proceed if run has completed (victory or defeat)
        if (runStatus.result !== 'victory' && runStatus.result !== 'defeat') {
            return;
        }

        // Only log once when run status changes to victory/defeat
        const statusKey = `${runStatus.result}-${currentRunId}`;
        if (lastTransitionCheckRef.current !== statusKey) {
            console.log(`[BattleScene] Run status is ${runStatus.result}. Checking if all events are delivered and revealed...`);
            lastTransitionCheckRef.current = statusKey;
        }

        const checkAndTransition = async () => {
            // Stop checking if transition already initiated
            if (transitionInitiatedRef.current) {
                return true; // Already transitioning
            }

            // First check if there are any undelivered events for this run
            try {
                const res = await fetch(`/api/runs/${currentRunId}/events/pending`);
                if (res.ok) {
                    const data = await res.json();
                    const hasPendingEvents = data.pendingCount > 0;

                    // Only log when pending count changes and not transitioning
                    if (!transitionInitiatedRef.current && data.pendingCount !== lastPendingCountRef.current) {
                        if (hasPendingEvents) {
                            console.log(`[BattleScene] Waiting for ${data.pendingCount} pending events...`);
                        }
                        lastPendingCountRef.current = data.pendingCount;
                    }

                    if (hasPendingEvents) {
                        return false; // Not ready to transition
                    }

                    // If run is complete and no pending events, we can stop polling immediately
                    // (don't wait for reveal - that's handled separately)
                    if (runStatus && (runStatus.result === 'victory' || runStatus.result === 'defeat')) {
                        // Run is complete and no pending events - stop polling
                        if (pollingIntervalRef.current) {
                            clearInterval(pollingIntervalRef.current);
                            pollingIntervalRef.current = null;
                        }
                        // Continue to reveal check below
                    }
                } else {
                    // Only log errors once
                    if (lastPendingCountRef.current !== -2) {
                        console.warn(`[BattleScene] Failed to check pending events: ${res.status}`);
                        lastPendingCountRef.current = -2;
                    }
                    return false;
                }
            } catch (error) {
                // Only log errors once
                if (lastPendingCountRef.current !== -3) {
                    console.warn('[BattleScene] Error checking pending events:', error);
                    lastPendingCountRef.current = -3;
                }
                return false;
            }

            // All events delivered, but check if they've all been REVEALED to the user
            const currentLevelData = levelsProgress.find(l => l.level === currentLevel);
            if (!currentLevelData) {
                return false; // No data for current level yet - wait silently
            }

            // Calculate total items for current level
            const roomEnterCount = currentLevelData.events.filter(e => e.type === 'room_enter').length;
            const combatEvents = currentLevelData.events.filter(e => e.combatTurns && Array.isArray(e.combatTurns) && e.combatTurns.length > 0);
            const combatTurnsCount = combatEvents.reduce((sum, e) => sum + (e.combatTurns?.length || 0), 0);
            const eventsWithoutCombatTurns = currentLevelData.events.filter(e =>
                e.type !== 'room_enter' && (!e.combatTurns || !Array.isArray(e.combatTurns) || e.combatTurns.length === 0)
            );
            const combatResultEvents = combatEvents.length;
            const otherEventsCount = eventsWithoutCombatTurns.length + combatResultEvents;
            const totalItemsForCurrentLevel = roomEnterCount + combatTurnsCount + otherEventsCount;

            // Check if we're still revealing events for the current level
            if (revealedEventCount < totalItemsForCurrentLevel) {
                // Only log when revealed count changes significantly (every 25% progress)
                const progressPercent = Math.floor((revealedEventCount / totalItemsForCurrentLevel) * 4);
                const lastProgressRef = Math.floor((lastRevealedCountRef.current / totalItemsForCurrentLevel) * 4);
                if (progressPercent !== lastProgressRef && progressPercent > 0) {
                    console.log(`[BattleScene] Revealing events: ${revealedEventCount}/${totalItemsForCurrentLevel} (${Math.floor((revealedEventCount / totalItemsForCurrentLevel) * 100)}%)`);
                }
                lastRevealedCountRef.current = revealedEventCount;
                return false; // Not ready to transition
            }

            // Also check if the reveal interval is still running (means we're actively revealing)
            if (revealIntervalRef.current) {
                return false; // Not ready to transition - still revealing (no log, happens frequently)
            }

            // Check ALL levels to see if any haven't been fully revealed yet
            const levelsWithEvents = levelsProgress.filter(l => l.events.length > 0);
            for (const levelData of levelsWithEvents) {
                const level = levelData.level;

                // Calculate total items for this level
                const roomEnterCount = levelData.events.filter(e => e.type === 'room_enter').length;
                const combatEvents = levelData.events.filter(e => e.combatTurns && Array.isArray(e.combatTurns) && e.combatTurns.length > 0);
                const combatTurnsCount = combatEvents.reduce((sum, e) => sum + (e.combatTurns?.length || 0), 0);
                const eventsWithoutCombatTurns = levelData.events.filter(e =>
                    e.type !== 'room_enter' && (!e.combatTurns || !Array.isArray(e.combatTurns) || e.combatTurns.length === 0)
                );
                const combatResultEvents = combatEvents.length;
                const otherEventsCount = eventsWithoutCombatTurns.length + combatResultEvents;
                const totalItemsForLevel = roomEnterCount + combatTurnsCount + otherEventsCount;

                // Get revealed count for this level
                const revealedCountForLevel = revealedCountsByLevelRef.current.get(level) || 0;

                // If this level hasn't been fully revealed, don't transition
                if (revealedCountForLevel < totalItemsForLevel && totalItemsForLevel > 0) {
                    // Only log once per level
                    if (lastRevealedCountRef.current !== -level) {
                        console.log(`[BattleScene] Level ${level} not complete: ${revealedCountForLevel}/${totalItemsForLevel} revealed`);
                        lastRevealedCountRef.current = -level;
                    }
                    return false; // Not ready to transition - more levels to process
                }
            }

            // Final check: ensure we've revealed at least some events (safety check)
            if (revealedEventCount === 0 && totalItemsForCurrentLevel > 0) {
                return false; // Not ready - events exist but none revealed yet (no log, happens at start)
            }

            // Only log once when ready to transition
            if (lastRevealedCountRef.current !== totalItemsForCurrentLevel) {
                console.log(`[BattleScene] All events revealed (${revealedEventCount}/${totalItemsForCurrentLevel}). Ready to transition.`);
                lastRevealedCountRef.current = totalItemsForCurrentLevel;
            }

            // All events delivered AND revealed, proceed with transition
            transitionInitiatedRef.current = true;
            console.log(`[BattleScene] All events delivered and revealed. Transitioning to map...`);

            // Redirect to map (not INN) after completion
            // Clear party selection and run ID when transitioning back to map
            setTimeout(() => {
                setSelectedPartyTokenIds([]);
                setCurrentRunId(null);
                if (runStatus.result === 'victory') {
                    onComplete(true);
                    switchView(GameView.MAP);
                } else if (runStatus.result === 'defeat') {
                    onComplete(false);
                    switchView(GameView.MAP);
                }
            }, 2000);

            return true; // Transition initiated
        };

        // Set up polling to check every 5 seconds until all events are delivered (reduced frequency)
        // Use refs to persist interval IDs across renders
        const startPolling = () => {
            // Don't start polling if already transitioning or if polling already active
            if (transitionInitiatedRef.current || pollingIntervalRef.current) {
                return;
            }

            pollingIntervalRef.current = setInterval(async () => {
                // Stop polling if transition was initiated
                if (transitionInitiatedRef.current) {
                    if (pollingIntervalRef.current) {
                        clearInterval(pollingIntervalRef.current);
                        pollingIntervalRef.current = null;
                    }
                    return;
                }

                const transitioned = await checkAndTransition();
                if (transitioned && pollingIntervalRef.current) {
                    clearInterval(pollingIntervalRef.current);
                    pollingIntervalRef.current = null;
                }
            }, 5000); // 5 seconds between checks
        };

        // Cleanup after 5 minutes max (safety timeout)
        if (!pollingTimeoutRef.current) {
            pollingTimeoutRef.current = setTimeout(() => {
                if (transitionInitiatedRef.current) {
                    return; // Already transitioning
                }
                console.warn('[BattleScene] Timeout waiting for events. Forcing transition...');
                if (pollingIntervalRef.current) {
                    clearInterval(pollingIntervalRef.current);
                    pollingIntervalRef.current = null;
                }
                transitionInitiatedRef.current = true;
                // Clear party selection and run ID when transitioning back to map
                setSelectedPartyTokenIds([]);
                setCurrentRunId(null);
                if (runStatus.result === 'victory') {
                    onComplete(true);
                    switchView(GameView.MAP);
                } else if (runStatus.result === 'defeat') {
                    onComplete(false);
                    switchView(GameView.MAP);
                }
                if (pollingTimeoutRef.current) {
                    clearTimeout(pollingTimeoutRef.current);
                    pollingTimeoutRef.current = null;
                }
            }, 5 * 60 * 1000); // 5 minutes
        }

        // Check immediately, then start polling if needed
        // Use a small delay to ensure state is settled
        const initialCheckTimeout = setTimeout(() => {
            checkAndTransition().then(transitioned => {
                if (!transitioned && !transitionInitiatedRef.current) {
                    startPolling(); // Start polling silently
                }
            });
        }, 500); // Small delay to ensure state is settled

        return () => {
            // Cleanup on unmount or dependency change
            if (pollingIntervalRef.current) {
                clearInterval(pollingIntervalRef.current);
                pollingIntervalRef.current = null;
            }
            if (pollingTimeoutRef.current) {
                clearTimeout(pollingTimeoutRef.current);
                pollingTimeoutRef.current = null;
            }
            clearTimeout(initialCheckTimeout);
        };
    }, [runStatus?.result, currentRunId]); // Only depend on result and runId, not frequently changing values

    // Get events for current level (needed for hooks below)
    const currentLevelEvents = levelsProgress.find(l => l.level === currentLevel)?.events || [];
    const currentLevelData = levelsProgress.find(l => l.level === currentLevel);
    const completedLevels = levelsProgress.filter(l => l.status === 'completed').length;

    // Get room type emoji (helper function - must be defined before useMemo)
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
            // Only show level as visited if it has events AND it's less than or equal to current level
            // This prevents "spoilers" where future levels show their room type before the user gets there
            visible.push({
                level: i,
                data: levelData,
                isVisited: levelData ? (levelData.events.length > 0 && i <= currentLevel) : false,
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

        // Only process events for the CURRENT level (not all levels)
        const levelEvents = levelsProgress.find(l => l.level === currentLevel)?.events || [];
        if (levelEvents.length === 0) {
            return events;
        }

        // Room entry events (always show first)
        const roomEnterEvents = levelEvents.filter(e => e.type === 'room_enter');
        roomEnterEvents.forEach((event, idx) => {
            if (itemIndex < revealedEventCount) {
                events.push({
                    type: 'room_enter',
                    content: (
                        <div key={event.id || `level-${currentLevel}-room-${idx}`} className="mb-1 text-amber-950">
                            <span className="text-amber-800">🚪 </span>
                            <span>{event.description}</span>
                        </div>
                    ),
                });
            }
            itemIndex++;
        });

        // Combat turns for this level (revealed one by one)
        // Extract turns from events that have combatTurns
        const combatEventsWithTurns = levelEvents.filter(e => e.combatTurns && Array.isArray(e.combatTurns) && e.combatTurns.length > 0);
        const levelCombatTurns = combatEventsWithTurns
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
                        <div key={`level-${currentLevel}-combat-header`} className="text-xs font-bold text-amber-800 mb-1 mt-1">
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

                const turnColor = hit === false
                    ? 'text-amber-700'
                    : isHeal
                        ? 'text-emerald-700'
                        : hit
                            ? 'text-red-700'
                            : 'text-amber-950';

                events.push({
                    type: 'combat_turn',
                    isCombatTurn: true,
                    content: (
                        <div key={`turn-${turn.turnNumber}-${idx}`} className={`mb-1 ${turnColor}`}>
                            {formatCombatTurn(turn)}
                        </div>
                    ),
                });
            });
            itemIndex += turnsToShow;
        }

        // Other events for this level (revealed after combat turns)
        // Process events in chronological order
        const remainingReveals = revealedEventCount - itemIndex;

        // Calculate total combat turns shown so far
        const totalCombatTurnsShown = Math.max(0, itemIndex - roomEnterEvents.length);

        // Get all non-room_enter events, sorted by timestamp
        const otherEvents = levelEvents
            .filter(e => e.type !== 'room_enter')
            .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

        // Track which combat events we've processed turns for
        let combatTurnsProcessed = 0;

        // Show events in order
        for (const event of otherEvents) {
            if (itemIndex >= revealedEventCount) break;

            // If event has combatTurns, check if we should show the result event
            if (event.combatTurns && Array.isArray(event.combatTurns) && event.combatTurns.length > 0) {
                // Check if all turns for this combat event have been shown
                const turnsForThisCombat = event.combatTurns.length;
                const turnsShownForThisCombat = Math.min(turnsForThisCombat, Math.max(0, totalCombatTurnsShown - combatTurnsProcessed));

                if (turnsShownForThisCombat >= turnsForThisCombat) {
                    // All turns for this combat event have been shown, now show the result
                    const getEventColor = () => {
                        if (event.type.includes('victory')) return 'text-emerald-700';
                        if (event.type.includes('defeat') || event.type.includes('party_wipe')) return 'text-red-700';
                        return 'text-amber-950';
                    };

                    events.push({
                        type: event.type,
                        content: (
                            <div key={event.id || `combat-result-${currentLevel}-${combatTurnsProcessed}`} className={`mb-1 ${getEventColor()}`}>
                                <span>⚔️ </span>
                                <span>{event.description}</span>
                            </div>
                        ),
                    });
                    itemIndex++;
                }
                combatTurnsProcessed += turnsForThisCombat;
            } else {
                // Regular event without combat turns - show it immediately if we have reveals left
                const getEventColor = () => {
                    if (event.type.includes('victory') || event.type.includes('disarmed') || event.type === 'rest') {
                        return 'text-emerald-700';
                    }
                    if (event.type.includes('defeat') || event.type.includes('triggered') || event.type === 'party_wipe') {
                        return 'text-red-700';
                    }
                    if (event.type === 'treasure_found') {
                        return 'text-amber-800';
                    }
                    return 'text-amber-950';
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
                        <div key={event.id || `event-${itemIndex}`} className={`mb-1 ${getEventColor()}`}>
                            <span>{getEventIcon()} </span>
                            <span>{event.description}</span>
                        </div>
                    ),
                });
                itemIndex++;
            }
        }

        return events;
    }, [levelsProgress, currentLevel, revealedEventCount]);

    // Auto-scroll room details to bottom when new events are revealed
    useEffect(() => {
        if (roomDetailsScrollRef.current && displayedEvents.length > 0) {
            // Use requestAnimationFrame for smoother scrolling
            requestAnimationFrame(() => {
                if (roomDetailsScrollRef.current) {
                    roomDetailsScrollRef.current.scrollTo({
                        top: roomDetailsScrollRef.current.scrollHeight,
                        behavior: 'smooth'
                    });
                }
            });
        }
    }, [revealedEventCount, displayedEvents.length]);

    // Check if first room_enter event for current level has been revealed
    const firstRoomEnterRevealed = useMemo(() => {
        const levelEvents = levelsProgress.find(l => l.level === currentLevel)?.events || [];
        const roomEnterEvents = levelEvents.filter(e => e.type === 'room_enter');
        if (roomEnterEvents.length === 0) return false;
        // First room_enter is revealed when revealedEventCount >= 1
        return revealedEventCount >= 1;
    }, [currentLevel, levelsProgress, revealedEventCount]);

    // NOW do all conditional returns AFTER all hooks have been called
    if (!currentRunId) {
        return (
            <div className="w-full h-full bg-[#2a1d17] flex flex-col items-center justify-center font-pixel text-[#eaddcf] gap-4">
                <div className="text-4xl">⚠️</div>
                <div className="text-xl">No active run</div>
                <div className="text-sm text-slate-400">Please start a run from the map</div>
                <PixelButton variant="primary" onClick={() => {
                    setSelectedPartyTokenIds([]);
                    setCurrentRunId(null);
                    switchView(GameView.MAP);
                }}>
                    Go to Map
                </PixelButton>
            </div>
        );
    }

    // Check for error events
    const errorEvent = dungeonEvents.find(e => e.type === 'error');
    const hasError = errorEvent || (runStatus && (runStatus.result === 'error' || runStatus.status === 'failed'));

    // Show error state prominently if we have an error event or error status
    if (hasError && (errorEvent || !eventsLoading)) {
        return (
            <div className="w-full h-full bg-[#2a1d17] flex flex-col items-center justify-center font-pixel text-[#eaddcf] gap-4 p-8">
                <div className="text-6xl">❌</div>
                <div className="text-2xl font-bold text-[#ef4444]">Run Failed</div>
                {errorEvent && (
                    <div className="max-w-2xl text-center bg-[#1a120b] border-4 border-[#ef4444] rounded-lg p-6">
                        <div className="text-lg mb-2 text-[#ef4444] font-bold">Error Details:</div>
                        <div className="text-sm text-[#eaddcf] font-mono whitespace-pre-wrap">
                            {errorEvent.description}
                        </div>
                        {errorEvent.level > 0 && (
                            <div className="text-xs text-[#8c7b63] mt-4">
                                Failed at Level {errorEvent.level}
                            </div>
                        )}
                    </div>
                )}
                {runStatus && runStatus.result === 'error' && !errorEvent && (
                    <div className="max-w-2xl text-center bg-[#1a120b] border-4 border-[#ef4444] rounded-lg p-6">
                        <div className="text-sm text-[#eaddcf]">
                            The dungeon run encountered an error. Please try again.
                        </div>
                    </div>
                )}
                <div className="flex gap-4 mt-4">
                    <PixelButton variant="primary" onClick={() => {
                        setSelectedPartyTokenIds([]);
                        setCurrentRunId(null);
                        switchView(GameView.MAP);
                    }}>
                        Back to Map
                    </PixelButton>
                </div>
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

    // Show timeout state if we have timeout status but no events
    if (runStatus && runStatus.result === 'timeout' && dungeonEvents.length === 0 && !eventsLoading) {
        return (
            <div className="w-full h-full bg-[#2a1d17] flex flex-col items-center justify-center font-pixel text-[#eaddcf] gap-4 p-8">
                <div className="text-6xl">⏱️</div>
                <div className="text-2xl font-bold text-[#ef4444]">Run Timed Out</div>
                <div className="max-w-2xl text-center bg-[#1a120b] border-4 border-[#ef4444] rounded-lg p-6">
                    <div className="text-sm text-[#eaddcf]">
                        The dungeon run simulation timed out before generating any events. This may indicate:
                    </div>
                    <ul className="text-xs text-[#8c7b63] mt-4 list-disc list-inside text-left space-y-2">
                        <li>Hero initialization failed</li>
                        <li>Dungeon data was missing or invalid</li>
                        <li>Simulation encountered an unexpected error</li>
                    </ul>
                </div>
                <div className="flex gap-4 mt-4">
                    <PixelButton variant="primary" onClick={() => {
                        setSelectedPartyTokenIds([]);
                        setCurrentRunId(null);
                        switchView(GameView.MAP);
                    }}>
                        Back to Map
                    </PixelButton>
                </div>
            </div>
        );
    }

    // Check for run completion (defeat or victory)
    const outcomeEvent = useMemo(() => {
        // Run is finished if we have an explicit ending event
        return dungeonEvents.find(e =>
            e.type === 'party_wipe' ||
            e.type === 'combat_defeat' ||
            e.type === 'dungeon_cleared' || // Optimistic check
            (e.type === 'combat_victory' && e.level === dungeonInfo?.depth) // Implied victory
        );
    }, [dungeonEvents, dungeonInfo]);

    // Only show outcome when all events are revealed
    // We add a small delay/buffer to ensure the last event is fully readable
    const showOutcome = useMemo(() => {
        if (!outcomeEvent) return false;
        // Check if we've revealed the outcome event
        const outcomeIndex = dungeonEvents.findIndex(e => e.id === outcomeEvent.id);
        return revealedEventCount > outcomeIndex;
    }, [outcomeEvent, revealedEventCount, dungeonEvents]);

    return (
        <div className="w-full h-full bg-[#2a1d17] relative flex flex-col font-pixel overflow-hidden">
            {/* Outcome Overlay */}
            {showOutcome && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-500">
                    <div className="bg-[#2a1d17] border-4 border-[#5c4033] p-8 text-center shadow-2xl max-w-md mx-4 relative overflow-hidden">
                        {/* Background pattern */}
                        <div className="absolute inset-0 opacity-10 pointer-events-none" style={{
                            backgroundImage: 'radial-gradient(#5c4033 1px, transparent 1px)',
                            backgroundSize: '10px 10px'
                        }} />

                        <div className="relative z-10">
                            <div className="text-6xl mb-6 animate-bounce">
                                {outcomeEvent?.type === 'party_wipe' || outcomeEvent?.type === 'combat_defeat' ? '💀' :
                                    outcomeEvent?.type === 'error' ? '⚠️' : '🏆'}
                            </div>
                            <div className={`text-4xl font-bold mb-2 tracking-widest ${outcomeEvent?.type === 'party_wipe' || outcomeEvent?.type === 'combat_defeat' || outcomeEvent?.type === 'error' ? 'text-[#ef4444]' : 'text-[#ffd700]'
                                }`}>
                                {outcomeEvent?.type === 'party_wipe' || outcomeEvent?.type === 'combat_defeat' ? 'DEFEAT' :
                                    outcomeEvent?.type === 'error' ? 'ERROR' : 'VICTORY'}
                            </div>
                            <div className="text-[#8c7b63] mb-8 font-mono text-sm leading-relaxed">
                                {outcomeEvent?.description || 'The adventure has ended.'}
                            </div>
                            <div className="flex justify-center gap-4">
                                <PixelButton variant="primary" className="scale-125" onClick={() => {
                                    setSelectedPartyTokenIds([]);
                                    setCurrentRunId(null);
                                    switchView(GameView.MAP);
                                }}>
                                    Return to Tavern
                                </PixelButton>
                            </div>
                        </div>
                    </div>
                </div>
            )}
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
                        <div className="text-xs text-[#8c7b63] flex items-center gap-2 mt-1 flex-wrap">
                            <span>
                                Party: {partyMembers.length > 0
                                    ? partyMembers.map(m => m.name).join(', ')
                                    : selectedPartyTokenIds.length > 0
                                        ? selectedPartyTokenIds.join(', ')
                                        : '0'}
                            </span>
                            <span>•</span>
                            <span className="text-[#22c55e]">XP: {totalXP}</span>
                            <span>•</span>
                            <span className="text-[#3b82f6]">Progress: {completedLevels}/{dungeonInfo?.depth || '?'}</span>
                        </div>
                    </div>
                </div>

                {/* Room Scene Content - Placeholder for animations */}
                {/* Only show room type when first room_enter event is revealed */}
                <div className="absolute inset-0 flex items-center justify-center">
                    {firstRoomEnterRevealed && (currentLevelData?.roomType === 'combat' || currentLevelData?.roomType === 'boss' || currentLevelData?.roomType === 'mid_boss') ? (
                        <div className="text-center">
                            <div className="text-6xl mb-4 animate-pulse">⚔️</div>
                            <div className="text-lg text-[#eaddcf]">Combat in Progress...</div>
                        </div>
                    ) : firstRoomEnterRevealed && currentLevelData?.roomType === 'trap' ? (
                        <div className="text-center">
                            <div className="text-6xl mb-4">⚠️</div>
                            <div className="text-lg text-[#eaddcf]">Trap Encounter</div>
                        </div>
                    ) : firstRoomEnterRevealed && currentLevelData?.roomType === 'treasure' ? (
                        <div className="text-center">
                            <div className="text-6xl mb-4">💰</div>
                            <div className="text-lg text-[#eaddcf]">Treasure Room</div>
                        </div>
                    ) : firstRoomEnterRevealed && currentLevelData?.roomType === 'safe' ? (
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
                    <div ref={mapScrollRef} className="flex-1 min-h-0 overflow-y-auto p-4 flex flex-col items-center relative">
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

                                // For current level, only show room type emoji when first room_enter event is revealed
                                let roomTypeForEmoji = item.data?.roomType;
                                if (isCurrent && !roomTypeForEmoji) {
                                    // Check current level events for room_enter to get room type
                                    const currentLevelEvents = levelsProgress.find(l => l.level === currentLevel)?.events || [];
                                    const roomEnterEvent = currentLevelEvents.find(e => e.type === 'room_enter');
                                    if (roomEnterEvent && firstRoomEnterRevealed) {
                                        roomTypeForEmoji = roomEnterEvent.roomType;
                                    }
                                }

                                // Current level should show ? until first room_enter is revealed, then show actual room type
                                const roomEmoji = isCurrent
                                    ? (firstRoomEnterRevealed && roomTypeForEmoji ? getRoomEmoji(roomTypeForEmoji) : '❓')
                                    : (item.isVisited ? getRoomEmoji(item.data?.roomType) : '❓');

                                return (
                                    <div key={item.level} data-level={item.level} className="group relative flex items-center justify-center">
                                        {/* Level number to the side - positioned outside the circle */}
                                        <div className={`absolute -left-10 text-right shrink-0 w-8 ${isCurrent ? 'text-[#ffd700]' : isCompleted ? 'text-[#22c55e]' : 'text-[#8c7b63]'
                                            }`}>
                                            <span className="text-sm font-bold">{item.level}.</span>
                                        </div>

                                        {/* Circle with emoji inside - matching MapScene (w-16 h-16, border-4, text-2xl) */}
                                        <div className={`w-16 h-16 rounded-full border-4 flex items-center justify-center shrink-0 relative shadow-xl transition-all duration-300 ${isCurrent
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
                    <div ref={roomDetailsScrollRef} className="flex-1 min-h-0 overflow-y-auto p-3 text-xs font-mono text-amber-950 leading-relaxed">
                        {currentLevelEvents.length === 0 ? (
                            <div className="flex items-center justify-center h-full text-amber-800">
                                <div className="text-center">
                                    <div className="text-4xl mb-4">🚪</div>
                                    <div>Entering level {currentLevel}...</div>
                                    <div className="text-xs mt-2">Waiting for events...</div>
                                </div>
                            </div>
                        ) : (
                            <>
                                {/* Display events progressively as simple text */}
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

        </div>
    );
};
