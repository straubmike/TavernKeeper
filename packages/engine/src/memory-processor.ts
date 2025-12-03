/**
 * Memory Processor
 *
 * Processes game events into agent memory updates
 */

import type {
  AgentMemory,
  CombatEvent,
  ExplorationEvent,
  GameEvent,
  InteractionEvent,
} from '@innkeeper/lib';

export interface AgentMemoryUpdate {
  shortTerm?: Array<{ eventId: string; timestamp: number }>;
  episodic?: Array<{ runId: string; summary: string }>;
  longTerm?: {
    reputations?: Record<string, number>;
    lore?: string[];
    relationships?: Record<string, string>;
  };
}

/**
 * Process events for a specific agent and generate memory updates
 */
export function processEventsForMemory(
  events: GameEvent[],
  agentId: string,
  runId: string
): AgentMemoryUpdate {
  const update: AgentMemoryUpdate = {
    shortTerm: [],
    episodic: [],
    longTerm: {
      reputations: {},
      lore: [],
      relationships: {},
    },
  };

  // Process events relevant to this agent
  const relevantEvents = events.filter((event) => isEventRelevant(event, agentId));

  // Update short-term memory (last 10 events)
  update.shortTerm = relevantEvents
    .slice(-10)
    .map((event) => ({
      eventId: event.id,
      timestamp: event.timestamp,
    }));

  // Process events for episodic and long-term memory
  for (const event of relevantEvents) {
    processEventForMemory(event, agentId, update);
  }

  // Generate episodic summary
  if (relevantEvents.length > 0) {
    const summary = generateEpisodicSummary(relevantEvents, agentId);
    update.episodic = [{ runId, summary }];
  }

  return update;
}

/**
 * Check if an event is relevant to an agent
 */
function isEventRelevant(event: GameEvent, agentId: string): boolean {
  // Event involves the agent
  if (
    (event.type === 'combat' && (event as CombatEvent).actorId === agentId) ||
    (event.type === 'combat' && (event as CombatEvent).targetId === agentId) ||
    (event.type === 'exploration' && (event as ExplorationEvent).actorId === agentId) ||
    (event.type === 'interaction' && (event as InteractionEvent).actorId === agentId) ||
    (event.type === 'interaction' && (event as InteractionEvent).targetId === agentId)
  ) {
    return true;
  }

  // System events are always relevant
  if (event.type === 'system' || event.type === 'narrative') {
    return true;
  }

  return false;
}

/**
 * Process a single event for memory updates
 */
function processEventForMemory(
  event: GameEvent,
  agentId: string,
  update: AgentMemoryUpdate
): void {
  switch (event.type) {
    case 'combat': {
      const combatEvent = event as CombatEvent;

      // Update relationships based on combat
      if (combatEvent.actorId === agentId && combatEvent.targetId) {
        // Agent attacked someone
        update.longTerm!.relationships![combatEvent.targetId] = 'hostile';
        update.longTerm!.reputations![combatEvent.targetId] =
          (update.longTerm!.reputations![combatEvent.targetId] || 0) - 1;
      } else if (combatEvent.targetId === agentId && combatEvent.actorId) {
        // Agent was attacked
        update.longTerm!.relationships![combatEvent.actorId] = 'hostile';
        update.longTerm!.reputations![combatEvent.actorId] =
          (update.longTerm!.reputations![combatEvent.actorId] || 0) - 1;
      }

      // Add lore about combat outcomes
      if (combatEvent.action === 'death') {
        update.longTerm!.lore!.push(
          `${combatEvent.actorId} was defeated${combatEvent.targetId ? ` by ${combatEvent.targetId}` : ''}`
        );
      }
      break;
    }

    case 'exploration': {
      const explorationEvent = event as ExplorationEvent;

      if (explorationEvent.action === 'enter_room' && explorationEvent.roomId) {
        // Add lore about room discovery
        update.longTerm!.lore!.push(`Discovered room: ${explorationEvent.roomId}`);
      } else if (explorationEvent.action === 'level_transition') {
        // Add lore about level transition
        update.longTerm!.lore!.push(
          `Transitioned from level ${explorationEvent.fromLevelZ} to level ${explorationEvent.toLevelZ}`
        );
      }
      break;
    }

    case 'interaction': {
      const interactionEvent = event as InteractionEvent;

      // Update relationships based on interactions
      if (interactionEvent.success) {
        if (interactionEvent.actorId === agentId && interactionEvent.targetId) {
          // Successful interaction - positive relationship
          const currentRep = update.longTerm!.reputations![interactionEvent.targetId] || 0;
          update.longTerm!.reputations![interactionEvent.targetId] = currentRep + 0.5;

          if (!update.longTerm!.relationships![interactionEvent.targetId]) {
            update.longTerm!.relationships![interactionEvent.targetId] = 'neutral';
          }
        }
      }
      break;
    }

    case 'system': {
      // System events might contain important information
      // Could extract key information for lore
      break;
    }

    case 'narrative': {
      // Narrative events might contain lore
      // Could extract key phrases or information
      break;
    }
  }
}

/**
 * Generate episodic summary from events
 */
function generateEpisodicSummary(events: GameEvent[], agentId: string): string {
  const summaries: string[] = [];

  // Count combat actions
  const combatEvents = events.filter((e) => e.type === 'combat') as CombatEvent[];
  const attacks = combatEvents.filter((e) => e.actorId === agentId && e.action === 'attack').length;
  const hits = combatEvents.filter((e) => e.actorId === agentId && e.hit).length;
  const deaths = combatEvents.filter((e) => e.action === 'death').length;

  if (attacks > 0) {
    summaries.push(`Attacked ${attacks} time(s), ${hits} hit(s)`);
  }

  // Count exploration
  const explorationEvents = events.filter((e) => e.type === 'exploration') as ExplorationEvent[];
  const roomsEntered = explorationEvents.filter(
    (e) => e.actorId === agentId && e.action === 'enter_room'
  ).length;
  const levelTransitions = explorationEvents.filter(
    (e) => e.actorId === agentId && e.action === 'level_transition'
  ).length;

  if (roomsEntered > 0) {
    summaries.push(`Explored ${roomsEntered} room(s)`);
  }
  if (levelTransitions > 0) {
    summaries.push(`Transitioned ${levelTransitions} level(s)`);
  }

  // Count interactions
  const interactionEvents = events.filter((e) => e.type === 'interaction') as InteractionEvent[];
  const interactions = interactionEvents.filter((e) => e.actorId === agentId).length;

  if (interactions > 0) {
    summaries.push(`Performed ${interactions} interaction(s)`);
  }

  if (summaries.length === 0) {
    return 'No significant actions taken';
  }

  return summaries.join('. ');
}

/**
 * Merge memory updates into existing memory
 */
export function mergeMemoryUpdates(
  existingMemory: AgentMemory,
  updates: AgentMemoryUpdate
): AgentMemory {
  return {
    shortTerm: updates.shortTerm || existingMemory.shortTerm,
    episodic: [
      ...existingMemory.episodic,
      ...(updates.episodic || []),
    ],
    longTerm: {
      reputations: {
        ...existingMemory.longTerm.reputations,
        ...(updates.longTerm?.reputations || {}),
      },
      lore: [
        ...(existingMemory.longTerm.lore || []),
        ...(updates.longTerm?.lore || []),
      ],
      relationships: {
        ...existingMemory.longTerm.relationships,
        ...(updates.longTerm?.relationships || {}),
      },
    },
  };
}
