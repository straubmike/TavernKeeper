# Map Generator System - DELETED

**Status:** This system has been deleted as of [current date].

## Reason for Deletion

The `map-generator-system` has been removed because:

1. **Redundant Functionality:**
   - Dungeon generation is handled by `world-generation-system` (Level 7.5) and `themed-dungeon-generation`
   - Rich content/lore is handled by `world-content-hierarchy`
   - Geography and organizations are handled by `world-generation-system`

2. **Not Needed:**
   - The game doesn't have a 2D grid map system
   - Geography and organizations exist as event/lore entries, not spatial coordinates

3. **Broken References:**
   - API routes referenced `MapStorage` which didn't exist
   - System was partially implemented and unused

## Systems That Replace It

- **Dungeon Generation:** `world-generation-system/code/generators/dungeon-generator.ts`
- **Themed Dungeons:** `themed-dungeon-generation`
- **Provenance/Lore:** `world-content-hierarchy`
- **Geography/Organizations:** `world-generation-system`

## Files Deleted

- `apps/web/contributions/map-generator-system/` (entire directory)
- `apps/web/app/api/map/generate/route.ts`
- `apps/web/app/api/map/explore/route.ts`
- `apps/web/app/api/map/dungeon/route.ts`
- `apps/web/app/api/map/cell/route.ts`

## Integration Docs Updated

- `themed-dungeon-generation/README.md` - Removed map-generator-system references
- `tools/master-generator/README.md` - Removed map-generator-system references

## Notes

- Integration docs in `themed-dungeon-generation/INTEGRATION_MAP_GENERATOR.md` and `INTEGRATION_REQUIREMENTS.md` still reference this system but are now outdated. They should be updated or removed if the integration patterns are no longer relevant.