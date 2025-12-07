'use client';

import { useEffect, useState } from 'react';
import { useAccount, useWalletClient } from 'wagmi';
import { HeroMetadata, heroMinting } from '../lib/services/heroMinting';
import { metadataStorage } from '../lib/services/metadataStorage';
import { rpgService } from '../lib/services/rpgService';
import { DEFAULT_COLORS, Gender, GENDERS, generateSpriteURI, HERO_CLASSES, HeroClass, HeroColors } from '../lib/services/spriteService';
import { PixelButton, PixelPanel } from './PixelComponents';
import { SpritePreview } from './heroes/SpritePreview';

interface NFTMetadataUpdaterProps {
    tokenId: string;
    tokenUri: string;
    contractType: 'hero' | 'tavernKeeper';
    onSuccess?: () => void;
    onCancel?: () => void;
}

interface TavernKeeperMetadata {
    name: string;
    description: string;
    image: string;
    attributes: { trait_type: string; value: string | number }[];
    keeper?: {
        gender: Gender;
        colorPalette: HeroColors;
        spriteSheet: string;
        animationFrames: Record<string, number[]>;
    };
}

export default function NFTMetadataUpdater({
    tokenId,
    tokenUri,
    contractType,
    onSuccess,
    onCancel
}: NFTMetadataUpdaterProps) {
    const { address } = useAccount();
    const { data: walletClient } = useWalletClient();

    const [loading, setLoading] = useState(true);
    const [updating, setUpdating] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [heroClass, setHeroClass] = useState<HeroClass>('Warrior');
    const [gender, setGender] = useState<Gender>('Male');
    const [name, setName] = useState('');
    const [colors, setColors] = useState<HeroColors>(DEFAULT_COLORS);

    // Fetch current metadata
    useEffect(() => {
        const fetchMetadata = async () => {
            if (!tokenUri) {
                setError('No metadata URI available');
                setLoading(false);
                return;
            }

            try {
                // Convert IPFS URI to HTTP URL
                const url = tokenUri.startsWith('ipfs://')
                    ? tokenUri.replace('ipfs://', 'https://ipfs.io/ipfs/')
                    : tokenUri;

                const response = await fetch(url);
                if (!response.ok) {
                    throw new Error('Failed to fetch metadata');
                }

                const metadata = await response.json() as HeroMetadata | TavernKeeperMetadata;

                // Extract current values based on contract type
                setName(metadata.name || '');

                if (contractType === 'hero') {
                    const heroMeta = metadata as HeroMetadata;
                    setHeroClass((heroMeta.hero?.class as HeroClass) || 'Warrior');
                    setColors(heroMeta.hero?.colorPalette || DEFAULT_COLORS);
                } else {
                    const keeperMeta = metadata as TavernKeeperMetadata;
                    setGender((keeperMeta.keeper?.gender as Gender) || 'Male');
                    setColors(keeperMeta.keeper?.colorPalette || DEFAULT_COLORS);
                }
            } catch (err: any) {
                console.error('Error fetching metadata:', err);
                setError(err.message || 'Failed to load metadata');
            } finally {
                setLoading(false);
            }
        };

        fetchMetadata();
    }, [tokenUri, contractType]);

    const handleUpdate = async () => {
        if (!address || !walletClient || !name.trim()) {
            setError('Please fill in all required fields');
            return;
        }

        setUpdating(true);
        setError(null);

        try {
            let imageDataUri: string;
            let metadata: Record<string, unknown>;

            if (contractType === 'hero') {
                // 1. Generate hero sprite image
                imageDataUri = generateSpriteURI(heroClass, colors, false);

                // 2. Upload image to IPFS
                const imageHttpUrl = await metadataStorage.uploadImageFromDataUri(
                    imageDataUri,
                    `hero-${tokenId}-${Date.now()}.png`,
                    3, // retries
                    true // throwOnFailure
                );

                // 3. Generate hero metadata
                metadata = heroMinting.generateMetadata({
                    name: name.trim(),
                    class: heroClass,
                    colorPalette: colors
                });
                metadata.image = imageHttpUrl;
            } else {
                // 1. Generate tavern keeper sprite image
                imageDataUri = generateSpriteURI(gender, colors, true);

                // 2. Upload image to IPFS
                const imageHttpUrl = await metadataStorage.uploadImageFromDataUri(
                    imageDataUri,
                    `tavern-keeper-${tokenId}-${Date.now()}.png`,
                    3, // retries
                    true // throwOnFailure
                );

                // 3. Generate tavern keeper metadata
                metadata = {
                    name: name.trim(),
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
            }

            // 4. Upload metadata to IPFS
            const newMetadataUri = await metadataStorage.upload(metadata);

            // 5. Use existing walletClient from wagmi


            // 6. Call updateTokenURI on contract
            if (contractType === 'hero') {
                await rpgService.updateHeroMetadata(walletClient, address, tokenId, newMetadataUri);
            } else {
                await rpgService.updateTavernKeeperMetadata(walletClient, address, tokenId, newMetadataUri);
            }

            // Success!
            if (onSuccess) onSuccess();
        } catch (err: any) {
            console.error('Error updating metadata:', err);
            setError(err.message || 'Failed to update metadata');
        } finally {
            setUpdating(false);
        }
    };

    if (loading) {
        return (
            <PixelPanel title="Update NFT" variant="wood" className="max-w-md">
                <div className="text-center text-[#8b7355] py-4">Loading metadata...</div>
            </PixelPanel>
        );
    }

    if (error && !name) {
        return (
            <PixelPanel title="Update NFT" variant="wood" className="max-w-md">
                <div className="text-[#ef4444] mb-4">{error}</div>
                {onCancel && (
                    <PixelButton onClick={onCancel}>Close</PixelButton>
                )}
            </PixelPanel>
        );
    }

    return (
        <PixelPanel title={`Update ${contractType === 'hero' ? 'Hero' : 'Tavern'} #${tokenId}`} variant="wood" className="max-w-md">
            <div className="space-y-4">
                {/* Preview */}
                <div className="flex justify-center">
                    {contractType === 'hero' ? (
                        <SpritePreview
                            type={heroClass}
                            colors={colors}
                            scale={3}
                            isKeeper={false}
                        />
                    ) : (
                        <SpritePreview
                            type={gender}
                            colors={colors}
                            isKeeper={true}
                            scale={3}
                            showFrame={false}
                        />
                    )}
                </div>

                {/* Name Input */}
                <div>
                    <label className="block text-sm text-[#8b7355] mb-1">Name</label>
                    <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full px-3 py-2 bg-[#1a120d] border-2 border-[#4a3b2a] text-[#eaddcf] rounded focus:border-yellow-400 focus:outline-none"
                        placeholder="Enter name"
                    />
                </div>

                {/* Class Selector (only for heroes) */}
                {contractType === 'hero' && (
                    <div>
                        <label className="block text-sm text-[#8b7355] mb-1">Class</label>
                        <select
                            value={heroClass}
                            onChange={(e) => setHeroClass(e.target.value as HeroClass)}
                            className="w-full px-3 py-2 bg-[#1a120d] border-2 border-[#4a3b2a] text-[#eaddcf] rounded focus:border-yellow-400 focus:outline-none"
                        >
                            {HERO_CLASSES.map(cls => (
                                <option key={cls} value={cls}>{cls}</option>
                            ))}
                        </select>
                    </div>
                )}

                {/* Gender Selector (only for tavern keepers) */}
                {contractType === 'tavernKeeper' && (
                    <div>
                        <label className="block text-sm text-[#8b7355] mb-1">Style</label>
                        <div className="flex gap-2">
                            {GENDERS.map(g => (
                                <button
                                    key={g}
                                    onClick={() => setGender(g)}
                                    className={`flex-1 py-2 text-xs font-bold uppercase border-2 transition-all ${gender === g
                                        ? 'bg-amber-600 border-amber-800 text-white'
                                        : 'bg-[#1a120d] border-[#4a3b2a] text-[#8b7355] hover:bg-[#2a1d17]'
                                        }`}
                                >
                                    {g}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Color Pickers */}
                <div className="space-y-2">
                    <label className="block text-sm text-[#8b7355]">Colors</label>
                    <div className="grid grid-cols-2 gap-2">
                        {Object.entries(colors).map(([key, value]) => (
                            <div key={key}>
                                <label className="block text-xs text-[#8b7355] mb-1 capitalize">{key}</label>
                                <div className="flex gap-2">
                                    <input
                                        type="color"
                                        value={value}
                                        onChange={(e) => setColors({ ...colors, [key]: e.target.value })}
                                        className="h-8 w-16 border-2 border-[#4a3b2a] rounded cursor-pointer"
                                    />
                                    <input
                                        type="text"
                                        value={value}
                                        onChange={(e) => setColors({ ...colors, [key]: e.target.value })}
                                        className="flex-1 px-2 py-1 bg-[#1a120d] border-2 border-[#4a3b2a] text-[#eaddcf] text-xs rounded focus:border-yellow-400 focus:outline-none"
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Error Message */}
                {error && (
                    <div className="text-[#ef4444] text-sm">{error}</div>
                )}

                {/* Actions */}
                <div className="flex gap-2 pt-2">
                    {onCancel && (
                        <PixelButton onClick={onCancel} variant="neutral" className="flex-1">
                            Cancel
                        </PixelButton>
                    )}
                    <PixelButton
                        onClick={handleUpdate}
                        disabled={updating || !name.trim()}
                        className="flex-1"
                    >
                        {updating ? 'Updating...' : 'Update NFT'}
                    </PixelButton>
                </div>
            </div>
        </PixelPanel>
    );
}
