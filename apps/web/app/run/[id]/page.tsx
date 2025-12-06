'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useParams } from 'next/navigation';
import { PixelButton, PixelPanel, PixelCard } from '../../../components/PixelComponents';
import { LootClaimModal } from '../../../components/LootClaimModal';
import { getUnclaimedLoot, type LootClaim } from '../../../lib/services/lootClaim';
import { Coins } from 'lucide-react';

const PixiMap = dynamic(() => import('../../../components/PixiMap'), {
  ssr: false,
  loading: () => <div className="w-full h-[400px] bg-slate-900 flex items-center justify-center text-white font-pixel">Loading Replay...</div>
});

export default function RunPage() {
  const params = useParams();
  console.log('RunPage params:', params);
  const runId = params?.id as string;
  const [lootClaims, setLootClaims] = useState<LootClaim[]>([]);
  const [showLootModal, setShowLootModal] = useState(false);
  const [loadingLoot, setLoadingLoot] = useState(false);

  // Fetch unclaimed loot
  useEffect(() => {
    const fetchLoot = async () => {
      if (!runId) return;

      setLoadingLoot(true);
      try {
        const claims = await getUnclaimedLoot(runId);
        setLootClaims(claims);
      } catch (error) {
        console.error('Error fetching loot:', error);
      } finally {
        setLoadingLoot(false);
      }
    };

    fetchLoot();
  }, [runId]);

  const handleClaimSuccess = (claimId: string, txHash: string) => {
    // Remove claimed item from list
    setLootClaims((prev) => prev.filter((c) => c.id !== claimId));
    console.log('Loot claimed successfully:', txHash);
  };

  const unclaimedCount = lootClaims.filter((c) => !c.claimed).length;

  // Mock run data
  const run = {
    id: runId,
    status: 'completed',
    result: 'victory',
    startTime: '2023-11-27 10:00:00',
    endTime: '2023-11-27 10:45:00',
    stats: {
      keep: 15,
      xp: 450,
      turns: 124,
    },
    logs: [
      { id: 1, time: '10:00:05', text: 'Party entered the dungeon.' },
      { id: 2, time: '10:05:20', text: 'Gimli attacked Goblin for 12 damage.' },
      { id: 3, time: '10:05:25', text: 'Goblin was defeated!' },
      { id: 4, time: '10:12:00', text: 'Found a chest containing 5 KEEP.' },
      { id: 5, time: '10:45:00', text: 'Boss defeated! Run complete.' },
    ]
  };

  return (
    <main className="min-h-screen bg-[#2a1d17] p-8 flex flex-col items-center gap-8 font-pixel">
      <header className="w-full max-w-6xl flex justify-between items-center mb-4">
        <h1 className="text-4xl text-yellow-400 drop-shadow-[2px_2px_0_rgba(0,0,0,1)] tracking-widest">Run #{runId}</h1>
        <PixelButton variant="neutral" onClick={() => window.location.href = '/'}>Back to Inn</PixelButton>
      </header>

      <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left: Run Stats & Info */}
        <div className="flex flex-col gap-6">
          <PixelPanel title="Status" variant="wood">
            <div className="flex flex-col gap-4">
              <div className={`text-center py-4 text-2xl uppercase tracking-widest drop-shadow-md ${run.result === 'victory' ? 'text-green-400' : 'text-red-400'}`}>
                {run.result}
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm text-[#eaddcf]">
                <div>
                  <div className="text-[#eaddcf]/60 text-xs uppercase">Duration</div>
                  <div>45m 00s</div>
                </div>
                <div>
                  <div className="text-[#eaddcf]/60 text-xs uppercase">Turns</div>
                  <div>{run.stats.turns}</div>
                </div>
                <div>
                  <div className="text-[#eaddcf]/60 text-xs uppercase">KEEP Found</div>
                  <div className="text-yellow-400">{run.stats.keep}</div>
                </div>
                <div>
                  <div className="text-[#eaddcf]/60 text-xs uppercase">XP Gained</div>
                  <div className="text-purple-400">{run.stats.xp}</div>
                </div>
              </div>
            </div>
          </PixelPanel>

          <PixelPanel title="Party" variant="wood">
            <div className="flex flex-col gap-2">
              {['Gimli', 'Legolas', 'Gandalf'].map((name) => (
                <div key={name} className="flex items-center gap-2 p-2 bg-black/20 rounded border border-[#2a1d17]">
                  <div className="w-6 h-6 bg-[#4a3b32] rounded"></div>
                  <span className="text-[#eaddcf] text-sm">{name}</span>
                </div>
              ))}
            </div>
          </PixelPanel>

          {/* Loot Claim Section */}
          {unclaimedCount > 0 && (
            <PixelPanel title="Loot" variant="paper">
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2 text-amber-900 font-bold">
                  <Coins size={20} />
                  <span className="text-sm">
                    {unclaimedCount} unclaimed item{unclaimedCount !== 1 ? 's' : ''}
                  </span>
                </div>
                <PixelButton
                  onClick={() => setShowLootModal(true)}
                  variant="success"
                  className="w-full"
                >
                  Claim Loot
                </PixelButton>
              </div>
            </PixelPanel>
          )}
        </div>

        {/* Center: Replay & Logs */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          <PixelPanel title="Replay" variant="wood">
            <div className="w-full h-[400px] bg-black rounded overflow-hidden relative border-4 border-[#1a120b]">
              <PixiMap width={800} height={400} />
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
                <PixelButton size="sm" variant="neutral">Play Replay</PixelButton>
              </div>
            </div>
          </PixelPanel>

          <PixelPanel title="Event Log" className="flex-1" variant="paper">
            <div className="h-[300px] overflow-y-auto flex flex-col gap-2 font-mono text-sm p-2">
              {run.logs.map((log) => (
                <div key={log.id} className="flex gap-4 p-2 hover:bg-amber-900/10 rounded border-b border-amber-900/10 last:border-0">
                  <span className="text-amber-900/60 shrink-0 text-xs">{log.time}</span>
                  <span className="text-amber-950">{log.text}</span>
                </div>
              ))}
            </div>
          </PixelPanel>
        </div>
      </div>

      {/* Loot Claim Modal */}
      {showLootModal && (
        <LootClaimModal
          claims={lootClaims}
          onClose={() => setShowLootModal(false)}
          onClaimSuccess={handleClaimSuccess}
        />
      )}
    </main>
  );
}
