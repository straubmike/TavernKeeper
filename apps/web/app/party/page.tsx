'use client';

import { useEffect, useState } from 'react';
import { useAccount } from 'wagmi';
import NFTMetadataUpdater from '../../components/NFTMetadataUpdater';
import { PixelButton, PixelCard, PixelPanel } from '../../components/PixelComponents';
import RecruitHeroView from '../../components/RecruitHeroView';
import TavernKeeperBuilder from '../../components/TavernKeeperBuilder';
import { HeroNFT, rpgService, TavernKeeperNFT } from '../../lib/services/rpgService';
import { isInFarcasterMiniapp } from '../../lib/utils/farcasterDetection';
import { SpritePreview } from '../../components/heroes/SpritePreview';
import { HeroMetadata } from '../../lib/services/heroMetadata';
import { HeroClass, Gender, HeroColors, DEFAULT_COLORS } from '../../lib/services/spriteService';

export default function PartyPage() {
  const isMiniapp = isInFarcasterMiniapp();
  const { address, isConnected } = useAccount();
  const authenticated = isConnected;

  const [tavernKeepers, setTavernKeepers] = useState<TavernKeeperNFT[]>([]);
  const [selectedKeeper, setSelectedKeeper] = useState<TavernKeeperNFT | null>(null);
  const [heroes, setHeroes] = useState<HeroNFT[]>([]);
  const [heroMetadata, setHeroMetadata] = useState<Record<string, HeroMetadata>>({});
  const [loadingHeroMetadata, setLoadingHeroMetadata] = useState<Record<string, boolean>>({});
  const [keeperMetadata, setKeeperMetadata] = useState<Record<string, {
    name: string;
    gender?: Gender;
    colorPalette?: HeroColors;
  }>>({});

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

  // Auto-select first keeper if none selected
  useEffect(() => {
    if (tavernKeepers.length > 0 && !selectedKeeper) {
      setSelectedKeeper(tavernKeepers[0]);
    }
  }, [tavernKeepers, selectedKeeper]);

  // Fetch Heroes when a Keeper is selected
  useEffect(() => {
    if (selectedKeeper && selectedKeeper.tbaAddress && selectedKeeper.tbaAddress.trim() !== '') {
      console.log(`🔄 Selected keeper changed: #${selectedKeeper.tokenId}, TBA: ${selectedKeeper.tbaAddress}`);
      console.log(`   Expected hero mint address: 0xB9f10e976987A871513EE8b21c7BFC41bea596af`);
      console.log(`   TBA matches: ${selectedKeeper.tbaAddress.toLowerCase() === '0xB9f10e976987A871513EE8b21c7BFC41bea596af'.toLowerCase() ? '✅ YES' : '❌ NO'}`);
      fetchHeroes(selectedKeeper.tbaAddress);
    } else {
      console.warn('⚠️ Selected keeper has no TBA address:', selectedKeeper);
      setHeroes([]);
    }
  }, [selectedKeeper]);

  // Add a refresh button handler
  const handleRefreshHeroes = () => {
    if (selectedKeeper && selectedKeeper.tbaAddress) {
      fetchHeroes(selectedKeeper.tbaAddress);
    }
  };

  const fetchKeepers = async () => {
    if (!address) return;
    setLoading(true);
    try {
      const keepers = await rpgService.getUserTavernKeepers(address);
      setTavernKeepers(keepers);

      // Fetch metadata for each keeper
      const metadataMap: Record<string, {
        name: string;
        gender?: Gender;
        colorPalette?: HeroColors;
      }> = {};
      for (const keeper of keepers) {
        try {
          const tokenURI = await rpgService.getTavernKeeperTokenURI(keeper.tokenId);

          if (!tokenURI || tokenURI.trim() === '') {
            console.warn(`[fetchKeepers] Empty tokenURI for keeper ${keeper.tokenId}, using defaults`);
            // Use default values if no metadata available
            metadataMap[keeper.tokenId] = {
              name: `TavernKeeper #${keeper.tokenId}`,
              gender: 'Male',
              colorPalette: DEFAULT_COLORS,
            };
            continue;
          }

          let metadata: {
            name?: string;
            keeper?: {
              gender?: Gender;
              colorPalette?: HeroColors;
            };
          } = {};

          // Handle data URIs (base64 encoded JSON)
          if (tokenURI.startsWith('data:application/json;base64,')) {
            try {
              const base64 = tokenURI.replace('data:application/json;base64,', '');
              const jsonString = atob(base64);
              metadata = JSON.parse(jsonString);
              console.log(`[fetchKeepers] Parsed data URI metadata for keeper ${keeper.tokenId}:`, {
                hasName: !!metadata.name,
                hasKeeper: !!metadata.keeper,
                hasGender: !!metadata.keeper?.gender,
                hasColorPalette: !!metadata.keeper?.colorPalette,
              });
            } catch (parseError) {
              console.error(`[fetchKeepers] Failed to parse data URI for keeper ${keeper.tokenId}:`, parseError);
            }
          }
          // Handle HTTP URLs
          else if (tokenURI.startsWith('http://') || tokenURI.startsWith('https://')) {
            try {
              const response = await fetch(tokenURI);
              if (response.ok) {
                metadata = await response.json();
                console.log(`[fetchKeepers] Fetched HTTP metadata for keeper ${keeper.tokenId}:`, {
                  hasName: !!metadata.name,
                  hasKeeper: !!metadata.keeper,
                });
              } else {
                console.warn(`[fetchKeepers] HTTP fetch failed for keeper ${keeper.tokenId}: ${response.status} ${response.statusText}`);
              }
            } catch (fetchError) {
              console.error(`[fetchKeepers] Failed to fetch HTTP metadata for keeper ${keeper.tokenId}:`, fetchError);
            }
          }
          // Handle IPFS URIs
          else if (tokenURI.startsWith('ipfs://')) {
            try {
              const url = tokenURI.replace('ipfs://', 'https://ipfs.io/ipfs/');
              const response = await fetch(url);
              if (response.ok) {
                metadata = await response.json();
                console.log(`[fetchKeepers] Fetched IPFS metadata for keeper ${keeper.tokenId}:`, {
                  hasName: !!metadata.name,
                  hasKeeper: !!metadata.keeper,
                });
              } else {
                console.warn(`[fetchKeepers] IPFS fetch failed for keeper ${keeper.tokenId}: ${response.status} ${response.statusText}`);
              }
            } catch (fetchError) {
              console.error(`[fetchKeepers] Failed to fetch IPFS metadata for keeper ${keeper.tokenId}:`, fetchError);
            }
          } else {
            console.warn(`[fetchKeepers] Unknown URI format for keeper ${keeper.tokenId}: ${tokenURI.substring(0, 50)}...`);
          }

          // Use metadata if available, otherwise use defaults
          if (metadata.name || metadata.keeper) {
            metadataMap[keeper.tokenId] = {
              name: metadata.name || `TavernKeeper #${keeper.tokenId}`,
              gender: metadata.keeper?.gender || 'Male',
              colorPalette: metadata.keeper?.colorPalette || DEFAULT_COLORS,
            };
            console.log(`[fetchKeepers] Set metadata for keeper ${keeper.tokenId}:`, metadataMap[keeper.tokenId]);
          } else {
            // No metadata found, use defaults
            console.warn(`[fetchKeepers] No valid metadata found for keeper ${keeper.tokenId}, using defaults`);
            metadataMap[keeper.tokenId] = {
              name: `TavernKeeper #${keeper.tokenId}`,
              gender: 'Male',
              colorPalette: DEFAULT_COLORS,
            };
          }
        } catch (e) {
          console.error(`[fetchKeepers] Failed to fetch metadata for keeper ${keeper.tokenId}:`, e);
          // Use defaults on error
          metadataMap[keeper.tokenId] = {
            name: `TavernKeeper #${keeper.tokenId}`,
            gender: 'Male',
            colorPalette: DEFAULT_COLORS,
          };
        }
      }

      setKeeperMetadata(metadataMap);

      if (keepers.length > 0 && !selectedKeeper) {
        setSelectedKeeper(keepers[0]);
      }
    } catch (e) {
      console.error("Failed to fetch keepers", e);
    } finally {
      setLoading(false);
    }
  };

  // Fetch hero metadata from URI
  const fetchHeroMetadata = async (hero: HeroNFT) => {
    if (heroMetadata[hero.tokenId] || loadingHeroMetadata[hero.tokenId]) {
      return; // Already fetched or fetching
    }

    setLoadingHeroMetadata(prev => ({ ...prev, [hero.tokenId]: true }));

    try {
      let metadata: HeroMetadata | null = null;
      const uri = hero.metadataUri;

      if (!uri || uri.trim() === '') {
        console.warn(`[fetchHeroMetadata] Empty URI for hero ${hero.tokenId}`);
        setHeroMetadata(prev => ({ ...prev, [hero.tokenId]: null as any }));
        return;
      }

      // Handle data URIs (base64 encoded JSON)
      if (uri.startsWith('data:application/json;base64,')) {
        try {
          const base64 = uri.replace('data:application/json;base64,', '');
          const jsonString = atob(base64);
          metadata = JSON.parse(jsonString) as HeroMetadata;
          console.log(`[fetchHeroMetadata] Parsed data URI for hero ${hero.tokenId}:`, {
            hasName: !!metadata?.name,
            name: metadata?.name,
            hasHero: !!metadata?.hero,
            hasClass: !!metadata?.hero?.class,
          });
        } catch (parseError) {
          console.error(`[fetchHeroMetadata] Failed to parse data URI for hero ${hero.tokenId}:`, parseError);
        }
      }
      // Handle HTTP URLs
      else if (uri.startsWith('http://') || uri.startsWith('https://')) {
        try {
          const response = await fetch(uri);
          if (response.ok) {
            metadata = await response.json() as HeroMetadata;
            console.log(`[fetchHeroMetadata] Fetched HTTP metadata for hero ${hero.tokenId}:`, {
              hasName: !!metadata?.name,
              name: metadata?.name,
              hasHero: !!metadata?.hero,
            });
          } else {
            console.warn(`[fetchHeroMetadata] HTTP fetch failed for hero ${hero.tokenId}: ${response.status} ${response.statusText}`);
          }
        } catch (fetchError) {
          console.error(`[fetchHeroMetadata] Failed to fetch HTTP metadata for hero ${hero.tokenId}:`, fetchError);
        }
      }
      // Handle IPFS URIs
      else if (uri.startsWith('ipfs://')) {
        try {
          const url = uri.replace('ipfs://', 'https://ipfs.io/ipfs/');
          const response = await fetch(url);
          if (response.ok) {
            metadata = await response.json() as HeroMetadata;
            console.log(`[fetchHeroMetadata] Fetched IPFS metadata for hero ${hero.tokenId}:`, {
              hasName: !!metadata?.name,
              name: metadata?.name,
              hasHero: !!metadata?.hero,
            });
          } else {
            console.warn(`[fetchHeroMetadata] IPFS fetch failed for hero ${hero.tokenId}: ${response.status} ${response.statusText}`);
          }
        } catch (fetchError) {
          console.error(`[fetchHeroMetadata] Failed to fetch IPFS metadata for hero ${hero.tokenId}:`, fetchError);
        }
      } else {
        console.warn(`[fetchHeroMetadata] Unknown URI format for hero ${hero.tokenId}: ${uri.substring(0, 50)}...`);
      }

      if (metadata) {
        setHeroMetadata(prev => ({ ...prev, [hero.tokenId]: metadata! }));
      }
    } catch (e) {
      console.warn(`Failed to fetch metadata for hero ${hero.tokenId}:`, e);
    } finally {
      setLoadingHeroMetadata(prev => ({ ...prev, [hero.tokenId]: false }));
    }
  };

  const fetchHeroes = async (tbaAddress: string) => {
    // Validate TBA address before fetching
    if (!tbaAddress || tbaAddress.trim() === '' || !tbaAddress.startsWith('0x')) {
      console.warn('⚠️ Cannot fetch heroes: invalid or empty TBA address:', tbaAddress);
      console.warn('   This usually means the TBA address calculation failed. The TavernKeeper may still exist, but heroes cannot be queried.');
      setHeroes([]);
      setHeroMetadata({});
      return;
    }

    console.log(`🔄 fetchHeroes: Fetching heroes for TBA ${tbaAddress}`);
    console.log(`   Selected Keeper: ${selectedKeeper?.tokenId || 'none'}`);
    console.log(`   TBA Address (full): ${tbaAddress}`);
    setLoadingHeroes(true);
    try {
      const heroList = await rpgService.getHeroes(tbaAddress);
      console.log(`✅ fetchHeroes: Got ${heroList.length} hero(es) for TBA ${tbaAddress}`);
      if (heroList.length === 0) {
        console.warn(`⚠️ No heroes found for TBA ${tbaAddress}`);
        console.warn(`   This could mean:`);
        console.warn(`   1. No heroes have been minted to this TBA yet`);
        console.warn(`   2. The TBA address doesn't match where heroes were minted`);
        console.warn(`   3. The transaction hasn't been confirmed yet (wait a few seconds and click REFRESH)`);
        console.warn(`   4. Check the transaction to see which address the hero was minted to`);
      } else {
        console.log(`   Hero token IDs: ${heroList.map(h => h.tokenId).join(', ')}`);
      }
      setHeroes(heroList);
      setHeroMetadata({}); // Clear old metadata

      // Fetch metadata for all heroes
      heroList.forEach(hero => {
        fetchHeroMetadata(hero);
      });
    } catch (e: any) {
      console.error("❌ fetchHeroes: Failed to fetch heroes", e);
      console.error("   Error details:", e?.message || e);
      setHeroes([]);
      setHeroMetadata({});
    } finally {
      setLoadingHeroes(false);
    }
  };

  const handleRecruitSuccess = async () => {
    setViewMode('dashboard');
    if (selectedKeeper) {
      // Auto-refresh heroes after minting - wait a bit for blockchain state to update
      // Sometimes the hero isn't immediately queryable after minting
      let retries = 0;
      const maxRetries = 8;
      const retryDelay = 2000; // 2 seconds between retries

      const tryFetchHeroes = async () => {
        try {
          await fetchHeroes(selectedKeeper.tbaAddress);
          // Check if we got heroes by checking the state after a short delay
          await new Promise(resolve => setTimeout(resolve, 500));
          // Continue retrying until we find heroes or max retries
          if (retries < maxRetries) {
            retries++;
            setTimeout(tryFetchHeroes, retryDelay);
          }
        } catch (error) {
          console.warn(`Failed to fetch heroes (attempt ${retries + 1}/${maxRetries}):`, error);
          if (retries < maxRetries) {
            retries++;
            setTimeout(tryFetchHeroes, retryDelay);
          }
        }
      };

      // Start fetching after initial delay
      setTimeout(tryFetchHeroes, 1000);
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
        tavernKeeperId={selectedKeeper.tokenId}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-2 sm:p-4 overflow-hidden">
          <div className="w-full h-full max-w-4xl max-h-[95vh] flex items-center justify-center">
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
        </div>
      )}
      {updatingKeeper && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-2 sm:p-4 overflow-hidden">
          <div className="w-full h-full max-w-4xl max-h-[95vh] flex items-center justify-center">
            <NFTMetadataUpdater
              tokenId={updatingKeeper.keeper.tokenId}
              tokenUri={updatingKeeper.metadataUri}
              contractType="tavernKeeper"
              onSuccess={() => {
                setUpdatingKeeper(null);
                // Refresh keepers to get updated metadata
                fetchKeepers();
              }}
              onCancel={() => setUpdatingKeeper(null)}
            />
          </div>
        </div>
      )}

      <div className="max-w-6xl mx-auto space-y-6">
        {/* Keeper Selection Tabs */}
        {tavernKeepers.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-2">
            {tavernKeepers.map(keeper => {
              const metadata = keeperMetadata[keeper.tokenId];
              return (
                <button
                  key={keeper.tokenId}
                  onClick={() => setSelectedKeeper(keeper)}
                  className={`px-4 py-2 border-2 transition-all whitespace-nowrap ${
                    selectedKeeper?.tokenId === keeper.tokenId
                      ? 'border-yellow-400 bg-[#4a3b2a] text-[#eaddcf]'
                      : 'border-[#4a3b2a] text-[#8b7355] hover:border-yellow-400/50'
                  }`}
                >
                  {metadata?.name || `Keeper #${keeper.tokenId}`}
                </button>
              );
            })}
          </div>
        )}

        {/* Main Content: Keeper Details & Heroes */}
        <div>
          {selectedKeeper ? (() => {
            const selectedMetadata = keeperMetadata[selectedKeeper.tokenId];
            const keeperGender = selectedMetadata?.gender || 'Male';
            const keeperColors = selectedMetadata?.colorPalette || DEFAULT_COLORS;
            return (
              <div className="space-y-6">
                {/* TavernKeeper Header */}
                <PixelPanel title={selectedMetadata?.name || `TavernKeeper #${selectedKeeper.tokenId}`} variant="wood">
                  <div className="flex flex-col md:flex-row gap-6 items-start">
                    {/* Keeper Sprite */}
                    <div className="flex-shrink-0 flex justify-center md:justify-start">
                      <div className="scale-90">
                        <SpritePreview
                          type={keeperGender}
                          colors={keeperColors}
                          isKeeper={true}
                          scale={4}
                          showFrame={true}
                          name={selectedMetadata?.name || `Keeper #${selectedKeeper.tokenId}`}
                          subtitle="Proprietor"
                        />
                      </div>
                    </div>
                    {/* Keeper Info */}
                    <div className="flex-1 space-y-4 min-w-0">
                      <div>
                        <div className="text-sm text-[#8b7355] mb-1 font-semibold">Vault Address</div>
                        <div className="text-[#eaddcf] font-mono text-xs break-all bg-[#1a120d] p-2 rounded border border-[#4a3b2a]">
                          {selectedKeeper.tbaAddress}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <PixelButton
                          size="sm"
                          variant="neutral"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleUpdateKeeper(selectedKeeper);
                          }}
                        >
                          Update Keeper
                        </PixelButton>
                        <PixelButton
                          onClick={() => setViewMode('recruit')}
                          className="min-w-[120px]"
                        >
                          Recruit Hero
                        </PixelButton>
                      </div>
                    </div>
                  </div>
                </PixelPanel>

                {/* Heroes Roster */}
                <PixelPanel title="Hero Roster" variant="wood">
                  <div>
                    {loadingHeroes ? (
                    <div className="text-center text-[#8b7355] py-12">
                      <div className="animate-pulse">Loading heroes...</div>
                    </div>
                  ) : heroes.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                      {heroes.map(hero => {
                        const metadata = heroMetadata[hero.tokenId];
                        const isLoadingMeta = loadingHeroMetadata[hero.tokenId];
                        const heroClass = metadata?.hero?.class || 'Warrior';
                        const heroName = metadata?.name || `Hero #${hero.tokenId}`;
                        const colors = metadata?.hero?.colorPalette || {
                          skin: '#fdbcb4',
                          hair: '#8b4513',
                          clothing: '#ef4444',
                          accent: '#ffffff',
                        };

                        return (
                          <PixelCard
                            key={hero.tokenId}
                            variant="default"
                            className="bg-[#1a120d] border-2 border-[#4a3b2a] hover:border-yellow-400/50 transition-all"
                          >
                            <div className="flex flex-col items-center gap-4">
                              {/* Hero Sprite */}
                              <div className="w-full flex justify-center min-h-[120px] items-center">
                                {isLoadingMeta ? (
                                  <div className="text-[#8b7355] text-sm animate-pulse">Loading...</div>
                                ) : (
                                  <div className="scale-75 sm:scale-100">
                                    <SpritePreview
                                      type={heroClass as HeroClass}
                                      colors={colors}
                                      scale={3}
                                      isKeeper={false}
                                      showFrame={true}
                                      name={heroName}
                                      subtitle={`Level 1 ${heroClass}`}
                                    />
                                  </div>
                                )}
                              </div>

                              {/* Hero Info */}
                              <div className="w-full space-y-2">
                                <div className="text-center">
                                  <div className="text-lg text-[#eaddcf] font-bold">{heroName}</div>
                                  <div className="text-xs text-[#8b7355]">#{hero.tokenId} • {heroClass}</div>
                                </div>
                                <PixelButton
                                  size="sm"
                                  variant="neutral"
                                  onClick={() => setUpdatingHero(hero)}
                                  className="w-full"
                                >
                                  Update
                                </PixelButton>
                              </div>
                            </div>
                          </PixelCard>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-12 border-2 border-dashed border-[#4a3b2a] rounded-lg bg-[#1a120d]/50">
                      <div className="text-[#8b7355] mb-4 italic">
                        No heroes in this tavern yet.
                      </div>
                      <PixelButton
                        onClick={() => setViewMode('recruit')}
                        className="mt-4"
                      >
                        Recruit Your First Hero
                      </PixelButton>
                    </div>
                  )}
                  </div>
                </PixelPanel>
              </div>
            );
          })() : (
            <div className="h-full min-h-[200px] flex items-center justify-center text-[#eaddcf]/30 italic border-2 border-dashed border-[#eaddcf]/10 rounded-lg p-12">
              Select a tavern to view details
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
