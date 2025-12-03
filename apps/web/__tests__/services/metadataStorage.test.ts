import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { metadataStorage } from '../../lib/services/metadataStorage';

describe('metadataStorage', () => {
    const originalEnv = process.env;

    beforeEach(() => {
        vi.resetModules();
        process.env = { ...originalEnv };
        // Clear PINATA_JWT to ensure data URI fallback
        delete process.env.PINATA_JWT;
        delete process.env.NEXT_PUBLIC_PINATA_JWT;
    });

    afterEach(() => {
        process.env = originalEnv;
    });

    describe('upload', () => {
        it('should return data URI for small metadata', async () => {
            const metadata = { name: 'Test' };
            const uri = await metadataStorage.upload(metadata);
            expect(uri).toContain('data:application/json;base64,');
        });

        it('should return ipfs URI for large metadata (mock)', async () => {
            // Mock fetch for IPFS upload
            const mockFetch = vi.fn().mockResolvedValue({
                ok: true,
                json: async () => ({ IpfsHash: 'bafkreih4hijdxnkkmxvyd2rgjxrycg5orkdpbew7f4pztup5djmbpq4vwm' }),
            } as Response);
            global.fetch = mockFetch;

            // Set PINATA_JWT to trigger IPFS upload
            const originalJwt = process.env.PINATA_JWT;
            process.env.PINATA_JWT = 'test-jwt';

            try {
                const largeData = { data: 'a'.repeat(2000) };
                const uri = await metadataStorage.upload(largeData);
                expect(uri).toContain('ipfs://');
                expect(mockFetch).toHaveBeenCalled();
            } finally {
                // Restore original JWT
                if (originalJwt) {
                    process.env.PINATA_JWT = originalJwt;
                } else {
                    delete process.env.PINATA_JWT;
                }
            }
        });
    });

    describe('getHttpUrl', () => {
        it('should convert ipfs:// to https://ipfs.io/ipfs/', () => {
            // Set the gateway to ipfs.io for this test
            const originalGateway = process.env.NEXT_PUBLIC_PINATA_GATEWAY;
            process.env.NEXT_PUBLIC_PINATA_GATEWAY = 'ipfs.io';
            try {
                const uri = 'ipfs://QmHash';
                expect(metadataStorage.getHttpUrl(uri)).toBe('https://ipfs.io/ipfs/QmHash');
            } finally {
                // Restore original gateway
                if (originalGateway) {
                    process.env.NEXT_PUBLIC_PINATA_GATEWAY = originalGateway;
                } else {
                    delete process.env.NEXT_PUBLIC_PINATA_GATEWAY;
                }
            }
        });

        it('should return http urls as is', () => {
            const uri = 'https://example.com/meta.json';
            expect(metadataStorage.getHttpUrl(uri)).toBe('https://example.com/meta.json');
        });
    });
});
