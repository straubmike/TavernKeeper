import { supabase } from '@/lib/supabase';

export interface HeroState {
    contractAddress: string;
    tokenId: string;
    status: 'idle' | 'dungeon';
    lockedUntil?: string;
    currentRunId?: string;
}

export const dungeonStateService = {
    /**
     * Check if a list of heroes are available (not locked)
     * Returns list of locked heroes if any
     */
    async checkHeroesAvailability(heroes: { contractAddress: string; tokenId: string }[]): Promise<{ locked: boolean; lockedHeroes: HeroState[] }> {
        if (heroes.length === 0) return { locked: false, lockedHeroes: [] };

        // We need to construct a query to find any of these heroes that are locked
        const now = new Date().toISOString();

        // It's easier to fetch states for all these heroes and check in code
        // Or specific query: status = 'dungeon' AND locked_until > now

        // Supabase/Postgrest doesn't support complex OR lists easily in one filtered GET for composite keys without RPC.
        // We'll just fetch all states that match any of the token IDs (assuming one contract for now or filtering client side).
        // Since we likely have one main hero contract, we can just filter by token_id list.
        const tokenIds = heroes.map(h => h.tokenId);

        const { data, error } = await supabase
            .from('hero_states')
            .select('*')
            .eq('status', 'dungeon')
            .in('token_id', tokenIds)
            .gt('locked_until', now);

        if (error) {
            console.warn('Error checking hero availability (ignoring to allow test run):', error.message);
            // If table missing/error, assume available
            return { locked: false, lockedHeroes: [] };
        }

        if (!data || data.length === 0) {
            return { locked: false, lockedHeroes: [] };
        }

        // Map response to HeroState
        const lockedHeroes: HeroState[] = data.map((row: any) => ({
            contractAddress: row.contract_address,
            tokenId: row.token_id,
            status: row.status,
            lockedUntil: row.locked_until,
            currentRunId: row.current_run_id
        }));

        return { locked: true, lockedHeroes };
    },

    /**
     * Check user's daily run count
     */
    async getUserDailyStats(walletAddress: string) {
        // UNLIMITED FREE RUNS FOR TESTING
        return { dailyRuns: 0, lastReset: new Date().toISOString(), needsReset: false };
    },

    /**
     * Lock heroes for a run
     */
    async lockHeroes(runId: string, heroes: { contractAddress: string; tokenId: string }[]) {
        if (heroes.length === 0) return;

        const now = new Date();
        const lockedUntil = new Date(now.getTime() + 6 * 60 * 60 * 1000); // 6 hours

        const upsertData = heroes.map(h => ({
            contract_address: h.contractAddress,
            token_id: h.tokenId,
            status: 'dungeon',
            locked_until: lockedUntil.toISOString(),
            current_run_id: runId,
            updated_at: now.toISOString()
        }));

        const { error } = await supabase
            .from('hero_states')
            .upsert(upsertData);

        if (error) {
            console.warn('Error locking heroes (ignoring):', error.message);
            // Don't throw, just log and continue
        }
    },

    /**
     * Unlock heroes after a run completes or fails
     */
    async unlockHeroes(heroes: { contractAddress: string; tokenId: string }[]) {
        if (heroes.length === 0) return;

        const now = new Date().toISOString();
        const tokenIds = heroes.map(h => h.tokenId);

        // Update hero states to idle
        const { error } = await supabase
            .from('hero_states')
            .update({
                status: 'idle',
                locked_until: null,
                current_run_id: null,
                updated_at: now
            })
            .in('token_id', tokenIds);

        if (error) {
            console.warn('Error unlocking heroes (ignoring):', error.message);
            // Don't throw, just log and continue
        }
    },

    /**
     * Increment user daily run count
     */
    async incrementUserDailyRun(walletAddress: string) {
        const stats = await this.getUserDailyStats(walletAddress); // Check logic again to get current state

        let newCount = stats.dailyRuns + 1;
        let newResetTime = stats.lastReset;

        if (stats.needsReset) {
            newCount = 1;
            newResetTime = new Date().toISOString();
        } else if (stats.dailyRuns === 0 && !stats.lastReset) {
            // First run ever
            newResetTime = new Date().toISOString();
        }

        const { error } = await supabase
            .from('user_dungeon_stats')
            .upsert({
                wallet_address: walletAddress,
                daily_runs_count: newCount,
                last_reset_time: newResetTime
            });

        if (error) {
            console.warn('Error updating user stats (ignoring):', error.message);
            // Don't throw
        }
    }
};
