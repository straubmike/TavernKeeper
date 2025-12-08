'use client';

import { useEffect, useState } from 'react';
import { formatEther } from 'viem';
import { useAccount, usePublicClient, useWalletClient } from 'wagmi';
import { monad } from '../lib/chains';
import { uploadMetadata } from '../lib/services/heroMinting';
import { metadataStorage } from '../lib/services/metadataStorage';
import { rpgService } from '../lib/services/rpgService';
import { HeroClass, generateSpriteURI } from '../lib/services/spriteService';
import { ForgeButton, ForgePanel } from './heroes/ForgeComponents';
import HeroEditor, { HeroData } from './heroes/HeroEditor';

interface RecruitHeroViewProps {
    tbaAddress: string;
    tavernKeeperId?: string; // Optional: If provided, will check for free hero claim
    onSuccess?: () => void;
    onCancel?: () => void;
}

export default function RecruitHeroView({ tbaAddress, tavernKeeperId, onSuccess, onCancel }: RecruitHeroViewProps) {
    const { address } = useAccount();
    const { data: walletClient } = useWalletClient();
    const publicClient = usePublicClient();
    const [balance, setBalance] = useState<{ value: bigint; decimals: number; symbol: string } | null>(null);
    const [hasUnclaimedFreeHero, setHasUnclaimedFreeHero] = useState<boolean>(false);
    const [checkingFreeHero, setCheckingFreeHero] = useState<boolean>(true);

    // Fetch Balance
    useEffect(() => {
        if (!address || !publicClient) {
            setBalance(null);
            return;
        }

        const fetchBalance = async () => {
            try {
                const balanceValue = await publicClient.getBalance({
                    address: address as `0x${string}`,
                });
                setBalance({
                    value: balanceValue,
                    decimals: 18,
                    symbol: 'MON'
                });
            } catch (error) {
                console.error('Failed to fetch balance:', error);
                setBalance(null);
            }
        };

        fetchBalance();
        const interval = setInterval(fetchBalance, 10000); // Poll every 10s
        return () => clearInterval(interval);
    }, [address]);

    const [heroData, setHeroData] = useState<HeroData>({
        name: '',
        heroClass: 'Warrior',
        colors: {
            skin: '#fdbcb4',
            hair: '#8b4513',
            clothing: '#ef4444',
            accent: '#ffffff',
        }
    });

    const [activeTab, setActiveTab] = useState<'design' | 'recruit'>('design');
    const [status, setStatus] = useState<'idle' | 'uploading' | 'minting' | 'success' | 'error'>('idle');
    const [statusMessage, setStatusMessage] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [priceSignature, setPriceSignature] = useState<{
        amount: string;
        amountWei: string;
        deadline: string;
        signature: string;
        monPrice: number;
        usdPrice: number;
        tier: number;
    } | null>(null);

    // Check if user has unclaimed free hero
    useEffect(() => {
        if (!tavernKeeperId || !address) {
            setCheckingFreeHero(false);
            return;
        }

        const checkFreeHero = async () => {
            try {
                console.log(`🔍 RecruitHeroView: Checking free hero for TavernKeeper #${tavernKeeperId}...`);
                const claimed = await rpgService.hasClaimedFreeHero(tavernKeeperId);
                const hasUnclaimed = !claimed;
                console.log(`✅ RecruitHeroView: Free hero status - claimed: ${claimed}, hasUnclaimed: ${hasUnclaimed}`);
                setHasUnclaimedFreeHero(hasUnclaimed);
            } catch (error) {
                console.error('❌ RecruitHeroView: Failed to check free hero status:', error);
                setHasUnclaimedFreeHero(false);
            } finally {
                setCheckingFreeHero(false);
            }
        };

        checkFreeHero();
    }, [tavernKeeperId, address]);

    useEffect(() => {
        // Fetch price signature (Tier 1 = $1 for first hero) - only if no free hero available
        if (!address || hasUnclaimedFreeHero) return;
        const fetchPrice = async () => {
            try {
                const sig = await rpgService.getPriceSignature('adventurer', 1, address);
                setPriceSignature(sig);
            } catch (e) {
                console.error('Failed to fetch price signature:', e);
                setPriceSignature(null);
            }
        };
        fetchPrice();
    }, [address, hasUnclaimedFreeHero]);

    const handleClaimFreeHero = async () => {
        if (!address || !walletClient || !tavernKeeperId || !heroData.name) return;

        // Clear any previous errors when retrying
        setError(null);
        setStatus('uploading');
        setStatusMessage('Preparing Free Hero Metadata...');

        try {
            // 1. Generate sprite and upload image separately to IPFS (with retries)
            setStatusMessage('Uploading hero image...');
            const imageDataUri = generateSpriteURI(heroData.heroClass as HeroClass, heroData.colors, false);
            let imageHttpUrl: string;
            try {
                imageHttpUrl = await metadataStorage.uploadImageFromDataUri(
                    imageDataUri,
                    `hero-${heroData.name.toLowerCase().replace(/\s+/g, '-')}.png`,
                    3, // 3 retry attempts
                    true // throw on failure so user knows
                );
            } catch (error) {
                throw new Error(`Failed to upload image after retries: ${(error as Error).message}. Please try again.`);
            }

            // 2. Upload Metadata with HTTP URL reference
            setStatusMessage('Uploading metadata...');
            const metadata = {
                name: heroData.name,
                description: `A brave ${heroData.heroClass} adventurer.`,
                image: imageHttpUrl,
                attributes: [
                    { trait_type: 'Class', value: heroData.heroClass },
                    { trait_type: 'Level', value: 1 },
                ],
                hero: {
                    class: heroData.heroClass,
                    colorPalette: heroData.colors,
                    spriteSheet: heroData.heroClass.toLowerCase(),
                    animationFrames: {
                        idle: [0, 1, 2, 3],
                        walk: [4, 5, 6, 7],
                        emote: [8],
                        talk: [9, 10],
                    },
                },
            };
            const metadataUri = await uploadMetadata(metadata);

            // 3. Claim Free Hero
            setStatus('minting');
            setStatusMessage('Claiming Your FREE Hero... Check Wallet');

            const hash = await rpgService.claimFreeHero(walletClient, address, tavernKeeperId, metadataUri);

            // Wait for transaction confirmation
            if (!publicClient) {
                throw new Error("Public client not available");
            }

            setStatusMessage('Waiting for confirmation...');
            const receipt = await publicClient.waitForTransactionReceipt({ hash });

            if (receipt.status === 'reverted') {
                throw new Error("Free hero claim transaction failed. The free hero may have already been claimed, or there was an error.");
            }

            setStatus('success');
            setStatusMessage('Free Hero Claimed Successfully!');

            // Update state to reflect that free hero is now claimed
            setHasUnclaimedFreeHero(false);

            if (onSuccess) onSuccess();

        } catch (e: any) {
            console.error('Free hero claim error:', e);
            setStatus('error');
            setError(e.message || 'Failed to claim free hero');
        }
    };

    const handleMint = async () => {
        if (!address || !walletClient || !heroData.name) return;

        // Clear any previous errors when retrying
        setError(null);
        setStatus('uploading');
        setStatusMessage('Preparing Hero Metadata...');

        try {
            // Using walletClient from wagmi directly


            // 1. Generate sprite and upload image separately to IPFS (with retries)
            setStatusMessage('Uploading hero image...');
            const imageDataUri = generateSpriteURI(heroData.heroClass as HeroClass, heroData.colors, false);
            let imageHttpUrl: string;
            try {
                imageHttpUrl = await metadataStorage.uploadImageFromDataUri(
                    imageDataUri,
                    `hero-${heroData.name.toLowerCase().replace(/\s+/g, '-')}.png`,
                    3, // 3 retry attempts
                    true // throw on failure so user knows
                );
            } catch (error) {
                // If image upload fails after retries, throw error so user can retry
                throw new Error(`Failed to upload image after retries: ${(error as Error).message}. Please try again.`);
            }

            // 2. Upload Metadata with HTTP URL reference
            setStatusMessage('Uploading metadata...');
            const metadata = {
                name: heroData.name,
                description: `A brave ${heroData.heroClass} adventurer.`,
                image: imageHttpUrl,
                attributes: [
                    { trait_type: 'Class', value: heroData.heroClass },
                    { trait_type: 'Level', value: 1 },
                ],
                hero: {
                    class: heroData.heroClass,
                    colorPalette: heroData.colors,
                    spriteSheet: heroData.heroClass.toLowerCase(),
                    animationFrames: {
                        idle: [0, 1, 2, 3],
                        walk: [4, 5, 6, 7],
                        emote: [8],
                        talk: [9, 10],
                    },
                },
            };
            const metadataUri = await uploadMetadata(metadata);

            // 2. Get fresh price signature (in case price changed)
            if (!priceSignature) {
                throw new Error('Price signature not available. Please refresh and try again.');
            }

            // Check if signature is still valid (not expired)
            const deadline = BigInt(priceSignature.deadline);
            const now = BigInt(Math.floor(Date.now() / 1000));
            if (now >= deadline) {
                // Signature expired, fetch new one
                const newSig = await rpgService.getPriceSignature('adventurer', 1, address);
                setPriceSignature(newSig);
                if (BigInt(newSig.deadline) <= now) {
                    throw new Error('Price signature expired. Please try again.');
                }
            }

            // 3. Mint Hero to TBA with signature
            setStatus('minting');
            setStatusMessage(`Recruiting Hero ($${priceSignature.usdPrice.toFixed(2)} = ${priceSignature.amount} MON)... Check Wallet`);

            const hash = await rpgService.mintHero(walletClient, address, tbaAddress, metadataUri, 1);

            // Wait for transaction confirmation
            if (!publicClient) {
                throw new Error("Public client not available");
            }

            setStatusMessage('Waiting for confirmation...');
            const receipt = await publicClient.waitForTransactionReceipt({ hash });

            if (receipt.status === 'reverted') {
                throw new Error("Hero recruitment transaction failed. Please check your wallet and try again.");
            }

            setStatus('success');
            setStatusMessage(`Hero Recruited! Tx: ${hash}`);

            if (onSuccess) onSuccess();

        } catch (e: any) {
            console.error('Paid hero mint error:', e);
            setStatus('error');

            // Check if user rejected the transaction
            const errorMessage = e?.message || e?.toString() || 'Unknown error';
            const isUserRejection = errorMessage.includes('User rejected') ||
                                   errorMessage.includes('User denied') ||
                                   errorMessage.includes('user rejected') ||
                                   e?.name === 'UserRejectedRequestError';

            if (isUserRejection) {
                setError('Transaction cancelled. You can try again when ready.');
            } else {
                setError(errorMessage);
            }
        }
    };

    if (status === 'success') {
        return (
            <ForgePanel title="Recruitment Successful!" variant="paper" className="text-center max-w-md mx-auto">
                <h2 className="text-xl font-bold text-green-800 mb-4">Welcome to the Party!</h2>
                <p className="text-amber-900 mb-6">{heroData.name} has joined your ranks.</p>
                <ForgeButton onClick={onSuccess} className="w-full">Return to Party</ForgeButton>
            </ForgePanel>
        );
    }

    return (
        <div className="w-full max-w-4xl mx-auto">
            {/* Tabs */}
            <div className="flex border-b-4 border-[#5c3a1e] mb-6">
                <button
                    onClick={() => setActiveTab('design')}
                    className={`flex-1 py-3 text-center font-bold uppercase tracking-wider transition-colors ${activeTab === 'design'
                        ? 'bg-[#8b5a2b] text-[#fcdfa6]'
                        : 'bg-[#2a1d17] text-[#8b7355] hover:bg-[#3e2613]'
                        }`}
                >
                    1. Design Hero
                </button>
                <button
                    onClick={() => setActiveTab('recruit')}
                    className={`flex-1 py-3 text-center font-bold uppercase tracking-wider transition-colors ${activeTab === 'recruit'
                        ? 'bg-[#8b5a2b] text-[#fcdfa6]'
                        : 'bg-[#2a1d17] text-[#8b7355] hover:bg-[#3e2613]'
                        }`}
                >
                    2. Recruit
                </button>
            </div>

            {/* Content */}
            <div className="min-h-[500px]">
                {activeTab === 'design' && (
                    <div className="animate-fade-in">
                        <div className="mb-4 flex justify-between items-center">
                            <div>
                                <h2 className="text-xl text-yellow-400 drop-shadow-md mb-1">Recruit New Hero</h2>
                                <p className="text-[#d4c5b0] text-xs">Design a new adventurer for your party.</p>
                            </div>
                            {onCancel && (
                                <button onClick={onCancel} className="text-[#d4c5b0] hover:text-white text-xs underline">
                                    Cancel
                                </button>
                            )}
                        </div>
                        <HeroEditor
                            initialData={heroData}
                            onChange={setHeroData}
                        />
                        <div className="mt-8 flex justify-center">
                            <ForgeButton
                                onClick={() => setActiveTab('recruit')}
                                className="w-full max-w-md py-4 text-lg"
                            >
                                Next: Review Contract &rarr;
                            </ForgeButton>
                        </div>
                    </div>
                )}

                {activeTab === 'recruit' && (
                    <div className="animate-fade-in max-w-md mx-auto">
                        {/* Free Hero Banner */}
                        {checkingFreeHero ? (
                            <div className="mb-6 text-center bg-[#2a1d17]/50 p-4 rounded border border-[#5c3a1e]">
                                <p className="text-sm text-yellow-200">Checking for free hero claim...</p>
                            </div>
                        ) : hasUnclaimedFreeHero && tavernKeeperId ? (
                            <div className="mb-6 bg-gradient-to-r from-green-900/50 to-emerald-900/50 border-2 border-green-500 p-6 rounded-lg">
                                <div className="text-center mb-4">
                                    <h3 className="text-2xl font-bold text-green-400 mb-2">🎁 FREE HERO AVAILABLE!</h3>
                                    <p className="text-[#d4c5b0] text-sm">
                                        You have an unclaimed free hero from your TavernKeeper NFT. Claim it now - no cost!
                                    </p>
                                </div>
                                <ForgeButton
                                    onClick={handleClaimFreeHero}
                                    disabled={status !== 'idle' && status !== 'error' || !heroData.name}
                                    className="w-full py-4 text-lg bg-green-600 hover:bg-green-700"
                                >
                                    {status === 'idle' || status === 'error' ? 'Claim FREE Hero' : 'Processing...'}
                                </ForgeButton>
                                {status !== 'idle' && status !== 'error' && (
                                    <div className="mt-4 text-center bg-[#2a1d17]/50 p-4 rounded border border-[#5c3a1e]">
                                        <p className="text-sm text-yellow-200 animate-pulse">{statusMessage}</p>
                                    </div>
                                )}
                                {error && (
                                    <div className="mt-4 bg-red-900/50 border border-red-500 p-4 rounded text-center">
                                        <p className="text-sm text-red-200">{error}</p>
                                    </div>
                                )}
                                <div className="mt-4 pt-4 border-t border-green-700/50">
                                    <button
                                        onClick={() => {
                                            setHasUnclaimedFreeHero(false);
                                            // Fetch price for paid recruitment
                                            if (address) {
                                                rpgService.getPriceSignature('adventurer', 1, address).then(setPriceSignature).catch(console.error);
                                            }
                                        }}
                                        className="w-full text-[#8b7355] hover:text-[#d4c5b0] text-sm underline"
                                    >
                                        Or recruit a paid hero instead →
                                    </button>
                                </div>
                            </div>
                        ) : null}

                        <div className="mb-6 text-center">
                            <h2 className="text-2xl text-yellow-400 drop-shadow-md mb-2">Review Contract</h2>
                            <p className="text-[#d4c5b0]">Sign the contract to recruit this hero.</p>
                        </div>

                        <ForgePanel title={hasUnclaimedFreeHero ? "Paid Recruitment Cost" : "Recruitment Cost"} variant="wood">
                            <div className="space-y-4 p-4">
                                <div className="flex justify-between items-center text-[#d4c5b0]">
                                    <span>Hero Name</span>
                                    <span className="font-bold text-[#fcdfa6]">{heroData.name || 'Unknown'}</span>
                                </div>
                                <div className="flex justify-between items-center text-[#d4c5b0]">
                                    <span>Class</span>
                                    <span className="font-bold text-[#fcdfa6]">{heroData.heroClass}</span>
                                </div>

                                <div className="border-t border-[#5c3a1e] my-4" />

                                <div className="flex justify-between text-sm text-[#d4c5b0]">
                                    <span>Signing Bonus (Tier 1)</span>
                                    <span className="text-yellow-400">
                                        {priceSignature ? `$${priceSignature.usdPrice.toFixed(2)} (~${priceSignature.amount} MON)` : 'Loading...'}
                                    </span>
                                </div>
                                {priceSignature && (
                                    <div className="text-[10px] text-[#8b7355] pl-2">
                                        MON @ ${priceSignature.monPrice.toFixed(5)} = {priceSignature.amount} MON
                                    </div>
                                )}
                                <div className="border-t border-[#5c3a1e] my-4" />
                                <div className="flex justify-between font-bold text-xl text-[#fcdfa6]">
                                    <span>Total</span>
                                    <span>{priceSignature ? `$${priceSignature.usdPrice.toFixed(2)} (~${priceSignature.amount} MON)` : '...'}</span>
                                </div>

                                {/* Balance Display */}
                                <div className="mt-2 text-right text-xs text-[#8b7355]">
                                    Wallet Balance: {balance ? `${parseFloat(formatEther(balance.value)).toFixed(4)} ${balance.symbol}` : 'Loading...'}
                                </div>
                            </div>

                            <div className="mt-8 space-y-4">
                                <ForgeButton
                                    onClick={handleMint}
                                    disabled={status !== 'idle' && status !== 'error' || !priceSignature || !heroData.name}
                                    className="w-full py-4 text-lg"
                                >
                                    {status === 'idle' || status === 'error' ? 'Recruit Hero' : 'Processing...'}
                                </ForgeButton>

                                {status !== 'idle' && (
                                    <div className="text-center bg-[#2a1d17]/50 p-4 rounded border border-[#5c3a1e]">
                                        <p className="text-sm text-yellow-200 animate-pulse">{statusMessage}</p>
                                    </div>
                                )}

                                {error && (
                                    <div className="bg-red-900/50 border border-red-500 p-4 rounded text-center">
                                        <p className="text-sm text-red-200">{error}</p>
                                    </div>
                                )}

                                <button
                                    onClick={() => setActiveTab('design')}
                                    className="w-full text-[#8b7355] hover:text-[#d4c5b0] text-sm underline"
                                >
                                    &larr; Back to Design
                                </button>
                            </div>
                        </ForgePanel>
                    </div>
                )}
            </div>
        </div>
    );
}
