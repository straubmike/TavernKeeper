import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const mapId = searchParams.get('id');

    if (!mapId) {
        // Return list of available dungeons
        try {
            const { data: dungeons, error } = await supabase
                .from('dungeons')
                .select('id, seed, map')
                .order('created_at', { ascending: false })
                .limit(100);

            if (error) {
                console.error('Error fetching dungeons:', error);
                return NextResponse.json(
                    { error: 'Failed to fetch dungeons' },
                    { status: 500 }
                );
            }

            const maps = (dungeons || []).map((d: any) => ({
                id: d.id,
                seed: d.seed,
                name: d.map?.name || `Dungeon ${d.seed}`,
            }));

            return NextResponse.json({ maps });
        } catch (error) {
            console.error('Error loading maps:', error);
            return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
        }
    }

    try {
        // Fetch dungeon from database
        const { data: dungeon, error } = await supabase
            .from('dungeons')
            .select('*')
            .eq('id', mapId)
            .single();

        if (error || !dungeon) {
            return NextResponse.json({ error: 'Map not found' }, { status: 404 });
        }

        // Extract map data and convert to the expected format
        const dungeonMap = dungeon.map as any;
        
        // Convert dungeon map structure to the room-based format expected by MapScene
        // The dungeon has a levelLayout, but MapScene expects rooms
        // For now, create a simple room structure based on the dungeon depth
        const rooms: Array<{ id: string; type: 'room' | 'corridor' | 'chamber' | 'boss'; connections: string[] }> = [];
        
        // Create rooms for each level (simplified representation)
        const depth = dungeonMap?.depth || 100;
        const maxRooms = Math.min(depth, 10); // Limit to 10 rooms for visualization
        
        for (let i = 1; i <= maxRooms; i++) {
            const roomId = `room-${i}`;
            const connections: string[] = [];
            
            if (i > 1) {
                connections.push(`room-${i - 1}`);
            }
            if (i < maxRooms) {
                connections.push(`room-${i + 1}`);
            }
            
            let roomType: 'room' | 'corridor' | 'chamber' | 'boss' = 'room';
            if (i === maxRooms) {
                roomType = 'boss';
            } else if (i === Math.floor(maxRooms / 2)) {
                roomType = 'chamber';
            }
            
            rooms.push({
                id: roomId,
                type: roomType,
                connections,
            });
        }

        return NextResponse.json({
            id: dungeon.id,
            name: dungeonMap?.name || `Dungeon ${dungeon.seed}`,
            description: dungeonMap?.description,
            geographyType: dungeonMap?.theme?.name || dungeonMap?.theme?.id || 'unknown',
            rooms,
        });
    } catch (error) {
        console.error('Error loading map:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
