import { WorldGenerator } from '../../contributions/world-generation-system/code/generators/world-generator';
import { WorldContentService } from './content/services/worldContentService';
import { useGameStore } from '../stores/gameStore';
import type { Geography } from './generation/types/world-generation';
import type { WorldContentEntry } from './content/types/world-content';

export class WorldService {
    private worldGenerator: WorldGenerator;
    private worldContentService: WorldContentService;

    constructor() {
        this.worldGenerator = new WorldGenerator();
        this.worldContentService = new WorldContentService();
    }

    /**
     * Generate a new world and update the game store
     */
    async generateAndStoreWorld(seed: string): Promise<void> {
        console.log(`Generating world with seed: ${seed}`);

        // 1. Generate the world (geography, etc.)
        const generatedWorld = await this.worldGenerator.generateWorld({
            seed,
            includeLevels: [2.5], // Focus on geography for now
            depth: 'partial',
        });

        const maps = generatedWorld.geography;
        console.log(`Generated ${maps.length} maps`);

        // 2. Generate initial items based on geography
        const items: WorldContentEntry[] = [];

        for (const map of maps) {
            // Generate resources for each map
            const resources = await this.generateResourcesForMap(map, seed);
            items.push(...resources);
        }

        console.log(`Generated ${items.length} items`);

        // 3. Update Game Store
        useGameStore.getState().setMaps(maps);
        useGameStore.getState().setItems(items);
    }

    /**
     * Generate resources (items) for a specific map
     */
    private async generateResourcesForMap(map: Geography, seed: string): Promise<WorldContentEntry[]> {
        const items: WorldContentEntry[] = [];
        const resourceCount = 5; // Generate 5 resources per map for now

        for (let i = 0; i < resourceCount; i++) {
            const itemSeed = `${seed}-${map.id}-${i}`;

            // Determine resource type based on geography type
            let material = 'wood';
            let type = 'resource';
            let name = 'Unknown Resource';

            if (map.geographyType === 'forest') {
                material = 'wood';
                name = 'Elder Wood Log';
            } else if (map.geographyType === 'mountain_range') {
                material = 'stone';
                name = 'Granite Chunk';
            } else if (map.geographyType === 'island') {
                material = 'sand';
                name = 'Star Sand';
            }

            const item = await this.worldContentService.createItemContent({
                itemId: `item-${itemSeed}`,
                itemSeed,
                name: `${name} ${i + 1}`,
                type,
                rarity: 'common',
                foundIn: map.id,
                material,
            });

            items.push(item);
        }

        return items;
    }

    /**
     * Load static demo world content
     */
    async loadDemoWorld(): Promise<void> {
        console.log('Loading demo world...');
        const { DEMO_MAPS, DEMO_ITEMS } = await import('./demo-content');

        useGameStore.getState().setMaps(DEMO_MAPS);
        useGameStore.getState().setItems(DEMO_ITEMS);
        console.log(`Loaded ${DEMO_MAPS.length} demo maps and ${DEMO_ITEMS.length} demo items.`);
    }
}

export const worldService = new WorldService();
