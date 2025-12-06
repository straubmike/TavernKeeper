'use client';

import { usePrivy } from '@privy-io/react-auth';
import { useEffect, useState } from 'react';
import NFTMetadataUpdater from '../../components/NFTMetadataUpdater';
import { PixelButton, PixelCard, PixelPanel } from '../../components/PixelComponents';
import { useSafeAccount } from '../../lib/hooks/useSafeAccount';
import RecruitHeroView from '../../components/RecruitHeroView';
import TavernKeeperBuilder from '../../components/TavernKeeperBuilder';
import { HeroNFT, rpgService, TavernKeeperNFT } from '../../lib/services/rpgService';
import { isInFarcasterMiniapp } from '../../lib/utils/farcasterDetection';

export default function PartyPage() {
  const isMiniapp = isInFarcasterMiniapp();
  const privy = usePrivy();
  const { address, authenticated } = useSafeAccount();

  const [tavernKeepers, setTavernKeepers] = useState<TavernKeeperNFT[]>([]);
  const [selectedKeeper, setSelectedKeeper] = useState<TavernKeeperNFT | null>(null);
  const [heroes, setHeroes] = useState<HeroNFT[]>([]);

  const [loading, setLoading] = useState(true);
  const [loadingHeroes, setLoadingHeroes] = useState(false);
  const [viewMode, setViewMode] = useState<'dashboard' | 'recruit'>('dashboard');

  // Metadata updater state
  const [updatingHero, setUpdatingHero] = useState<HeroNFT | null>(null);
  const [updatingKeeper, setUpdatingKeeper] = useState<{ keeper: TavernKeeperNFT; metadataUri: string } | null>(null);

  const handleUpdateKeeper = async (keeper: TavernKeeperNFT) => {
    try {
      // Fetch tokenURI for the keeper
      const metadataUri = await rpgService.getTavernKeeperTokenURI(keeper.tokenId);
      setUpdatingKeeper({ keeper, metadataUri });
    } catch (error) {
      console.error('Failed to fetch keeper metadata URI:', error);
    }
  };

  // Fetch Tavern Keepers on load
  useEffect(() => {
    if (authenticated && address) {
      fetchKeepers();
    } else if (!authenticated) {
      setLoading(false);
    }
  }, [authenticated, address]);

  // Fetch Heroes when a Keeper is selected
  useEffect(() => {
    if (selectedKeeper) {
      fetchHeroes(selectedKeeper.tbaAddress);
    } else {
      setHeroes([]);
    }
  }, [selectedKeeper]);

  const fetchKeepers = async () => {
    if (!address) return;
    setLoading(true);
    try {
      const keepers = await rpgService.getUserTavernKeepers(address);
      setTavernKeepers(keepers);
      if (keepers.length > 0 && !selectedKeeper) {
        setSelectedKeeper(keepers[0]);
      }
    } catch (e) {
      console.error("Failed to fetch keepers", e);
    } finally {
      setLoading(false);
    }
  };

  const fetchHeroes = async (tbaAddress: string) => {
    setLoadingHeroes(true);
    try {
      const heroList = await rpgService.getHeroes(tbaAddress);
      setHeroes(heroList);
    } catch (e) {
      console.error("Failed to fetch heroes", e);
    } finally {
      setLoadingHeroes(false);
    }
  };

  const handleRecruitSuccess = () => {
    setViewMode('dashboard');
    if (selectedKeeper) {
      fetchHeroes(selectedKeeper.tbaAddress);
    }
  };

  const handleMintSuccess = () => {
    fetchKeepers();
  };

  if (!authenticated) {
    return (
      <main className="min-h-full bg-[#2a1d17] p-8 flex items-center justify-center font-pixel">
        <PixelPanel title="Access Denied" variant="wood" className="max-w-md text-center">
          <p className="text-[#eaddcf] mb-4">Please connect your wallet to access the Party Manager.</p>
        </PixelPanel>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="min-h-full bg-[#2a1d17] p-8 flex items-center justify-center font-pixel">
        <div className="text-yellow-400 animate-pulse">Loading Tavern Data...</div>
      </main>
    );
  }

  // 1. New User Flow: Mint Tavern Keeper
  if (tavernKeepers.length === 0) {
    return <TavernKeeperBuilder onSuccess={handleMintSuccess} />;
  }

  // 2. Recruit Flow
  if (viewMode === 'recruit' && selectedKeeper) {
    return (
      <RecruitHeroView
        tbaAddress={selectedKeeper.tbaAddress}
        onSuccess={handleRecruitSuccess}
        onCancel={() => setViewMode('dashboard')}
      />
    );
  }

  // 3. Dashboard Flow
  return (
    <main className="min-h-full bg-[#2a1d17] p-4 md:p-8 font-pixel">
      {/* Metadata Updater Modals */}
      {updatingHero && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <NFTMetadataUpdater
            tokenId={updatingHero.tokenId}
            tokenUri={updatingHero.metadataUri}
            contractType="hero"
            onSuccess={() => {
              setUpdatingHero(null);
              if (selectedKeeper) {
                fetchHeroes(selectedKeeper.tbaAddress);
              }
            }}
            onCancel={() => setUpdatingHero(null)}
          />
        </div>
      )}
      {updatingKeeper && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <NFTMetadataUpdater
            tokenId={updatingKeeper.keeper.tokenId}
            tokenUri={updatingKeeper.metadataUri}
            contractType="tavernKeeper"
            onSuccess={() => {
              setUpdatingKeeper(null);
              fetchKeepers();
            }}
            onCancel={() => setUpdatingKeeper(null)}
          />
        </div>
      )}

      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Sidebar: Keeper Selection */}
        <div className="lg:col-span-4 space-y-6">
          <PixelCard variant="wood">
            <h2 className="text-xl text-[#eaddcf] mb-4">Your Taverns</h2>
            <div className="space-y-4">
              {tavernKeepers.map(keeper => (
                <div
                  key={keeper.tokenId}
                  className={`p-4 border-2 transition-all ${selectedKeeper?.tokenId === keeper.tokenId
                    ? 'border-yellow-400 bg-[#4a3b2a]'
                    : 'border-[#4a3b2a] hover:border-yellow-400/50'
                    }`}
                >
                  <div
                    onClick={() => setSelectedKeeper(keeper)}
                    className="cursor-pointer"
                  >
                    <div className="text-[#eaddcf]">Tavern #{keeper.tokenId}</div>
                    <div className="text-xs text-[#8b7355] truncate">{keeper.tbaAddress}</div>
                  </div>
                  <div className="mt-2">
                    <PixelButton
                      size="sm"
                      variant="neutral"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleUpdateKeeper(keeper);
                      }}
                    >
                      Update
                    </PixelButton>
                  </div>
                </div>
              ))}
            </div>
          </PixelCard>
        </div>

        {/* Main Content: Keeper Details & Heroes */}
        <div className="lg:col-span-8">
          {selectedKeeper ? (
            <div className="space-y-6">
              <PixelPanel title={`Tavern #${selectedKeeper.tokenId}`} variant="wood">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <div className="text-sm text-[#8b7355]">Vault Address</div>
                    <div className="text-[#eaddcf] font-mono text-sm">{selectedKeeper.tbaAddress}</div>
                  </div>
                  <PixelButton onClick={() => setViewMode('recruit')}>
                    Recruit Hero
                  </PixelButton>
                </div>

                <h3 className="text-lg text-[#eaddcf] mb-4">Roster</h3>
                {loadingHeroes ? (
                  <div className="text-center text-[#8b7355] py-8">Loading heroes...</div>
                ) : heroes.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {heroes.map(hero => (
                      <PixelCard key={hero.tokenId} variant="default" className="bg-[#1a120d]">
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex-1">
                            <div className="text-[#eaddcf]">Hero #{hero.tokenId}</div>
                            <div className="text-xs text-[#8b7355] truncate" title={hero.metadataUri}>
                              {hero.metadataUri}
                            </div>
                          </div>
                          <PixelButton
                            size="sm"
                            variant="neutral"
                            onClick={() => setUpdatingHero(hero)}
                          >
                            Update
                          </PixelButton>
                        </div>
                      </PixelCard>
                    ))}
                  </div>
                ) : (
                  <div className="text-center text-[#8b7355] py-8 italic border-2 border-dashed border-[#4a3b2a] rounded">
                    No heroes in this tavern yet.
                  </div>
                )}
              </PixelPanel>
            </div>
          ) : (
            <div className="h-full min-h-[200px] flex items-center justify-center text-[#eaddcf]/30 italic border-2 border-dashed border-[#eaddcf]/10 rounded-lg p-12">
              Select a tavern to view details
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
