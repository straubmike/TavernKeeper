'use client';

import { usePrivy } from '@privy-io/react-auth';
import { ethers } from 'ethers';
import { useEffect, useState } from 'react';
import { PixelButton, PixelCard, PixelPanel } from '../../components/PixelComponents';
import { useSafeAccount } from '../../lib/hooks/useSafeAccount';
import { getFarcasterEthereumProvider } from '../../lib/services/farcasterWallet';
import { TownPosseGroup, townPosseService } from '../../lib/services/townPosseService';
import { isInFarcasterMiniapp } from '../../lib/utils/farcasterDetection';

export default function TownPossePage() {
    const isMiniapp = isInFarcasterMiniapp();
    const privy = usePrivy();
    const { address, authenticated } = useSafeAccount();

    // Helper to get ethers provider/signer
    const getEthersProvider = async () => {
        if (isMiniapp) {
            const provider = await getFarcasterEthereumProvider();
            if (!provider) return null;
            return new ethers.BrowserProvider(provider);
        } else {
            return await privy.getEthersProvider();
        }
    };
    const [posses, setPosses] = useState<TownPosseGroup[]>([]);
    const [loading, setLoading] = useState(true);
    const [viewMode, setViewMode] = useState<'list' | 'create' | 'details'>('list');
    const [selectedPosse, setSelectedPosse] = useState<TownPosseGroup | null>(null);

    // Create State
    const [createName, setCreateName] = useState('');
    const [maxMembers, setMaxMembers] = useState('50');
    const [minContribution, setMinContribution] = useState('0.1');
    const [openMembership, setOpenMembership] = useState(true);

    // Contribution State
    const [contributeMon, setContributeMon] = useState('');
    const [contributeKeep, setContributeKeep] = useState('');
    const [processing, setProcessing] = useState(false);

    useEffect(() => {
        if (authenticated) {
            fetchPosses();
        } else {
            setLoading(false);
        }
    }, [authenticated]);

    const fetchPosses = async () => {
        try {
            const provider = await getEthersProvider();
            if (!provider) return;
            const signer = await provider.getSigner();
            const userPosses = await townPosseService.getUserPosses(signer);
            setPosses(userPosses);
        } catch (error) {
            console.error("Failed to fetch posses:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleCreatePosse = async () => {
        if (!createName) return;
        setProcessing(true);
        try {
            const provider = await getEthersProvider();
            if (!provider) return;
            const signer = await provider.getSigner();
            await townPosseService.createPosse(
                signer,
                createName,
                parseInt(maxMembers),
                openMembership,
                minContribution
            );
            await fetchPosses();
            setViewMode('list');
            setCreateName('');
        } catch (error) {
            console.error("Failed to create posse:", error);
            alert("Failed to create posse. See console for details.");
        } finally {
            setProcessing(false);
        }
    };

    const handleContribute = async () => {
        if (!selectedPosse || !contributeMon || !contributeKeep) return;
        setProcessing(true);
        try {
            const provider = await getEthersProvider();
            if (!provider) return;
            const signer = await provider.getSigner();
            await townPosseService.contribute(signer, selectedPosse.posseId, contributeMon, contributeKeep);
            await fetchPosses();

            // Update selected posse
            const updatedPosses = await townPosseService.getUserPosses(signer);
            const updated = updatedPosses.find(p => p.posseId === selectedPosse.posseId);
            if (updated) setSelectedPosse(updated);

            setContributeMon('');
            setContributeKeep('');
            alert("Contribution successful!");
        } catch (error) {
            console.error("Failed to contribute:", error);
            alert("Failed to contribute. See console for details.");
        } finally {
            setProcessing(false);
        }
    };

    const handleClaimFees = async () => {
        if (!selectedPosse) return;
        setProcessing(true);
        try {
            const provider = await getEthersProvider();
            if (!provider) return;
            const signer = await provider.getSigner();
            await townPosseService.claimFees(signer, selectedPosse.posseId);
            await fetchPosses();
            alert("Fees claimed successfully!");
        } catch (error) {
            console.error("Failed to claim fees:", error);
            alert("Failed to claim fees. See console for details.");
        } finally {
            setProcessing(false);
        }
    };

    const getTierName = (tier: number) => {
        switch (tier) {
            case 3: return 'Gold';
            case 2: return 'Silver';
            case 1: return 'Bronze';
            default: return 'None';
        }
    };

    const getTierColor = (tier: number) => {
        switch (tier) {
            case 3: return 'text-yellow-400';
            case 2: return 'text-gray-300';
            case 1: return 'text-orange-400';
            default: return 'text-gray-500';
        }
    };

    if (!authenticated) {
        return (
            <main className="min-h-full bg-[#2a1d17] p-8 flex items-center justify-center font-pixel">
                <PixelPanel title="Access Denied" variant="wood" className="max-w-md text-center">
                    <p className="text-[#eaddcf] mb-4">Please connect your wallet to view Town Posses.</p>
                </PixelPanel>
            </main>
        );
    }

    return (
        <main className="min-h-full bg-[#2a1d17] p-4 md:p-8 font-pixel text-[#eaddcf]">
            <div className="max-w-4xl mx-auto">
                <div className="flex justify-between items-center mb-8">
                    <h1 className="text-2xl text-yellow-400">Town Posse</h1>
                    {viewMode === 'list' && (
                        <PixelButton onClick={() => setViewMode('create')}>
                            Form New Posse
                        </PixelButton>
                    )}
                    {viewMode !== 'list' && (
                        <PixelButton variant="wood" onClick={() => { setViewMode('list'); setSelectedPosse(null); }}>
                            Back to List
                        </PixelButton>
                    )}
                </div>

                {loading ? (
                    <div className="text-center animate-pulse">Loading Posse Records...</div>
                ) : (
                    <>
                        {viewMode === 'list' && (
                            <div className="grid gap-4 md:grid-cols-2">
                                {posses.length === 0 ? (
                                    <div className="col-span-2 text-center py-12 border-2 border-dashed border-[#4a3b2a] rounded-lg text-[#8b7355]">
                                        You haven't joined any Town Posses yet.
                                    </div>
                                ) : (
                                    posses.map(posse => (
                                        <PixelCard
                                            key={posse.posseId}
                                            variant="wood"
                                            className="cursor-pointer hover:border-yellow-400/50 transition-colors"
                                            onClick={() => { setSelectedPosse(posse); setViewMode('details'); }}
                                        >
                                            <div className="flex justify-between items-start mb-2">
                                                <h3 className="text-lg text-yellow-400">{posse.posseName}</h3>
                                                <span className={`text-xs px-2 py-1 rounded border border-current ${getTierColor(posse.myTier)}`}>
                                                    {getTierName(posse.myTier)}
                                                </span>
                                            </div>
                                            <div className="space-y-1 text-sm text-[#8b7355]">
                                                <div className="flex justify-between">
                                                    <span>Members:</span>
                                                    <span className="text-[#eaddcf]">{posse.members.length} / {posse.maxMembers}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span>My Share:</span>
                                                    <span className="text-[#eaddcf]">{parseFloat(posse.myShare).toFixed(2)}%</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span>Pending Fees:</span>
                                                    <span className="text-green-400">{parseFloat(posse.myPendingFees).toFixed(4)} ETH</span>
                                                </div>
                                            </div>
                                        </PixelCard>
                                    ))
                                )}
                            </div>
                        )}

                        {viewMode === 'create' && (
                            <PixelPanel title="Form a New Posse" variant="wood" className="max-w-md mx-auto">
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm text-[#8b7355] mb-1">Posse Name</label>
                                        <input
                                            type="text"
                                            value={createName}
                                            onChange={(e) => setCreateName(e.target.value)}
                                            className="w-full bg-[#1a120b] border-2 border-[#4a3b2a] p-2 text-[#eaddcf] focus:border-yellow-400 outline-none font-pixel"
                                            placeholder="e.g. The Peaky Blinders"
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm text-[#8b7355] mb-1">Max Members</label>
                                            <input
                                                type="number"
                                                value={maxMembers}
                                                onChange={(e) => setMaxMembers(e.target.value)}
                                                className="w-full bg-[#1a120b] border-2 border-[#4a3b2a] p-2 text-[#eaddcf] focus:border-yellow-400 outline-none font-pixel"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm text-[#8b7355] mb-1">Min Contribution</label>
                                            <input
                                                type="number"
                                                value={minContribution}
                                                onChange={(e) => setMinContribution(e.target.value)}
                                                className="w-full bg-[#1a120b] border-2 border-[#4a3b2a] p-2 text-[#eaddcf] focus:border-yellow-400 outline-none font-pixel"
                                            />
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="checkbox"
                                            checked={openMembership}
                                            onChange={(e) => setOpenMembership(e.target.checked)}
                                            className="w-4 h-4 accent-yellow-400 bg-[#1a120b] border-2 border-[#4a3b2a]"
                                        />
                                        <label className="text-sm text-[#8b7355]">Open Membership</label>
                                    </div>

                                    <PixelButton
                                        onClick={handleCreatePosse}
                                        disabled={!createName || processing}
                                        className="w-full"
                                    >
                                        {processing ? 'Creating...' : 'Form Posse'}
                                    </PixelButton>
                                </div>
                            </PixelPanel>
                        )}

                        {viewMode === 'details' && selectedPosse && (
                            <div className="grid gap-6 md:grid-cols-2">
                                {/* Posse Info */}
                                <div className="space-y-6">
                                    <PixelPanel title={selectedPosse.posseName} variant="wood">
                                        <div className="space-y-4">
                                            <div className="flex justify-between items-center p-4 bg-[#1a120b] rounded border border-[#4a3b2a]">
                                                <div className="text-sm text-[#8b7355]">My Tier</div>
                                                <div className={`text-xl ${getTierColor(selectedPosse.myTier)}`}>
                                                    {getTierName(selectedPosse.myTier)}
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="p-3 bg-[#1a120b] rounded border border-[#4a3b2a]">
                                                    <div className="text-xs text-[#8b7355]">My Share</div>
                                                    <div className="text-[#eaddcf]">{parseFloat(selectedPosse.myShare).toFixed(2)}%</div>
                                                </div>
                                                <div className="p-3 bg-[#1a120b] rounded border border-[#4a3b2a]">
                                                    <div className="text-xs text-[#8b7355]">Pending Fees</div>
                                                    <div className="text-green-400">{parseFloat(selectedPosse.myPendingFees).toFixed(6)} ETH</div>
                                                </div>
                                            </div>

                                            <PixelButton
                                                onClick={handleClaimFees}
                                                disabled={parseFloat(selectedPosse.myPendingFees) <= 0 || processing}
                                                className="w-full"
                                                variant="wood"
                                            >
                                                {processing ? 'Claiming...' : 'Claim Fees'}
                                            </PixelButton>
                                        </div>
                                    </PixelPanel>

                                    <PixelPanel title="Members" variant="wood">
                                        <div className="max-h-60 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                                            {selectedPosse.members.map((member, i) => (
                                                <div key={i} className="flex items-center gap-2 p-2 bg-[#1a120b] rounded text-xs">
                                                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                                                    <span className="font-mono text-[#8b7355]">{member}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </PixelPanel>
                                </div>

                                {/* Actions */}
                                <div className="space-y-6">
                                    <PixelPanel title="Contribute & Upgrade Tier" variant="wood">
                                        <div className="space-y-4">
                                            <p className="text-xs text-[#8b7355]">
                                                Increase your contribution to upgrade your tier (Bronze, Silver, Gold) and earn more voting power.
                                            </p>

                                            <div>
                                                <label className="block text-xs text-[#8b7355] mb-1">MON Amount</label>
                                                <input
                                                    type="number"
                                                    value={contributeMon}
                                                    onChange={(e) => setContributeMon(e.target.value)}
                                                    className="w-full bg-[#1a120b] border-2 border-[#4a3b2a] p-2 text-[#eaddcf] focus:border-yellow-400 outline-none font-pixel"
                                                    placeholder="0.0"
                                                />
                                            </div>

                                            <div>
                                                <label className="block text-xs text-[#8b7355] mb-1">KEEP Amount</label>
                                                <input
                                                    type="number"
                                                    value={contributeKeep}
                                                    onChange={(e) => setContributeKeep(e.target.value)}
                                                    className="w-full bg-[#1a120b] border-2 border-[#4a3b2a] p-2 text-[#eaddcf] focus:border-yellow-400 outline-none font-pixel"
                                                    placeholder="0.0"
                                                />
                                            </div>

                                            <PixelButton
                                                onClick={handleContribute}
                                                disabled={!contributeMon || !contributeKeep || processing}
                                                className="w-full"
                                            >
                                                {processing ? 'Contributing...' : 'Contribute Assets'}
                                            </PixelButton>
                                        </div>
                                    </PixelPanel>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        </main>
    );
}
