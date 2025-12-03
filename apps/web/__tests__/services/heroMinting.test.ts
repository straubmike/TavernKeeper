import { describe, expect, it, vi } from 'vitest';
import { heroMinting } from '../../lib/services/heroMinting';
import { metadataStorage } from '../../lib/services/metadataStorage';

// Mock dependencies
vi.mock('../../lib/services/metadataStorage', () => ({
    metadataStorage: {
        upload: vi.fn().mockResolvedValue('ipfs://mock-uri'),
    }
}));

vi.mock('../../lib/contracts/registry', () => ({
    CONTRACT_REGISTRY: {
        ADVENTURER: { abi: [] }
    },
    getContractAddress: vi.fn().mockReturnValue('0xcontract'),
}));

vi.mock('../../lib/wallet/testnetWallet', () => ({
    createTestnetWallet: vi.fn().mockReturnValue({
        account: '0xdeployer',
        writeContract: vi.fn().mockResolvedValue('0xhash'),
    })
}));

vi.mock('viem', async () => {
    const actual = await vi.importActual('viem');
    return {
        ...actual,
        createPublicClient: vi.fn().mockReturnValue({
            waitForTransactionReceipt: vi.fn().mockResolvedValue({}),
        }),
        createWalletClient: vi.fn(),
        http: vi.fn(),
    };
});

vi.mock('../../lib/services/rpgService', () => ({
    rpgService: {
        mintHero: vi.fn().mockResolvedValue('0xhash'),
        getCurrentTier: vi.fn().mockResolvedValue(1),
        getPriceSignature: vi.fn().mockResolvedValue({
            amount: '1000000000000000000',
            amountWei: '1000000000000000000',
            deadline: '9999999999',
            signature: '0xsignature',
            monPrice: 1,
            usdPrice: 1,
            tier: 1,
        }),
    },
}));

describe('heroMinting', () => {
    describe('generateMetadata', () => {
        it('should generate correct metadata structure', () => {
            const data = {
                name: 'Hero',
                class: 'Warrior',
                colorPalette: { skin: '#fff', hair: '#000', clothing: '#f00', accent: '#0f0' }
            };

            const metadata = heroMinting.generateMetadata(data);
            expect(metadata.name).toBe('Hero');
            expect((metadata.hero as any).class).toBe('Warrior');
            expect((metadata.hero as any).colorPalette).toEqual(data.colorPalette);
        });
    });

    describe('mintHero', () => {
        it('should upload metadata and call contract', async () => {
            const data = {
                name: 'Hero',
                class: 'Warrior',
                colorPalette: { skin: '#fff', hair: '#000', clothing: '#f00', accent: '#0f0' }
            };

            const mockWalletClient = {
                account: '0xdeployer',
                writeContract: vi.fn().mockResolvedValue('0xhash'),
            };

            const hash = await heroMinting.mintHero('0xuser', data, mockWalletClient);

            expect(metadataStorage.upload).toHaveBeenCalled();
            expect(hash).toBe('0xhash');
        });
    });
});
