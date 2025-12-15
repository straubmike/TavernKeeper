import { CONTRACT_REGISTRY, getContractAddress } from '../contracts/registry';
import { supabase } from '../supabase';

export interface Party {
    id: string;
    owner_id: string;
    dungeon_id: string | null;
    status: 'waiting' | 'ready' | 'in_progress' | 'completed' | 'cancelled';
    max_members: number;
    invite_code?: string;
    created_at: string;
    updated_at: string;
}

export interface PartyMember {
    id: string;
    party_id: string;
    user_id: string;
    hero_token_id: string;
    hero_contract_address: string;
    joined_at: string;
}

export async function createParty(
    ownerId: string,
    dungeonId?: string,
    initialHeroTokenIds?: string[]
): Promise<Party | null> {
    // Get Adventurer contract address from registry
    const heroContractAddress = getContractAddress(CONTRACT_REGISTRY.ADVENTURER);
    if (!heroContractAddress) {
        console.error('Adventurer contract address not configured');
        return null;
    }
    const { data, error } = await supabase
        .from('parties')
        .insert({
            owner_id: ownerId,
            dungeon_id: dungeonId,
            status: 'waiting',
            max_members: 5,
        })
        .select()
        .single();

    if (error) {
        console.error('Error creating party:', error);
        return null;
    }

    if (!data || Array.isArray(data)) {
        console.error('Party creation returned invalid data');
        return null;
    }

    const party = data as Party;

    // Add initial members if provided
    if (initialHeroTokenIds && initialHeroTokenIds.length > 0) {
        const memberInserts = initialHeroTokenIds.map(tokenId => ({
            party_id: party.id,
            user_id: ownerId,
            hero_token_id: tokenId,
            hero_contract_address: heroContractAddress,
        }));

        const { error: membersError } = await supabase
            .from('party_members')
            .insert(memberInserts);

        if (membersError) {
            console.error('Error adding initial members:', membersError);
            // Party created but members failed - still return party
        }
    }

    return party as Party | null;
}

export async function getParty(partyId: string): Promise<Party | null> {
    const { data, error } = await supabase
        .from<Party>('parties')
        .select('*')
        .eq('id', partyId)
        .single();

    if (error) {
        console.error('Error getting party:', error);
        return null;
    }
    return data as Party | null;
}

export async function getUserParties(userId: string): Promise<Party[]> {
    const { data, error } = await supabase
        .from<Party>('parties')
        .select('*')
        .eq('owner_id', userId)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error getting user parties:', error);
        return [];
    }
    return (data as Party[]) || [];
}

export async function getPartyMembers(partyId: string): Promise<PartyMember[]> {
    const { data, error } = await supabase
        .from<PartyMember>('party_members')
        .select('*')
        .eq('party_id', partyId);

    if (error) {
        console.error('Error getting party members:', error);
        return [];
    }
    // data can be null if no rows found or error, but we handled error.
    // Supabase returns null for empty list sometimes? No, usually empty array.
    // But our types say data: T | null. If T is PartyMember[], then data is PartyMember[] | null.
    return (data as PartyMember[]) || [];
}

export async function generateInviteCode(partyId: string, userId: string): Promise<string | null> {
    // Generate random 8 char code
    const code = Math.random().toString(36).substring(2, 10).toUpperCase();

    const { data, error } = await supabase
        .from('party_invites')
        .insert({
            party_id: partyId,
            code: code,
            created_by: userId,
            expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24h
        })
        .select('code')
        .single();

    if (error) {
        console.error('Error generating invite:', error);
        return null;
    }
    // data is { code: string }
    return (data as any)?.code || null;
}

export async function joinParty(
    partyId: string,
    userId: string,
    heroTokenId: string,
    heroContract: string
): Promise<{ success: boolean; autoStarted?: boolean; runId?: string }> {
    // Check if party exists and is not full
    const party = await getParty(partyId);
    if (!party) return { success: false };

    if (party.status !== 'waiting') {
        return { success: false }; // Party already started or cancelled
    }

    const members = await getPartyMembers(partyId);
    if (members.length >= party.max_members) return { success: false };

    // Add member
    const { error } = await supabase
        .from('party_members')
        .insert({
            party_id: partyId,
            user_id: userId,
            hero_token_id: heroTokenId,
            hero_contract_address: heroContract,
        });

    if (error) {
        console.error('Error joining party:', error);
        return { success: false };
    }

    // Check if party is now full (5 members) and auto-start
    const updatedMembers = await getPartyMembers(partyId);
    if (updatedMembers.length >= 5 && party.dungeon_id) {
        // Auto-start the run
        const allTokenIds = updatedMembers.map(m => m.hero_token_id);

        // Create run
        const { runQueue } = await import('../queue');
        const { supabase: supabaseClient } = await import('../supabase');

        const { data: run, error: runError } = await supabaseClient
            .from('runs')
            .insert({
                dungeon_id: party.dungeon_id,
                party: allTokenIds,
                seed: `party-${partyId}-${Date.now()}`,
                start_time: new Date().toISOString(),
            })
            .select()
            .single();

        if (!runError && run) {
            // Enqueue simulation
            await runQueue.add('run-simulation', {
                runId: run.id,
                dungeonId: party.dungeon_id,
                party: allTokenIds,
                seed: run.seed as string,
                startTime: new Date(run.start_time as string).getTime(),
            });

            // Update party status and store run ID
            await updateParty(partyId, {
                status: 'in_progress',
                // Store run_id in a metadata field if available, or we'll fetch it separately
            });

            return { success: true, autoStarted: true, runId: run.id };
        }
    }

    return { success: true };
}

export async function leaveParty(partyId: string, userId: string): Promise<boolean> {
    const { error } = await supabase
        .from('party_members')
        .delete()
        .eq('party_id', partyId)
        .eq('user_id', userId);

    if (error) {
        console.error('Error leaving party:', error);
        return false;
    }
    return true;
}

export async function startRun(partyId: string, dungeonId: string): Promise<boolean> {
    // Update party status
    const { error } = await supabase
        .from('parties')
        .update({
            status: 'in_progress',
            dungeon_id: dungeonId,
        })
        .eq('id', partyId);

    if (error) {
        console.error('Error starting run:', error);
        return false;
    }

    return true;
}

export async function updateParty(partyId: string, updates: Partial<Party>): Promise<boolean> {
    const { error } = await supabase
        .from('parties')
        .update(updates)
        .eq('id', partyId);

    if (error) {
        console.error('Error updating party:', error);
        return false;
    }
    return true;
}

export async function deleteParty(partyId: string): Promise<boolean> {
    const { error } = await supabase
        .from('parties')
        .delete()
        .eq('id', partyId);

    if (error) {
        console.error('Error deleting party:', error);
        return false;
    }
    return true;
}
