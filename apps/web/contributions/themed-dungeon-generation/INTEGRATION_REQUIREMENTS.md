# Integration Requirements for World History Integration

## Summary

The themed dungeon generator has been updated to support full integration with world history. However, the **map generator** and **world generator** need to be updated to complete the integration.

## What Has Been Done

✅ **Themed Dungeon Generator:**
- Expanded `DungeonWorldContext` to include full standout mortal data (race, organization, createdAt, etc.)
- Updated `convertStandoutMortalToBoss()` to preserve full history and link to original mortal
- Added event recording when standout mortals become dungeon bosses
- Added event recording when a mortal builds a dungeon
- Created integration documentation

## What Needs to Be Done

### 1. World Generator System

**Location:** `apps/web/contributions/world-generation-system/code/generators/standout-generator.ts`

**Required Changes:**

1. **When generating necromancer standout mortals**, create a world event:
   ```typescript
   // After creating a necromancer standout mortal:
   if (type === 'necromancer') {
     // Create world event: "necromancer built tower"
     const towerEvent = {
       type: 'built_tower',
       entityId: standoutMortal.id,
       locationId: locationId,
       description: `${standoutMortal.name} built a tower for study and experimentation.`,
       year: notableYear, // Year when they became notable
       metadata: {
         purpose: 'necromantic research',
       },
     };
     // Add to world events (need to determine where world events are stored)
   }
   ```

2. **Ensure standout mortals include full WorldContent data:**
   - Already includes: `id`, `name`, `description`, `parentId`, `createdAt`, `discoveredAt`
   - Already includes: `race`, `organization`, `location`, `powers`, `level`, `age`, `alignment`
   - ✅ This is already correct

### 2. ~~Map Generator System~~ (REMOVED)

**Status:** The map-generator-system has been deleted. Dungeon generation now happens directly through the world-generation-system (Level 7.5) and themed-dungeon-generation systems.

### 3. World Event Storage

**Question:** Where are world events stored?

The world generator needs to:
1. Store world events (like "necromancer built tower") somewhere accessible
2. Make them queryable by location ID
3. Ensure they're passed to the map generator

**Possible Solutions:**
- Add `worldEvents` array to `GeneratedWorld` interface
- Store in `WorldManager` or similar
- Add to `GenerationContext` and pass through

### 4. Entity History Recording

**Question:** How is entity history stored?

The `recordEntityEvent` callback needs to:
1. Update the standout mortal's entity history
2. Store events like "became dungeon boss" or "built dungeon"
3. Make them queryable later

**Possible Solutions:**
- Use `WorldManager.addEventToEntity()` or similar
- Store in entity metadata
- Add to provenance/history system

## Integration Checklist

### World Generator
- [ ] Create world events when necromancer standout mortals are generated
- [ ] Store world events in accessible location (GeneratedWorld or WorldManager)
- [ ] Ensure standout mortals include full WorldContent data (✅ already done)

### Map Generator
- [x] ~~Map generator removed - integration now handled directly by world-generation-system~~

### Testing
- [ ] Verify necromancer towers use necromancer builder and theme
- [ ] Verify evil mortals can become dungeon bosses
- [ ] Verify boss metadata includes full mortal data (race, organization, etc.)
- [ ] Verify events are recorded in entity history
- [ ] Verify dungeon provenance links to world history

## Example Integration Flow

```
1. World Generation:
   - Generate standout mortal "Malachar" (necromancer)
   - Born to organization "Dark Cult" in location "Shadowlands"
   - Create world event: { type: 'built_tower', entityId: 'malachar-id', locationId: 'shadowlands-id' }
   - Store in worldGenerator.worldEvents[]

2. Map Generation:
   - Generate dungeon at location "Shadowlands"
   - Query: worldGenerator.worldEvents.filter(e => e.locationId === 'shadowlands-id')
   - Find: Malachar's tower event
   - Query: worldGenerator.standoutMortals.filter(m => m.location === 'shadowlands-id')
   - Find: Malachar with full data (race, organization, etc.)
   - Create worldContext with full data

3. Dungeon Generation:
   - generateProvenance() detects necromancer tower event
   - Uses NECROMANCER_BUILDER, links to Malachar
   - generateBosses() uses Malachar as final boss
   - Records event: "Malachar became final boss of his tower"
   - Boss metadata includes: { mortalId: 'malachar-id', mortalRace: 'human', mortalOrganization: 'dark-cult' }
```

## Notes

- The themed dungeon generator is **backward compatible** - if `worldContext` is not provided, it works as before
- All generation remains **deterministic** and **seed-based**
- The integration is **optional** - dungeons can still be generated without world context

