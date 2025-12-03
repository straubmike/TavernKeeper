import type { Action, AgentMemory, AgentPersona } from '@innkeeper/lib';

/**
 * ElizaOS agent configuration
 * This interface matches what ElizaOS expects for agent setup
 */
export interface ElizaAgentConfig {
  id: string;
  name: string;
  persona: AgentPersona;
  memory: AgentMemory;
  plugins: string[];
  hooks?: {
    onRunStart?: (runId: string) => Promise<void>;
    onTurn?: (turnNumber: number, events: unknown[]) => Promise<Action | null>;
    onRunEnd?: (runId: string, result: string) => Promise<void>;
  };
}

/**
 * Game action plugin interface
 * Agents use this to submit actions to the engine
 */
export interface GameActionPlugin {
  name: 'game-action-plugin';
  submitAction(agentId: string, action: Action): Promise<{ success: boolean; events?: unknown[] }>;
}

/**
 * Memory plugin interface
 * Handles persistent memory reads/writes
 */
export interface MemoryPlugin {
  name: 'memory-plugin';
  readMemory(agentId: string): Promise<AgentMemory>;
  writeMemory(agentId: string, memory: AgentMemory): Promise<void>;
  updateShortTerm(agentId: string, eventId: string): Promise<void>;
  addEpisodic(agentId: string, runId: string, summary: string): Promise<void>;
  updateMemory?(agentId: string, memoryUpdate: {
    shortTerm?: Array<{ eventId: string; timestamp: number }>;
    episodic?: Array<{ runId: string; summary: string }>;
    longTerm?: {
      reputations?: Record<string, number>;
      lore?: string[];
      relationships?: Record<string, string>;
    };
  }): Promise<void>;
}

/**
 * DM plugin interface
 * Restricted toolset for generating room descriptions
 */
export interface DMPlugin {
  name: 'dm-plugin';
  generateRoomDescription(roomId: string, context: unknown): Promise<string>;
  generateEventDescription(event: unknown): Promise<string>;
}

export type Plugin = GameActionPlugin | MemoryPlugin | DMPlugin;

