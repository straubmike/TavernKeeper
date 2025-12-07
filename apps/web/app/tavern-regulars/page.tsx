'use client';

import { useEffect, useState } from 'react';
import { useAccount, useWalletClient } from 'wagmi';
import { PixelButton, PixelCard, PixelPanel } from '../../components/PixelComponents';
import { TavernRegularsGroup, tavernRegularsService } from '../../lib/services/tavernRegularsService';

export default function TavernRegularsPage() {
    const { address, isConnected } = useAccount();
    const { data: walletClient } = useWalletClient();

    const [groups, setGroups] = useState<TavernRegularsGroup[]>([]);
    const [loading, setLoading] = useState(true);
    const [createName, setCreateName] = useState('');
    const [viewMode, setViewMode] = useState<'list' | 'create' | 'details'>('list');
    const [selectedGroup, setSelectedGroup] = useState<TavernRegularsGroup | null>(null);

    // Contribution State
    const [contributeMon, setContributeMon] = useState('');
    const [contributeKeep, setContributeKeep] = useState('');
    const [processing, setProcessing] = useState(false);

    useEffect(() => {
        if (isConnected && address) {
            fetchGroups();
        } else {
            setLoading(false);
        }
    }, [isConnected, address]);

    const fetchGroups = async () => {
        if (!address) return;
        try {
            const userGroups = await tavernRegularsService.getUserGroups(address);
            setGroups(userGroups);
        } catch (error) {
            console.error("Failed to fetch groups:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateGroup = async () => {
        if (!createName || !walletClient) return;
        setProcessing(true);
        try {
            await tavernRegularsService.createGroup(walletClient, createName);
            await fetchGroups();
            setViewMode('list');
            setCreateName('');
        } catch (error) {
            console.error("Failed to create group:", error);
            alert("Failed to create group. See console for details.");
        } finally {
            setProcessing(false);
        }
    };

    const handleContribute = async () => {
        if (!selectedGroup || !contributeMon || !contributeKeep || !walletClient) return;
        setProcessing(true);
        try {
            await tavernRegularsService.contribute(walletClient, selectedGroup.groupId, contributeMon, contributeKeep);
            await fetchGroups();
            // Update selected group with new data - fetch fresh list and find it
            if (address) {
                const updatedGroups = await tavernRegularsService.getUserGroups(address);
                const updated = updatedGroups.find(g => g.groupId === selectedGroup.groupId);
                if (updated) setSelectedGroup(updated);
            }

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
        if (!selectedGroup || !walletClient) return;
        setProcessing(true);
        try {
            await tavernRegularsService.claimFees(walletClient, selectedGroup.groupId);
            await fetchGroups();
            alert("Fees claimed successfully!");
        } catch (error) {
            console.error("Failed to claim fees:", error);
            alert("Failed to claim fees. See console for details.");
        } finally {
            setProcessing(false);
        }
    };

    if (!isConnected) {
        return (
            <main className="min-h-full bg-[#2a1d17] p-8 flex items-center justify-center font-pixel">
                <PixelPanel title="Access Denied" variant="wood" className="max-w-md text-center">
                    <p className="text-[#eaddcf] mb-4">Please connect your wallet to view Tavern Regulars.</p>
                </PixelPanel>
            </main>
        );
    }

    return (
        <main className="min-h-full bg-[#2a1d17] p-4 md:p-8 font-pixel text-[#eaddcf]">
            <div className="max-w-4xl mx-auto">
                <div className="flex justify-between items-center mb-8">
                    <h1 className="text-2xl text-yellow-400">Tavern Regulars</h1>
                    {viewMode === 'list' && (
                        <PixelButton onClick={() => setViewMode('create')}>
                            Start New Group
                        </PixelButton>
                    )}
                    {viewMode !== 'list' && (
                        <PixelButton variant="wood" onClick={() => { setViewMode('list'); setSelectedGroup(null); }}>
                            Back to List
                        </PixelButton>
                    )}
                </div>

                {loading ? (
                    <div className="text-center animate-pulse">Loading Tavern Records...</div>
                ) : (
                    <>
                        {viewMode === 'list' && (
                            <div className="grid gap-4 md:grid-cols-2">
                                {groups.length === 0 ? (
                                    <div className="col-span-2 text-center py-12 border-2 border-dashed border-[#4a3b2a] rounded-lg text-[#8b7355]">
                                        You haven't joined any Regulars groups yet.
                                    </div>
                                ) : (
                                    groups.map(group => (
                                        <PixelCard
                                            key={group.groupId}
                                            variant="wood"
                                            className="cursor-pointer hover:border-yellow-400/50 transition-colors"
                                            onClick={() => { setSelectedGroup(group); setViewMode('details'); }}
                                        >
                                            <div className="flex justify-between items-start mb-2">
                                                <h3 className="text-lg text-yellow-400">{group.groupName}</h3>
                                                <span className="text-xs bg-[#1a120b] px-2 py-1 rounded">ID: {group.groupId}</span>
                                            </div>
                                            <div className="space-y-1 text-sm text-[#8b7355]">
                                                <div className="flex justify-between">
                                                    <span>Members:</span>
                                                    <span className="text-[#eaddcf]">{group.members.length}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span>My Share:</span>
                                                    <span className="text-[#eaddcf]">{parseFloat(group.myShare).toFixed(2)}%</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span>Pending Fees:</span>
                                                    <span className="text-green-400">{parseFloat(group.myPendingFees).toFixed(4)} ETH</span>
                                                </div>
                                            </div>
                                        </PixelCard>
                                    ))
                                )}
                            </div>
                        )}

                        {viewMode === 'create' && (
                            <PixelPanel title="Form a New Group" variant="wood" className="max-w-md mx-auto">
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm text-[#8b7355] mb-1">Group Name</label>
                                        <input
                                            type="text"
                                            value={createName}
                                            onChange={(e) => setCreateName(e.target.value)}
                                            className="w-full bg-[#1a120b] border-2 border-[#4a3b2a] p-2 text-[#eaddcf] focus:border-yellow-400 outline-none font-pixel"
                                            placeholder="e.g. The Winchester"
                                        />
                                    </div>
                                    <PixelButton
                                        onClick={handleCreateGroup}
                                        disabled={!createName || processing}
                                        className="w-full"
                                    >
                                        {processing ? 'Creating...' : 'Create Group'}
                                    </PixelButton>
                                </div>
                            </PixelPanel>
                        )}

                        {viewMode === 'details' && selectedGroup && (
                            <div className="grid gap-6 md:grid-cols-2">
                                {/* Group Info */}
                                <div className="space-y-6">
                                    <PixelPanel title={selectedGroup.groupName} variant="wood">
                                        <div className="space-y-4">
                                            <div className="p-4 bg-[#1a120b] rounded border border-[#4a3b2a]">
                                                <div className="text-sm text-[#8b7355] mb-1">Total Contribution</div>
                                                <div className="text-xl text-yellow-400">{parseFloat(selectedGroup.totalContribution).toFixed(4)} ETH</div>
                                            </div>

                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="p-3 bg-[#1a120b] rounded border border-[#4a3b2a]">
                                                    <div className="text-xs text-[#8b7355]">My Share</div>
                                                    <div className="text-[#eaddcf]">{parseFloat(selectedGroup.myShare).toFixed(2)}%</div>
                                                </div>
                                                <div className="p-3 bg-[#1a120b] rounded border border-[#4a3b2a]">
                                                    <div className="text-xs text-[#8b7355]">Pending Fees</div>
                                                    <div className="text-green-400">{parseFloat(selectedGroup.myPendingFees).toFixed(6)} ETH</div>
                                                </div>
                                            </div>

                                            <PixelButton
                                                onClick={handleClaimFees}
                                                disabled={parseFloat(selectedGroup.myPendingFees) <= 0 || processing}
                                                className="w-full"
                                                variant="wood"
                                            >
                                                {processing ? 'Claiming...' : 'Claim Fees'}
                                            </PixelButton>
                                        </div>
                                    </PixelPanel>

                                    <PixelPanel title="Members" variant="wood">
                                        <div className="max-h-60 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                                            {selectedGroup.members.map((member, i) => (
                                                <div key={i} className="flex items-center gap-2 p-2 bg-[#1a120b] rounded text-xs">
                                                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                                                    <span className="font-mono text-[#8b7355]">{member}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </PixelPanel>
                                </div>

                                {/* Actions */}
                                <div className="space-y-6">
                                    <PixelPanel title="Contribute" variant="wood">
                                        <div className="space-y-4">
                                            <p className="text-xs text-[#8b7355]">
                                                Contribute MON and KEEP to increase your share of the group's earnings.
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
