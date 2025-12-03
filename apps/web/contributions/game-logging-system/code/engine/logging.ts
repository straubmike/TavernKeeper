import type {
  GameEvent,
  CombatEvent,
  ExplorationEvent,
  InteractionEvent,
  SystemEvent,
  NarrativeEvent,
} from '@innkeeper/lib';
import type {
  EventImportance,
  DetailedLogEntry,
  KeyEventEntry,
  DetailedLogConfig,
} from '../types/logging';

/**
 * Detailed log buffer - stores all events temporarily
 * Used for agent summarization and analysis
 */
class DetailedLogBuffer {
  private entries: DetailedLogEntry[] = [];
  private config: DetailedLogConfig;
  private startTime: number;

  constructor(config: DetailedLogConfig = {}) {
    this.config = {
      maxEntries: config.maxEntries ?? 10000,
      ttl: config.ttl ?? 24 * 60 * 60 * 1000, // 24 hours default
      enablePersistence: config.enablePersistence ?? false,
    };
    this.startTime = Date.now();
  }

  /**
   * Add an event to the detailed log
   */
  add(
    event: GameEvent,
    context: DetailedLogEntry['context'],
    metadata?: DetailedLogEntry['metadata']
  ): void {
    const importance = classifyEventImportance(event);
    const entry: DetailedLogEntry = {
      event,
      importance,
      context,
      metadata,
    };

    this.entries.push(entry);

    // Remove old entries if over limit
    if (this.entries.length > this.config.maxEntries!) {
      this.entries.shift();
    }

    // Remove expired entries
    this.cleanup();
  }

  /**
   * Get all entries for a specific agent
   */
  getAgentEntries(agentId: string): DetailedLogEntry[] {
    return this.entries.filter(
      (entry) => entry.metadata?.agentId === agentId
    );
  }

  /**
   * Get entries within a time range
   */
  getEntriesInRange(startTime: Date, endTime: Date): DetailedLogEntry[] {
    const start = startTime.getTime();
    const end = endTime.getTime();
    return this.entries.filter(
      (entry) =>
        entry.event.timestamp >= start && entry.event.timestamp <= end
    );
  }

  /**
   * Get all entries
   */
  getAllEntries(): DetailedLogEntry[] {
    return [...this.entries];
  }

  /**
   * Clear expired entries
   */
  private cleanup(): void {
    if (!this.config.ttl) return;

    const now = Date.now();
    const cutoff = now - this.config.ttl;
    this.entries = this.entries.filter(
      (entry) => entry.event.timestamp >= cutoff
    );
  }

  /**
   * Clear all entries
   */
  clear(): void {
    this.entries = [];
  }

  /**
   * Get buffer statistics
   */
  getStats(): {
    totalEntries: number;
    oldestEntry: number | null;
    newestEntry: number | null;
  } {
    if (this.entries.length === 0) {
      return {
        totalEntries: 0,
        oldestEntry: null,
        newestEntry: null,
      };
    }

    const timestamps = this.entries.map((e) => e.event.timestamp);
    return {
      totalEntries: this.entries.length,
      oldestEntry: Math.min(...timestamps),
      newestEntry: Math.max(...timestamps),
    };
  }
}

// Global detailed log buffer instance
let detailedLogBuffer: DetailedLogBuffer | null = null;

/**
 * Initialize the detailed log buffer
 */
export function initializeDetailedLog(config?: DetailedLogConfig): void {
  detailedLogBuffer = new DetailedLogBuffer(config);
}

/**
 * Get the detailed log buffer instance
 */
export function getDetailedLogBuffer(): DetailedLogBuffer {
  if (!detailedLogBuffer) {
    detailedLogBuffer = new DetailedLogBuffer();
  }
  return detailedLogBuffer;
}

/**
 * Classify the importance of a game event
 * Determines whether an event should be permanently stored
 */
export function classifyEventImportance(event: GameEvent): EventImportance {
  switch (event.type) {
    case 'combat': {
      const combatEvent = event as CombatEvent;
      // Critical: deaths, critical hits, major damage
      if (combatEvent.action === 'death') return 'critical';
      if (combatEvent.critical) return 'important';
      if (combatEvent.damage && combatEvent.damage > 20) return 'important';
      // Normal: regular attacks and damage
      if (combatEvent.action === 'attack' || combatEvent.action === 'damage')
        return 'normal';
      // Verbose: heals and minor actions
      return 'verbose';
    }

    case 'exploration': {
      const explorationEvent = event as ExplorationEvent;
      // Critical: discovering new areas, entering boss rooms
      if (explorationEvent.action === 'discover') return 'important';
      if (explorationEvent.roomId?.includes('boss')) return 'critical';
      // Important: room transitions
      if (
        explorationEvent.action === 'enter_room' ||
        explorationEvent.action === 'exit_room'
      )
        return 'important';
      // Normal: regular movement
      return 'normal';
    }

    case 'interaction': {
      const interactionEvent = event as InteractionEvent;
      // Critical: successful major interactions (treasure, keys, etc.)
      if (interactionEvent.success && interactionEvent.interaction.includes('treasure'))
        return 'critical';
      if (interactionEvent.success && interactionEvent.interaction.includes('key'))
        return 'critical';
      // Important: successful interactions
      if (interactionEvent.success) return 'important';
      // Normal: failed interactions
      return 'normal';
    }

    case 'system': {
      const systemEvent = event as SystemEvent;
      // Critical: run completion, party wipe, victory
      if (
        systemEvent.message.includes('victory') ||
        systemEvent.message.includes('defeat') ||
        systemEvent.message.includes('complete')
      )
        return 'critical';
      // Important: major state changes
      if (
        systemEvent.message.includes('objective') ||
        systemEvent.message.includes('boss')
      )
        return 'important';
      // Normal: routine system messages
      return 'normal';
    }

    case 'narrative': {
      const narrativeEvent = event as NarrativeEvent;
      // Important: significant narrative moments
      if (narrativeEvent.speakerId) return 'important';
      // Normal: general narrative
      return 'normal';
    }

    default:
      return 'normal';
  }
}

/**
 * Create a key event entry from a game event
 * Used for permanent storage
 */
export function createKeyEventEntry(
  event: GameEvent,
  importance: EventImportance,
  runId?: string,
  agentId?: string
): KeyEventEntry {
  const summary = generateEventSummary(event);

  return {
    id: `key-event-${event.id}`,
    eventId: event.id,
    type: event.type,
    importance,
    actorId: 'actorId' in event ? event.actorId : undefined,
    targetId: 'targetId' in event ? event.targetId : undefined,
    summary,
    payload: (event as unknown) as Record<string, unknown>,
    timestamp: new Date(event.timestamp),
    runId,
    agentId,
  };
}

/**
 * Generate a human-readable summary of an event
 */
function generateEventSummary(event: GameEvent): string {
  switch (event.type) {
    case 'combat': {
      const combatEvent = event as CombatEvent;
      if (combatEvent.action === 'death') {
        return `${combatEvent.actorId} was defeated`;
      }
      if (combatEvent.action === 'attack') {
        const hit = combatEvent.hit ? 'hit' : 'missed';
        const crit = combatEvent.critical ? ' (critical!)' : '';
        return `${combatEvent.actorId} ${hit} ${combatEvent.targetId || 'target'}${crit}`;
      }
      return `${combatEvent.actorId} ${combatEvent.action}`;
    }

    case 'exploration': {
      const explorationEvent = event as ExplorationEvent;
      if (explorationEvent.action === 'discover') {
        return `${explorationEvent.actorId} discovered ${explorationEvent.roomId || 'new area'}`;
      }
      if (explorationEvent.action === 'enter_room') {
        return `${explorationEvent.actorId} entered ${explorationEvent.roomId || 'room'}`;
      }
      return `${explorationEvent.actorId} ${explorationEvent.action}`;
    }

    case 'interaction': {
      const interactionEvent = event as InteractionEvent;
      const result = interactionEvent.success ? 'successfully' : 'failed to';
      return `${interactionEvent.actorId} ${result} ${interactionEvent.interaction}`;
    }

    case 'system': {
      const systemEvent = event as SystemEvent;
      return systemEvent.message;
    }

    case 'narrative': {
      const narrativeEvent = event as NarrativeEvent;
      return narrativeEvent.text;
    }

    default:
      return 'Unknown event';
  }
}

/**
 * Log an event to the detailed log buffer
 */
export function logEvent(
  event: GameEvent,
  context: DetailedLogEntry['context'],
  metadata?: DetailedLogEntry['metadata']
): void {
  const buffer = getDetailedLogBuffer();
  buffer.add(event, context, metadata);
}

/**
 * Filter events by importance for permanent storage
 */
export function shouldStorePermanently(
  event: GameEvent,
  minImportance: EventImportance = 'important'
): boolean {
  const importance = classifyEventImportance(event);
  const importanceLevels: EventImportance[] = ['verbose', 'normal', 'important', 'critical'];
  const eventLevel = importanceLevels.indexOf(importance);
  const minLevel = importanceLevels.indexOf(minImportance);
  return eventLevel >= minLevel;
}

