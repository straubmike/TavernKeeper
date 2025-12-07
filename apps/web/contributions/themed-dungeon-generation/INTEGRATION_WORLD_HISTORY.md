# Integration with World History and Standout Mortals

## Overview

The themed dungeon generator integrates with the world generation system to ensure that standout mortals (heroes, villains, necromancers, etc.) are properly linked to dungeons as part of their entity history, not as separate standalone entities.

## Key Principles

1. **Standout mortals are generated in world generation** with full history (born to organizations, race, etc.)
2. **When a standout mortal becomes a dungeon boss**, it's recorded as an event in their entity history
3. **Necromancer standout mortals create towers** as world events, which then become dungeons
4. **Full history is preserved** - the dungeon generator uses the complete standout mortal data, not simplified versions

## Integration Flow

### 1. World Generation Phase

```
World Generator
  └─> Level 6.5: Standout Mortals Generated
      ├─> Necromancer standout mortals created
      │   └─> World Event: "necromancer built tower" at location X
      │       └─> Event links: necromancer ID → location ID
      │
      └─> Other standout mortals created
          └─> Full history: born to organization, race, powers, etc.
```

### 2. Map Generation Phase

```
Map Generator
  └─> Generate dungeon at location X
      └─> Check world context:
          ├─> Is there a necromancer tower event at location X?
          │   └─> YES: Use necromancer builder, force necromancer-tower theme
          │
          └─> Are there evil standout mortals at location X?
              └─> 40% chance to use one as final boss
```

### 3. Dungeon Generation Phase

```
Themed Dungeon Generator
  └─> generateProvenance(seed, depth, rng, worldContext)
      └─> If necromancer tower event exists:
          ├─> Use NECROMANCER_BUILDER
          ├─> Link to necromancer mortal ID
          └─> Force 'necromancer-tower' theme
  
  └─> generateBosses(seed, depth, age, rng, worldContext, provenance)
      └─> If builderMortalId exists:
          ├─> Use that mortal as final boss
          └─> Record event: "became dungeon boss" in mortal's history
      
      └─> If evil mortals at location:
          ├─> 40% chance to use one as final boss
          └─> Record event: "became dungeon boss" in mortal's history
```

## Data Structures

### DungeonWorldContext

The `DungeonWorldContext` interface includes **FULL** standout mortal data:

```typescript
interface DungeonWorldContext {
  locationId?: string;
  standoutMortals?: Array<{
    id: string;
    name: string;
    standoutType: string;
    location: string;
    race: string; // FULL: Mortal race ID
    organization?: string; // FULL: Organization ID if part of one
    powers: string[];
    level: number;
    age: number;
    alignment?: 'good' | 'neutral' | 'evil';
    isBoss: boolean;
    // Full world content data
    parentId?: string | null; // Parent entity (race, organization, etc.)
    createdAt?: Date; // When they were born/created
    description?: string; // Full description from world generation
    metadata?: Record<string, unknown>; // Additional metadata
  }>;
  worldEvents?: Array<{
    type: string; // e.g., 'built_tower', 'constructed_tower'
    entityId: string; // ID of the entity (e.g., necromancer mortal)
    locationId: string; // Geography ID where event occurred
    description: string;
    year: number;
    metadata?: Record<string, unknown>;
  }>;
  recordEntityEvent?: (entityId: string, event: {...}) => void;
}
```

## Event Recording

When a standout mortal becomes a dungeon boss, an event is recorded in their entity history:

```typescript
worldContext.recordEntityEvent(mortalId, {
  type: 'became_dungeon_boss',
  description: `${mortalName} has taken control of ${dungeonName}, becoming its final boss.`,
  year: calculatedYear,
  relatedEntityId: dungeonId,
  metadata: {
    dungeonName: dungeonName,
    dungeonLevel: level,
    bossType: 'final',
  },
});
```

When a necromancer builds a tower, an event is recorded:

```typescript
worldContext.recordEntityEvent(necromancerId, {
  type: 'built_tower',
  description: `${necromancerName} built a tower for study and experimentation.`,
  year: calculatedYear,
  relatedEntityId: towerLocationId,
  metadata: {
    locationId: locationId,
    purpose: 'necromantic research',
  },
});
```

## Implementation Requirements

### For World Generation System

1. **When generating necromancer standout mortals:**
   - Create a world event: `{ type: 'built_tower', entityId: necromancerId, locationId: locationId }`
   - This event should be stored in the world's event history

2. **Standout mortals must include:**
   - Full `WorldContent` data (id, name, description, parentId, createdAt, etc.)
   - Race ID
   - Organization ID (if applicable)
   - Location (geography ID)
   - Full history metadata

### For Map Generator System

1. **When generating a dungeon:**
   - Query world context for standout mortals at that location
   - Query world events for "built_tower" events at that location
   - Pass full `DungeonWorldContext` to `RichContentGenerator.generateDungeonContent()`

2. **World context should include:**
   - All standout mortals (with full data, not simplified)
   - All world events (especially "built_tower" events)
   - Location ID where dungeon is being created
   - `recordEntityEvent` callback to record events in entity history

### For Themed Dungeon Generator

1. **When generating provenance:**
   - Check for necromancer tower events at the location
   - If found, use `NECROMANCER_BUILDER` and link to necromancer mortal
   - Force `necromancer-tower` theme

2. **When generating bosses:**
   - Use builder mortal as boss if dungeon was built by a standout mortal
   - Check for evil mortals at location (40% chance to use as boss)
   - Record "became dungeon boss" event in mortal's history
   - Preserve full mortal data in boss metadata

3. **Boss conversion:**
   - Preserve full history (organization, race, createdAt, etc.)
   - Build richer descriptions using full mortal data
   - Link boss back to original mortal via `mortalId` in metadata

## Example Flow

### Necromancer Tower Creation

1. **World Generation:**
   - Standout mortal "Malachar the Dark" (necromancer) is generated
   - Born to organization "Dark Cult" in location "Shadowlands"
   - World event created: `{ type: 'built_tower', entityId: 'malachar-id', locationId: 'shadowlands-id' }`

2. **Map Generation:**
   - Dungeon entrance created at location "Shadowlands"
   - Map generator queries: "Are there any 'built_tower' events at Shadowlands?"
   - Finds Malachar's tower event
   - Passes world context to dungeon generator

3. **Dungeon Generation:**
   - `generateProvenance()` detects necromancer tower event
   - Uses `NECROMANCER_BUILDER`
   - Links to Malachar's ID (`builderMortalId: 'malachar-id'`)
   - Forces `necromancer-tower` theme
   - `generateBosses()` uses Malachar as final boss
   - Records event: "Malachar became final boss of his tower"

### Evil Mortal as Dungeon Boss

1. **World Generation:**
   - Standout mortal "Grubnak the Villain" (orc villain) is generated
   - Born to organization "Red Orc Horde" in location "Blood Plains"
   - Full history: became villain after betraying his chieftain

2. **Map Generation:**
   - Dungeon entrance created at location "Blood Plains"
   - Map generator queries: "Are there evil standout mortals at Blood Plains?"
   - Finds Grubnak
   - Passes world context with Grubnak's full data

3. **Dungeon Generation:**
   - `generateBosses()` checks for evil mortals at location
   - 40% chance: Uses Grubnak as final boss
   - Records event: "Grubnak became final boss of dungeon"
   - Boss metadata includes: `{ mortalId: 'grubnak-id', mortalRace: 'orc', mortalOrganization: 'red-orc-horde' }`

## Benefits

1. **Full History Preservation**: Standout mortals retain their complete history (born to organization, race, etc.) when becoming dungeon bosses
2. **Event Tracking**: All boss assignments are recorded as events in entity history
3. **Consistent World**: Dungeons are properly linked to world history
4. **Rich Lore**: Boss descriptions can reference the mortal's full history (organization, race, etc.)
5. **Deterministic**: All generation remains seed-based and deterministic

## Backward Compatibility

If `worldContext` is not provided:
- Dungeon generation falls back to random builder selection
- Bosses are generated normally (not from standout mortals)
- No events are recorded
- System works as before

