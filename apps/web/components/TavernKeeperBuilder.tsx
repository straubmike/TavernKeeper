'use client';

import { useEffect, useState } from 'react';
import { formatEther } from 'viem';
import { useAccount, usePublicClient, useWalletClient } from 'wagmi';
import { monad } from '../lib/chains';
import { uploadMetadata } from '../lib/services/heroMinting';
import { metadataStorage } from '../lib/services/metadataStorage';
import { getMonPrice } from '../lib/services/monPriceService';
import { rpgService } from '../lib/services/rpgService';
import { DEFAULT_COLORS, Gender, GENDERS, generateSpriteURI, HeroColors } from '../lib/services/spriteService';
import { ForgeButton, ForgePanel } from './heroes/ForgeComponents';
import { SpritePreview } from './heroes/SpritePreview';

export default function TavernKeeperBuilder({ onSuccess }: { onSuccess?: () => void }) {
    const { address } = useAccount();
    const { data: walletClient } = useWalletClient();
    const publicClient = usePublicClient();
    const [balance, setBalance] = useState<{ value: bigint; decimals: number; symbol: string } | null>(null);

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

    const [gender, setGender] = useState<Gender>('Male');
    const [name, setName] = useState('');
    const [colors, setColors] = useState<HeroColors>({ ...DEFAULT_COLORS, clothing: '#22c55e' }); // Default keeper green

    const [activeTab, setActiveTab] = useState<'design' | 'mint'>('design');
    const [status, setStatus] = useState<'idle' | 'uploading' | 'minting_keeper' | 'claiming_hero' | 'success' | 'error'>('idle');
    const [statusMessage, setStatusMessage] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [monAmount, setMonAmount] = useState<number>(0);
    const [monPriceUsd, setMonPriceUsd] = useState<number>(0.03);
    const [usdPrice] = useState<number>(1.00); // Tier 1 = $1
    const [isWhitelisted, setIsWhitelisted] = useState<boolean>(false);
    const [hasWhitelistMinted, setHasWhitelistMinted] = useState<boolean>(false);

    // Calculate price display from MON/USD rate (no signature needed for display)
    useEffect(() => {
        const calculatePrice = async () => {
            try {
                const price = await getMonPrice();
                setMonPriceUsd(price);
                const calculatedMon = usdPrice / price;
                setMonAmount(calculatedMon);
            } catch (e) {
                console.error('Failed to fetch MON price:', e);
                setMonAmount(0);
            }
        };
        calculatePrice();
        const interval = setInterval(calculatePrice, 60000); // Update every minute
        return () => clearInterval(interval);
    }, [usdPrice]);

    // Check whitelist status
    useEffect(() => {
        if (!address) {
            setIsWhitelisted(false);
            setHasWhitelistMinted(false);
            return;
        }

        const checkWhitelist = async () => {
            try {
                const whitelisted = await rpgService.isWhitelisted('tavernkeeper', address);
                const minted = await rpgService.hasWhitelistMinted('tavernkeeper', address);
                setIsWhitelisted(whitelisted);
                setHasWhitelistMinted(minted);
            } catch (error) {
                console.error('Failed to check whitelist status:', error);
            }
        };

        checkWhitelist();
        const interval = setInterval(checkWhitelist, 30000); // Check every 30s
        return () => clearInterval(interval);
    }, [address]);

    const handleColorChange = (part: keyof HeroColors, color: string) => {
        setColors(prev => ({ ...prev, [part]: color }));
    };

    const handleMint = async () => {
        if (!address || !walletClient || !name) return;

        // Clear any previous errors when retrying
        setError(null);
        setStatus('uploading');
        setStatusMessage('Preparing Tavern Keeper Metadata...');

        try {
            // using walletClient from wagmi

            // 1. Generate sprite and upload image separately to IPFS (with retries)
            setStatusMessage('Uploading Tavern Keeper image...');
            const imageDataUri = generateSpriteURI(gender, colors, true);
            let imageHttpUrl: string;
            try {
                imageHttpUrl = await metadataStorage.uploadImageFromDataUri(
                    imageDataUri,
                    `tavern-keeper-${name.toLowerCase().replace(/\s+/g, '-')}.png`,
                    3, // 3 retry attempts
                    true // throw on failure so user knows
                );
            } catch (error) {
                // If image upload fails after retries, throw error so user can retry the whole flow
                throw new Error(`Failed to upload image after retries: ${(error as Error).message}. Please try again.`);
            }

            // 2. Upload Metadata with HTTP URL reference
            setStatusMessage('Uploading metadata...');
            const metadata = {
                name: name,
                description: `The Keeper of the Tavern. Style: ${gender}.`,
                image: imageHttpUrl,
                attributes: [
                    { trait_type: 'Gender', value: gender },
                    { trait_type: 'Role', value: 'Tavern Keeper' },
                    { trait_type: 'Level', value: 1 },
                ],
                keeper: {
                    gender: gender,
                    colorPalette: colors,
                    spriteSheet: gender.toLowerCase(),
                    animationFrames: {
                        idle: [0, 1],
                        walk: [0, 1, 2, 3],
                        emote: [0, 1, 2, 3],
                    },
                },
            };
            const metadataUri = await uploadMetadata(metadata);

            // 2. Mint Tavern Keeper (mintTavernKeeper fetches signature internally)
            setStatus('minting_keeper');
            setStatusMessage(`Minting Tavern Keeper License (${monAmount > 0 ? monAmount.toFixed(2) : '~' + (1.00 / monPriceUsd).toFixed(2)} MON = $${usdPrice.toFixed(2)})... Check Wallet`);

            const hash1 = await rpgService.mintTavernKeeper(walletClient, address, metadataUri, 1);
            setStatusMessage(`Tavern Keeper Minted! Tx: ${hash1}`);

            setStatusMessage('Waiting for confirmation...');

            // Wait for token to appear
            let tokenId = '';
            let retries = 0;
            while (!tokenId && retries < 15) {
                await new Promise(r => setTimeout(r, 2000));
                const keepers = await rpgService.getUserTavernKeepers(address);
                if (keepers.length > 0) {
                    // Take the last one as the new one
                    tokenId = keepers[keepers.length - 1].tokenId;
                }
                retries++;
            }

            if (!tokenId) throw new Error("Failed to detect new Tavern Keeper. Please check your wallet.");

            // 3. Claim Free Hero
            setStatus('claiming_hero');
            setStatusMessage('Recruiting First Hero... Check Wallet');

            const hash2 = await rpgService.claimFreeHero(walletClient, address, tokenId, metadataUri);

            setStatus('success');
            setStatusMessage('Tavern Established! Hero Recruited.');

            if (onSuccess) onSuccess();

        } catch (e) {
            console.error(e);
            setStatus('error');
            setError((e as Error).message);
        }
    };

    const handleWhitelistMint = async () => {
        if (!address || !walletClient || !name) return;

        // Clear any previous errors when retrying
        setError(null);
        setStatus('uploading');
        setStatusMessage('Preparing Tavern Keeper Metadata...');

        try {
            // using walletClient from wagmi

            // 1. Upload Metadata
            const metadata = {
                name: name,
                description: `Tavern Keeper License #${Date.now()}`,
                image: generateSpriteURI(gender, colors, true),
                attributes: [
                    { trait_type: "Gender", value: gender },
                    { trait_type: "Clothing Color", value: colors.clothing },
                ],
            };
            const metadataUri = await uploadMetadata(metadata);

            // 2. Mint Tavern Keeper (whitelist - free)
            setStatus('minting_keeper');
            setStatusMessage('Minting Tavern Keeper License (FREE - Whitelist)... Check Wallet');

            const hash1 = await rpgService.mintTavernKeeperWhitelist(walletClient, address, metadataUri);
            setStatusMessage(`Tavern Keeper Minted! Tx: ${hash1}`);

            setStatusMessage('Waiting for confirmation...');

            // Wait for token to appear
            let tokenId = '';
            let retries = 0;
            while (!tokenId && retries < 15) {
                await new Promise(r => setTimeout(r, 2000));
                const keepers = await rpgService.getUserTavernKeepers(address);
                if (keepers.length > 0) {
                    // Take the last one as the new one
                    tokenId = keepers[keepers.length - 1].tokenId;
                }
                retries++;
            }

            if (!tokenId) throw new Error("Failed to detect new Tavern Keeper. Please check your wallet.");

            // 3. Claim Free Hero
            setStatus('claiming_hero');
            setStatusMessage('Recruiting First Hero... Check Wallet');

            const hash2 = await rpgService.claimFreeHero(walletClient, address, tokenId, metadataUri);

            setStatus('success');
            setStatusMessage('Tavern Established! Hero Recruited.');

            if (onSuccess) onSuccess();

        } catch (e) {
            console.error(e);
            setStatus('error');
            setError((e as Error).message);
        }
    };

    if (status === 'success') {
        return (
            <ForgePanel title="Success!" variant="paper" className="text-center max-w-md mx-auto">
                <h2 className="text-xl font-bold text-green-800 mb-4">Tavern Established!</h2>
                <p className="text-amber-900 mb-6">Your Tavern Keeper is ready for business.</p>
                <ForgeButton onClick={onSuccess} className="w-full">Enter Tavern</ForgeButton>
            </ForgePanel>
        );
    }

    return (
        <div className="w-full max-w-4xl mx-auto">
            {/* Tabs - Matching demo styling */}
            <div className="flex border-b-4 border-[#5c3a1e] mb-6">
                <button
                    onClick={() => setActiveTab('design')}
                    className={`flex-1 py-3 text-center font-bold uppercase tracking-wider text-xs transition-colors ${activeTab === 'design'
                        ? 'bg-[#8b5a2b] text-[#fcdfa6]'
                        : 'bg-[#2a1d17] text-[#8b7355] hover:bg-[#3e2613]'
                        }`}
                >
                    1. Design Keeper
                </button>
                <button
                    onClick={() => setActiveTab('mint')}
                    className={`flex-1 py-3 text-center font-bold uppercase tracking-wider text-xs transition-colors ${activeTab === 'mint'
                        ? 'bg-[#8b5a2b] text-[#fcdfa6]'
                        : 'bg-[#2a1d17] text-[#8b7355] hover:bg-[#3e2613]'
                        }`}
                >
                    2. Establish Tavern
                </button>
            </div>

            {/* Content */}
            <div className="min-h-[500px]">
                {activeTab === 'design' && (
                    <div className="animate-fade-in">
                        <div className="mb-6 text-center">
                            <h2 className="text-2xl text-yellow-400 drop-shadow-md mb-2">Design Your Tavern Keeper</h2>
                            <p className="text-[#d4c5b0]">Customize the appearance of your digital avatar.</p>
                        </div>

                        {/* Custom Keeper Editor - Mobile-first stacked layout */}
                        <div className="space-y-6 max-w-md mx-auto">
                            <ForgePanel title="Identity" variant="wood">
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-[10px] text-[#d4c5b0] mb-1 uppercase font-bold tracking-wider">Name</label>
                                        <input
                                            type="text"
                                            value={name}
                                            onChange={(e) => setName(e.target.value)}
                                            className="w-full bg-[#3e2613] border-b-2 border-[#5c3a1e] py-2 font-pixel text-[#fcdfa6] focus:outline-none focus:border-amber-500 placeholder-[#5c3a1e]"
                                            placeholder="Keeper Name..."
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] text-[#d4c5b0] mb-2 uppercase font-bold tracking-wider">Appearance</label>
                                        <div className="flex gap-2">
                                            {GENDERS.map(g => (
                                                <button
                                                    key={g}
                                                    onClick={() => setGender(g)}
                                                    className={`flex-1 py-2 text-[10px] font-bold uppercase border-2 transition-all ${gender === g
                                                        ? 'bg-amber-600 border-amber-800 text-white'
                                                        : 'bg-[#3e2613] border-[#1e1209] text-[#8b7355] hover:bg-[#4e3019]'
                                                        }`}
                                                >
                                                    {g}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </ForgePanel>

                            <ForgePanel title="Palette" variant="wood">
                                <div className="grid grid-cols-2 gap-3">
                                    {Object.entries(colors).map(([part, color]) => (
                                        <div key={part} className="flex items-center gap-2 bg-[#1e1209] p-2 border border-[#3e2613]">
                                            <input
                                                type="color"
                                                value={color}
                                                onChange={(e) => handleColorChange(part as keyof HeroColors, e.target.value)}
                                                className="w-6 h-6 p-0 border-0 bg-transparent cursor-pointer"
                                            />
                                            <span className="text-[10px] text-[#8b7b63] uppercase">{part}</span>
                                        </div>
                                    ))}
                                </div>
                            </ForgePanel>
                        </div>

                        {/* Preview with decorative frame (matching demo style) */}
                        <div className="mt-6 flex justify-center">
                            <ForgePanel title="Preview" variant="paper" className="w-full max-w-md flex flex-col items-center justify-center min-h-[350px]">
                                <div className="relative p-8 w-full flex flex-col items-center">
                                    <SpritePreview
                                        type={gender}
                                        colors={colors}
                                        isKeeper={true}
                                        scale={5}
                                        showFrame={true}
                                        name={name || 'Unknown Keeper'}
                                        subtitle="Proprietor"
                                    />
                                </div>
                            </ForgePanel>
                        </div>

                        <div className="mt-8 flex justify-center">
                            <ForgeButton
                                onClick={() => setActiveTab('mint')}
                                className="w-full max-w-md py-4 text-lg"
                            >
                                Next: Establish Tavern &rarr;
                            </ForgeButton>
                        </div>
                    </div>
                )}

                {activeTab === 'mint' && (
                    <div className="animate-fade-in max-w-md mx-auto">
                        <div className="mb-6 text-center">
                            <h2 className="text-2xl text-yellow-400 drop-shadow-md mb-2">Establish Tavern</h2>
                            <p className="text-[#d4c5b0]">Mint your license to start your journey.</p>
                        </div>

                        <ForgePanel title="Confirm Tavern Details" variant="wood">
                            <div className="space-y-4 mb-6">
                                <div className="flex justify-between text-[#d4c5b0] text-sm">
                                    <span>Proprietor:</span>
                                    <span className="text-[#fcdfa6] font-bold">{name || 'Unknown'}</span>
                                </div>
                                <div className="flex justify-between text-[#d4c5b0] text-sm">
                                    <span>Style:</span>
                                    <span className="text-[#fcdfa6] font-bold">{gender}</span>
                                </div>
                                <div className="border-t border-[#5c3a1e] my-4" />
                                <div className="space-y-2 bg-[#1e1209] p-3 rounded border border-[#3e2613]">
                                    <div className="flex justify-between text-sm text-[#d4c5b0]">
                                        <span>Price (Tier 1):</span>
                                        <span className="font-bold">
                                            {monAmount > 0 ? (
                                                <>
                                                    <span className="text-purple-400">{monAmount.toFixed(2)} MON</span>
                                                    <span className="text-[#d4c5b0]"> (~</span>
                                                    <span className="text-green-400">${usdPrice.toFixed(2)}</span>
                                                    <span className="text-[#d4c5b0]">)</span>
                                                </>
                                            ) : (
                                                <span className="text-yellow-400">Calculating...</span>
                                            )}
                                        </span>
                                    </div>
                                    <div className="text-[10px] pl-2">
                                        <span className="text-purple-400">{monAmount > 0 ? monAmount.toFixed(2) : '0.00'} MON</span>
                                        <span className="text-[#8b7355]"> @ </span>
                                        <span className="text-green-400">${monPriceUsd.toFixed(5)}</span>
                                        <span className="text-[#8b7355]"> = </span>
                                        <span className="text-purple-400">{monAmount > 0 ? monAmount.toFixed(2) : '0.00'} MON</span>
                                    </div>
                                </div>
                                <div className="text-xs text-center mt-2 p-2 rounded bg-[#2a1d17] border border-[#5c3a1e]">
                                    <span className="text-green-400 font-bold">✓ Real-time pricing</span>
                                    <div className="text-[#8b7355] text-[10px] mt-1">
                                        Price updates based on MON/USD rate
                                    </div>
                                </div>
                                <div className="flex justify-between text-sm text-[#d4c5b0]">
                                    <span>First Hero Recruitment</span>
                                    <span className="text-green-400">FREE</span>
                                </div>
                                <div className="border-t border-[#5c3a1e] my-4" />
                                <div className="flex justify-between font-bold text-xl text-[#fcdfa6]">
                                    <span>Total</span>
                                    <span>
                                        {monAmount > 0 ? (
                                            <>
                                                <span className="text-purple-400">{monAmount.toFixed(2)} MON</span>
                                                <span className="text-[#fcdfa6]"> (~</span>
                                                <span className="text-green-400">${usdPrice.toFixed(2)}</span>
                                                <span className="text-[#fcdfa6]">)</span>
                                            </>
                                        ) : (
                                            <span>Calculating...</span>
                                        )}
                                    </span>
                                </div>
                                {/* Balance Display */}
                                <div className="mt-2 text-right text-xs text-[#8b7355]">
                                    Wallet Balance: {balance ? `${parseFloat(formatEther(balance.value)).toFixed(4)} ${balance.symbol}` : 'Loading...'}
                                </div>
                            </div>

                            <div className="mt-8 space-y-4">
                                {isWhitelisted && !hasWhitelistMinted ? (
                                    <>
                                        <ForgeButton
                                            onClick={handleWhitelistMint}
                                            disabled={(status !== 'idle' && status !== 'error') || !name}
                                            className="w-full py-4 text-lg bg-green-600 hover:bg-green-700"
                                        >
                                            {status === 'idle' || status === 'error' ? 'Mint FREE (Whitelist)' : 'Processing...'}
                                        </ForgeButton>
                                        <div className="text-center text-xs text-green-400 mb-2">
                                            You're whitelisted! Free mint available.
                                        </div>
                                        <div className="border-t border-[#5c3a1e] my-2" />
                                        <div className="text-center text-xs text-[#8b7355] mb-2">
                                            Or pay to mint:
                                        </div>
                                    </>
                                ) : null}
                                <ForgeButton
                                    onClick={handleMint}
                                    disabled={(status !== 'idle' && status !== 'error') || !name}
                                    className="w-full py-4 text-lg"
                                >
                                    {status === 'idle' || status === 'error' ? 'Mint & Start' : 'Processing...'}
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
                                    className="w-full text-center text-[#8b7b63] text-xs mt-4 hover:text-[#d4c5b0]"
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
