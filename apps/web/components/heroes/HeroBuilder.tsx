'use client';

import { useEffect, useState } from 'react';
import { useAccount, useWalletClient } from 'wagmi';
import { monad } from '../../lib/chains';
import { mintHero, uploadMetadata } from '../../lib/services/heroMinting';
import { metadataStorage } from '../../lib/services/metadataStorage';
import { HeroClass, generateSpriteURI } from '../../lib/services/spriteService';
import { ForgeButton, ForgePanel } from './ForgeComponents';
import HeroEditor, { HeroData } from './HeroEditor';
import { SpritePreview } from './SpritePreview';

export default function HeroBuilder() {
    const { address, isConnected } = useAccount();
    const { data: walletClient } = useWalletClient();
    const authenticated = isConnected;

    const [heroData, setHeroData] = useState<HeroData>({
        name: '',
        heroClass: 'Warrior' as HeroClass,
        colors: {
            skin: '#fdbcb4',
            hair: '#8b4513',
            clothing: '#ef4444',
            accent: '#ffffff',
        }
    });

    const [isMinting, setIsMinting] = useState(false);
    const [mintStatus, setMintStatus] = useState<string | null>(null);
    const [lastMint, setLastMint] = useState<{ name: string, hash: string } | null>(null);
    const [showTutorial, setShowTutorial] = useState(false);

    useEffect(() => {
        // Show tutorial on first visit
        const hasSeenTutorial = localStorage.getItem('innkeeper_forge_tutorial_seen');
        if (!hasSeenTutorial) {
            setShowTutorial(true);
        }
    }, []);

    const closeTutorial = () => {
        setShowTutorial(false);
        localStorage.setItem('innkeeper_forge_tutorial_seen', 'true');
    };

    const handleMint = async () => {
        if (!address || !walletClient || !heroData.name) return;

        // Clear any previous errors when retrying
        setIsMinting(true);
        setMintStatus('Generating Arcane Metadata...');

        try {
            // Using walletClient from Wagmi

            // 1. Generate sprite and upload image separately to IPFS (with retries)
            setMintStatus('Uploading hero image...');
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

            // 2. Generate Metadata with HTTP URL reference
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

            // 3. Upload Metadata
            setMintStatus('Uploading metadata...');
            const metadataUri = await uploadMetadata(metadata);

            // 4. Mint Hero
            setMintStatus('Minting hero... (Please confirm in wallet)');
            const hash = await mintHero(walletClient, address, metadataUri);

            setMintStatus(`Minted! Tx: ${hash}`);
            setLastMint({ name: heroData.name, hash });

        } catch (error) {
            console.error(error);
            setMintStatus('Error minting hero');
        } finally {
            setIsMinting(false);
        }
    };

    if (lastMint) {
        return (
            <div className="max-w-md mx-auto w-full">
                <ForgePanel title="Hero Forged!" variant="paper" className="text-center animate-fade-in">
                    <div className="mb-6 flex justify-center">
                        <SpritePreview
                            type={heroData.heroClass as HeroClass}
                            colors={heroData.colors}
                            isKeeper={false}
                            scale={5}
                            showFrame={true}
                            name={lastMint.name}
                            subtitle={`Level 1 ${heroData.heroClass}`}
                        />
                    </div>
                    <p className="text-xs text-amber-600 mb-6 bg-amber-100 p-2 border border-amber-200 truncate">
                        Tx: {lastMint.hash}
                    </p>
                    <ForgeButton onClick={() => { setLastMint(null); setHeroData(prev => ({ ...prev, name: '' })); }} className="w-full">Forge Another</ForgeButton>
                </ForgePanel>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-6 w-full max-w-md mx-auto relative">

            {/* Tutorial Modal */}
            {showTutorial && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
                    <ForgePanel title="Welcome!" variant="paper" className="max-w-sm w-full shadow-2xl">
                        <div className="text-center space-y-4">
                            <p className="text-sm text-[#3e3224] leading-relaxed">
                                Welcome to the <span className="font-bold text-amber-800">InnKeeper Forge</span>!
                            </p>
                            <div className="text-xs text-[#8b7b63] space-y-2 text-left bg-[#d4c5b0]/20 p-4 rounded border border-[#8c7b63]/30">
                                <p>1. <strong>Preview</strong> your hero at the top.</p>
                                <p>2. Open <strong>Identity</strong> to set name & class.</p>
                                <p>3. Open <strong>Palette</strong> to customize colors.</p>
                                <p>4. <strong>Mint</strong> to recruit them to your party!</p>
                            </div>
                            <ForgeButton onClick={closeTutorial} className="w-full mt-4">
                                Start Forging
                            </ForgeButton>
                        </div>
                    </ForgePanel>
                </div>
            )}

            {/* Header */}
            <header className="text-center flex justify-between items-center px-2">
                <h1 className="text-2xl text-[#fcdfa6] drop-shadow-md" style={{ textShadow: '2px 2px 0px #000' }}>Hero Builder</h1>
                <button
                    onClick={() => setShowTutorial(true)}
                    className="text-[10px] text-[#8b7b63] hover:text-[#fcdfa6] underline cursor-pointer"
                >
                    Help
                </button>
            </header>

            <HeroEditor
                initialData={heroData}
                onChange={setHeroData}
            />

            <div className="w-full space-y-3 px-4 pb-2">
                <ForgeButton
                    variant="primary"
                    className="w-full text-sm py-3 shadow-lg"
                    onClick={handleMint}
                    disabled={!heroData.name || !address || isMinting}
                >
                    {isMinting ? mintStatus || 'Forging...' : 'Mint Hero (0.01 ETH)'}
                </ForgeButton>
                {mintStatus && (
                    <div className="bg-amber-100 border border-amber-300 p-2 text-center rounded">
                        <p className="text-[10px] text-amber-800 font-bold animate-pulse uppercase tracking-wide">
                            {mintStatus}
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
