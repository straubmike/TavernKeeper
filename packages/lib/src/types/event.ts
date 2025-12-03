export type EventType = 'combat' | 'exploration' | 'interaction' | 'system' | 'narrative';

export interface BaseEvent {
  type: EventType;
  id: string;
  timestamp: number;
}

export interface CombatEvent extends BaseEvent {
  type: 'combat';
  actorId: string;
  targetId?: string;
  action: 'attack' | 'damage' | 'death' | 'heal';
  roll?: number;
  damage?: number;
  hit?: boolean;
  critical?: boolean;
}

export interface ExplorationEvent extends BaseEvent {
  type: 'exploration';
  actorId: string;
  action: 'move' | 'discover' | 'enter_room' | 'exit_room' | 'level_transition';
  location?: { x: number; y: number; z?: number };
  roomId?: string;
  fromLevelZ?: number;
  toLevelZ?: number;
}

export interface InteractionEvent extends BaseEvent {
  type: 'interaction';
  actorId: string;
  targetId: string;
  interaction: string;
  success: boolean;
  result?: unknown;
}

export interface SystemEvent extends BaseEvent {
  type: 'system';
  message: string;
  data?: Record<string, unknown>;
}

export interface NarrativeEvent extends BaseEvent {
  type: 'narrative';
  text: string;
  speakerId?: string;
}

export type GameEvent = CombatEvent | ExplorationEvent | InteractionEvent | SystemEvent | NarrativeEvent;

export interface Turn {
  number: number;
  initiative: Array<{ entityId: string; initiative: number }>;
  actions: Array<{ entityId: string; action: string }>;
  events: GameEvent[];
}

