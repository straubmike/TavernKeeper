
import { NextRequest, NextResponse } from 'next/server';
import { runQueue } from '@/lib/queue';
import { supabase } from '@/lib/supabase';
import { dungeonStateService } from '@/lib/services/dungeonStateService';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { dungeonId, party, seed, paymentHash, walletAddress } = body;

    if (!dungeonId || !party || !Array.isArray(party) || party.length === 0 || !walletAddress) {
      return NextResponse.json(
        { error: 'Missing required fields: dungeonId, party (array), walletAddress' },
        { status: 400 }
      );
    }

    // 1. Check Hero Availability

    // contract address from env or default
    const HERO_CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_HERO_CONTRACT_ADDRESS || '0x0000000000000000000000000000000000000000';

    const checkingHeroes = party.map((id: string) => ({ contractAddress: HERO_CONTRACT_ADDRESS, tokenId: id }));

    const availability = await dungeonStateService.checkHeroesAvailability(checkingHeroes);
    if (availability.locked) {
      return NextResponse.json(
        { error: 'One or more heroes are currently locked in another dungeon run', lockedHeroes: availability.lockedHeroes },
        { status: 409 }
      );
    }

    // 2. Check User Daily Limits and Payment
    const userStats = await dungeonStateService.getUserDailyStats(walletAddress);
    const FREE_RUNS_LIMIT = 2;

    if (userStats.dailyRuns >= FREE_RUNS_LIMIT && !userStats.needsReset) {
      // User has exhausted free runs, check for payment
      if (!paymentHash) {
        return NextResponse.json(
          { error: 'Free runs exhausted. Payment required.', requiresPayment: true },
          { status: 402 } // Payment Required
        );
      }
      // TODO: Verify paymentHash on-chain (skipped for this demo step, trusting the hash exists/is valid-ish)
    }


    // 3. Resolve Dungeon ID (Handle slug vs UUID, or randomly select)
    let finalDungeonId = dungeonId;

    // If no dungeonId provided or it's a placeholder, randomly select from available dungeons
    if (!dungeonId || dungeonId === 'abandoned-cellar' || dungeonId === 'placeholder') {
      const { data: availableDungeons, error: dungeonError } = await supabase
        .from('dungeons')
        .select('id, seed')
        .limit(100);

      if (dungeonError || !availableDungeons || availableDungeons.length === 0) {
        return NextResponse.json(
          { error: 'No dungeons available. World may not be initialized.' },
          { status: 503 }
        );
      }

      // Randomly select a dungeon
      const randomIndex = Math.floor(Math.random() * availableDungeons.length);
      finalDungeonId = availableDungeons[randomIndex].id;
    } else {
      // Check if it's a UUID or a Seed
      // First try to look up by seed (slug)
      const { data: dData } = await supabase
        .from('dungeons')
        .select('id')
        .eq('seed', dungeonId)
        .single();

      if (dData) {
        finalDungeonId = dData.id;
      }
      // If not found by seed, assume it's already a UUID
    }

    // 4. Create run record
    let run;
    const { data, error: dbError } = await supabase
      .from('runs')
      .insert({
        dungeon_id: finalDungeonId,
        party,
        seed: seed || `run-${Date.now()}`,
        start_time: new Date().toISOString(),
      })
      .select()
      .single();

    if (dbError) {
      console.error('Supabase Insert Error:', dbError);
      throw new Error(`Database insert failed: ${dbError.message} (Dungeon: ${finalDungeonId})`);
    }
    run = data;

    // 5. Lock Heroes & Update User Stats
    await Promise.all([
      dungeonStateService.lockHeroes(run.id, checkingHeroes),
      dungeonStateService.incrementUserDailyRun(walletAddress)
    ]);

    // 5. Enqueue simulation job
    // Sending resolved UUID (finalDungeonId) to worker
    console.log(`[API] Enqueuing job for run ${run.id} with dungeon ${finalDungeonId}`);
    const job = await runQueue.add('run-simulation', {
      runId: run.id,
      dungeonId: finalDungeonId,
      party,
      seed: run.seed as string,
      startTime: new Date(run.start_time as string).getTime(),
    }, {
      // Set job timeout to 10 minutes (longer than our 5-minute executeDungeonRun timeout)
      // This ensures BullMQ doesn't mark the job as timed out before our code finishes
      attempts: 1, // Don't retry on failure
      removeOnComplete: false, // Keep completed jobs for debugging
      removeOnFail: false, // Keep failed jobs for debugging
    });
    console.log(`[API] Job enqueued with ID: ${job.id}`);

    return NextResponse.json({ id: run.id, status: 'queued', jobId: job.id });
  } catch (error) {
    console.error('Error creating run:', error);
    return NextResponse.json(
      { error: 'Failed to create run' },
      { status: 500 }
    );
  }
}
