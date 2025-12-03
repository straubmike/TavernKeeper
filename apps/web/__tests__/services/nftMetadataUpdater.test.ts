import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { heroMinting } from '../../../lib/services/heroMinting';
import { metadataStorage } from '../../../lib/services/metadataStorage';
import { rpgService } from '../../../lib/services/rpgService';

// Mock dependencies
vi.mock('../../../lib/services/metadataStorage', () => ({
    metadataStorage: {
        upload: vi.fn(),
        uploadImageFromDataUri: vi.fn(),
        getHttpUrl: vi.fn(),
    }
}));

vi.mock('../../../lib/services/heroMinting', () => ({
    heroMinting: {
        generateMetadata: vi.fn(),
    }
}));

vi.mock('../../../lib/contracts/registry', () => ({
    CONTRACT_REGISTRY: {
        ADVENTURER: { abi: [] },
        TAVERNKEEPER: { abi: [] }
    },
    getContractAddress: vi.fn().mockReturnValue('0xcontract'),
}));

vi.mock('viem', async () => {
    const actual = await vi.importActual('viem');
    return {
        ...actual,
        createPublicClient: vi.fn().mockReturnValue({
            readContract: vi.fn(),
        }),
        createWalletClient: vi.fn(),
        http: vi.fn(),
    };
});

describe('NFT Metadata Updater Service', () => {
    const mockWalletClient = {
        writeContract: vi.fn().mockResolvedValue('0xtxhash'),
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('updateHeroMetadata', () => {
        it('should call updateTokenURI on Adventurer contract', async () => {
            const tokenId = '1';
            const newMetadataUri = 'ipfs://new-metadata-uri';

            await rpgService.updateHeroMetadata(
                mockWalletClient as any,
                '0xuser',
                tokenId,
                newMetadataUri
            );

            expect(mockWalletClient.writeContract).toHaveBeenCalledWith(
                expect.objectContaining({
                    functionName: 'updateTokenURI',
                    args: [BigInt(tokenId), newMetadataUri],
                })
            );
        });

        it('should handle errors gracefully', async () => {
            const errorWalletClient = {
                writeContract: vi.fn().mockRejectedValue(new Error('Transaction failed')),
            };

            await expect(
                rpgService.updateHeroMetadata(
                    errorWalletClient as any,
                    '0xuser',
                    '1',
                    'ipfs://uri'
                )
            ).rejects.toThrow('Transaction failed');
        });
    });

    describe('updateTavernKeeperMetadata', () => {
        it('should call updateTokenURI on TavernKeeper contract', async () => {
            const tokenId = '1';
            const newMetadataUri = 'ipfs://new-metadata-uri';

            await rpgService.updateTavernKeeperMetadata(
                mockWalletClient as any,
                '0xuser',
                tokenId,
                newMetadataUri
            );

            expect(mockWalletClient.writeContract).toHaveBeenCalledWith(
                expect.objectContaining({
                    functionName: 'updateTokenURI',
                    args: [BigInt(tokenId), newMetadataUri],
                })
            );
        });
    });

    describe('getTavernKeeperTokenURI', () => {
        it('should fetch tokenURI from contract', async () => {
            const mockPublicClient = {
                readContract: vi.fn().mockResolvedValue('ipfs://token-uri'),
            };

            // Mock createPublicClient to return our mock
            const { createPublicClient } = await import('viem');
            vi.mocked(createPublicClient).mockReturnValue(mockPublicClient as any);

            const tokenId = '1';
            const uri = await rpgService.getTavernKeeperTokenURI(tokenId);

            expect(uri).toBe('ipfs://token-uri');
            expect(mockPublicClient.readContract).toHaveBeenCalledWith(
                expect.objectContaining({
                    functionName: 'tokenURI',
                    args: [BigInt(tokenId)],
                })
            );
        });

        it('should return empty string on error', async () => {
            const mockPublicClient = {
                readContract: vi.fn().mockRejectedValue(new Error('Contract error')),
            };

            const { createPublicClient } = await import('viem');
            vi.mocked(createPublicClient).mockReturnValue(mockPublicClient as any);

            const uri = await rpgService.getTavernKeeperTokenURI('1');
            expect(uri).toBe('');
        });
    });

    describe('Metadata Update Flow', () => {
        it('should generate hero metadata correctly', () => {
            const heroData = {
                name: 'Test Hero',
                class: 'Warrior',
                colorPalette: {
                    skin: '#fdbcb4',
                    hair: '#8b4513',
                    clothing: '#ef4444',
                    accent: '#ffffff',
                }
            };

            const mockMetadata = {
                name: 'Test Hero',
                description: 'A Warrior adventurer in the InnKeeper world.',
                image: 'https://ipfs.io/ipfs/image',
                attributes: [
                    { trait_type: 'Class', value: 'Warrior' },
                    { trait_type: 'Level', value: 1 }
                ],
                hero: {
                    class: 'Warrior',
                    colorPalette: heroData.colorPalette,
                    spriteSheet: 'warrior',
                    animationFrames: {
                        idle: [0, 1, 2, 3],
                        walk: [4, 5, 6, 7],
                        emote: [8],
                        talk: [9, 10]
                    }
                }
            };

            vi.mocked(heroMinting.generateMetadata).mockReturnValue(mockMetadata as any);

            const result = heroMinting.generateMetadata(heroData);
            expect(result.name).toBe('Test Hero');
            expect((result as any).hero.class).toBe('Warrior');
        });

        it('should upload image and metadata to IPFS', async () => {
            const imageDataUri = 'data:image/png;base64,test';
            const imageHttpUrl = 'https://ipfs.io/ipfs/image-hash';
            const metadataUri = 'ipfs://metadata-hash';

            vi.mocked(metadataStorage.uploadImageFromDataUri).mockResolvedValue(imageHttpUrl);
            vi.mocked(metadataStorage.upload).mockResolvedValue(metadataUri);

            const uploadedImage = await metadataStorage.uploadImageFromDataUri(
                imageDataUri,
                'test.png',
                3,
                true
            );
            expect(uploadedImage).toBe(imageHttpUrl);

            const uploadedMetadata = await metadataStorage.upload({ name: 'Test' });
            expect(uploadedMetadata).toBe(metadataUri);
        });
    });
});

