import { createPublicClient, http, parseAbiItem } from 'viem';
import { monad } from '../chains';
import { CONTRACT_REGISTRY, getContractAddress } from '../contracts/registry';
import { supabase } from '../supabase';
import { metadataStorage } from './metadataStorage';

const rpcUrl = monad.rpcUrls.default.http[0];
const publicClient = createPublicClient({
    chain: monad,
    transport: http(rpcUrl),
});

export async function verifyOwnership(
    tokenId: string,
    contractAddress: string,
    ownerAddress: string
): Promise<boolean> {
    try {
        const contractConfig = CONTRACT_REGISTRY.ADVENTURER;
        // Ensure we are checking against the correct contract if passed, or default to registry
        // For now, assuming contractAddress matches registry or we use registry's ABI

        const owner = await publicClient.readContract({
            address: contractAddress as `0x${string}`,
            abi: contractConfig.abi,
            functionName: 'ownerOf',
            args: [BigInt(tokenId)],
        }) as string;

        return owner.toLowerCase() === ownerAddress.toLowerCase();
    } catch (error) {
        console.error('Error verifying ownership:', error);
        return false;
    }
}

export async function syncUserHeroes(walletAddress: string) {
    try {
        const contractConfig = CONTRACT_REGISTRY.ADVENTURER;
        const contractAddress = getContractAddress(contractConfig);

        if (!contractAddress) throw new Error("Adventurer contract not found");

        // 1. Get all Transfer events to/from the user
        // We scan both to and from to build the current set, or just scan 'to' and verify ownership.
        // Scanning 'to' and verifying ownership is safer against transfers away that we might miss if we only scan 'from' in a limited range?
        // Actually, scanning 'to' gives us all tokens they EVER received.
        // Then we check ownerOf for each. This handles transfers away perfectly (ownerOf will be someone else).

        const logs = await publicClient.getLogs({
            address: contractAddress as `0x${string}`,
            event: parseAbiItem('event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)'),
            args: {
                to: walletAddress as `0x${string}`,
            },
            fromBlock: 'earliest',
        });

        const tokenIds = new Set<string>();
        logs.forEach(log => {
            if (log.args.tokenId !== undefined) {
                tokenIds.add(log.args.tokenId.toString());
            }
        });

        // 2. Verify current ownership and fetch metadata
        const syncedHeroes = [];
        for (const tokenId of Array.from(tokenIds)) {
            try {
                const owner = await publicClient.readContract({
                    address: contractAddress as `0x${string}`,
                    abi: contractConfig.abi,
                    functionName: 'ownerOf',
                    args: [BigInt(tokenId)],
                }) as string;

                if (owner.toLowerCase() === walletAddress.toLowerCase()) {
                    // User still owns it. Fetch metadata.
                    const uri = await publicClient.readContract({
                        address: contractAddress as `0x${string}`,
                        abi: contractConfig.abi,
                        functionName: 'tokenURI',
                        args: [BigInt(tokenId)],
                    }) as string;

                    let metadata: any = {};
                    try {
                        const httpUrl = metadataStorage.getHttpUrl(uri);
                        if (httpUrl.startsWith('http')) {
                            const res = await fetch(httpUrl);
                            if (res.ok) metadata = await res.json();
                        } else if (httpUrl.startsWith('data:')) {
                            const base64 = httpUrl.split(',')[1];
                            if (base64) {
                                metadata = JSON.parse(Buffer.from(base64, 'base64').toString('utf-8'));
                            }
                        }
                    } catch (e) {
                        console.warn(`Failed to fetch metadata for ${tokenId}`, e);
                    }

                    const heroData = {
                        token_id: tokenId,
                        contract_address: contractAddress,
                        owner_address: walletAddress.toLowerCase(),
                        name: metadata.name || `Hero #${tokenId}`,
                        image_uri: metadata.image || '',
                        attributes: metadata.attributes || [],
                        updated_at: new Date().toISOString(),
                    };

                    // Upsert into heroes table
                    const { error } = await supabase
                        .from('heroes')
                        .upsert(heroData, { onConflict: 'token_id,contract_address' })
                        .select()
                        .single();

                    if (error) {
                        console.error('Error upserting hero:', error);
                    } else {
                        syncedHeroes.push(heroData);
                        
                        // Initialize adventurer stats if not already initialized
                        try {
                            const { initializeAdventurerOnSync } = await import('./heroAdventurerInit');
                            await initializeAdventurerOnSync(tokenId, walletAddress, contractAddress);
                        } catch (initError) {
                            console.warn(`Failed to initialize adventurer stats for hero ${tokenId}:`, initError);
                            // Non-fatal - continue syncing other heroes
                        }
                    }
                }
            } catch (e) {
                // Token might be burned or error
                console.warn(`Could not check ownership for token ${tokenId}`, e);
            }
        }

        return syncedHeroes.map(h => h.token_id);
    } catch (error) {
        console.error('Error syncing user heroes:', error);
        throw error;
    }
}

/**
 * Get hero data by token ID and convert to Entity for game engine
 * Fetches from contract, parses metadata, generates stats
 */
export async function getHeroByTokenId(tokenId: string): Promise<{
    id: string;
    name: string;
    stats: {
        str: number;
        dex: number;
        con: number;
        int: number;
        wis: number;
        cha: number;
        ac: number;
        hp: number;
        maxHp: number;
        attackBonus: number;
    };
    metadata?: any;
}> {
    try {
        const contractConfig = CONTRACT_REGISTRY.ADVENTURER;
        const contractAddress = getContractAddress(contractConfig);

        if (!contractAddress) throw new Error("Adventurer contract not found");

        // Fetch metadata URI from contract
        const uri = await publicClient.readContract({
            address: contractAddress as `0x${string}`,
            abi: contractConfig.abi,
            functionName: 'tokenURI',
            args: [BigInt(tokenId)],
        }) as string;

        // Fetch and parse metadata
        let metadata: any = {};
        try {
            const httpUrl = metadataStorage.getHttpUrl(uri);
            if (httpUrl.startsWith('http')) {
                const res = await fetch(httpUrl);
                if (res.ok) metadata = await res.json();
            } else if (httpUrl.startsWith('data:')) {
                const base64 = httpUrl.split(',')[1];
                if (base64) {
                    metadata = JSON.parse(Buffer.from(base64, 'base64').toString('utf-8'));
                }
            }
        } catch (e) {
            console.warn(`Failed to fetch metadata for token ${tokenId}`, e);
        }

        // Extract hero class from metadata
        const heroClass = metadata.hero?.class || metadata.attributes?.find((a: any) => a.trait_type === 'Class')?.value || 'Warrior';

        // Generate stats based on class (default values if not in metadata)
        // These are starter stats - in production, stats might be stored in metadata or calculated
        const baseStats = {
            Warrior: { str: 16, dex: 12, con: 14, int: 10, wis: 10, cha: 8 },
            Mage: { str: 8, dex: 12, con: 10, int: 16, wis: 14, cha: 10 },
            Rogue: { str: 10, dex: 16, con: 12, int: 14, wis: 10, cha: 8 },
            Cleric: { str: 12, dex: 10, con: 14, int: 10, wis: 16, cha: 12 },
        };

        const classStats = baseStats[heroClass as keyof typeof baseStats] || baseStats.Warrior;

        // Use metadata stats if available, otherwise use defaults
        const stats = {
            str: metadata.hero?.stats?.str || classStats.str,
            dex: metadata.hero?.stats?.dex || classStats.dex,
            con: metadata.hero?.stats?.con || classStats.con,
            int: metadata.hero?.stats?.int || classStats.int,
            wis: metadata.hero?.stats?.wis || classStats.wis,
            cha: metadata.hero?.stats?.cha || classStats.cha,
            ac: metadata.hero?.stats?.ac || 10 + Math.floor((classStats.dex - 10) / 2), // Base AC + dex mod
            hp: metadata.hero?.stats?.hp || metadata.hero?.stats?.maxHp || (8 + Math.floor((classStats.con - 10) / 2)), // Level 1 HP
            maxHp: metadata.hero?.stats?.maxHp || (8 + Math.floor((classStats.con - 10) / 2)),
            attackBonus: metadata.hero?.stats?.attackBonus || Math.floor((classStats.str - 10) / 2), // Str mod for melee
        };

        const name = metadata.name || `Hero #${tokenId}`;

        return {
            id: tokenId, // Use token ID as entity ID
            name,
            stats,
            metadata,
        };
    } catch (error) {
        console.error(`Error getting hero by token ID ${tokenId}:`, error);
        throw error;
    }
}

/**
 * Get all Adventurer NFT token IDs owned by a wallet address
 * This fetches directly from the contract, not from database
 */
export async function getUserOwnedTokenIds(walletAddress: string): Promise<string[]> {
    try {
        const contractConfig = CONTRACT_REGISTRY.ADVENTURER;
        const contractAddress = getContractAddress(contractConfig);

        if (!contractAddress) throw new Error("Adventurer contract not found");

        // Use getTokensOfOwner if available, otherwise scan events
        try {
            const tokenIds = await publicClient.readContract({
                address: contractAddress as `0x${string}`,
                abi: contractConfig.abi,
                functionName: 'getTokensOfOwner',
                args: [walletAddress as `0x${string}`],
            }) as bigint[];

            return tokenIds.map(id => id.toString());
        } catch (e) {
            // Fallback: scan Transfer events
            console.warn('getTokensOfOwner failed, falling back to event scanning', e);

            const logs = await publicClient.getLogs({
                address: contractAddress as `0x${string}`,
                event: parseAbiItem('event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)'),
                args: {
                    to: walletAddress as `0x${string}`,
                },
                fromBlock: 'earliest',
            });

            const tokenIds = new Set<string>();
            for (const log of logs) {
                if (log.args.tokenId !== undefined) {
                    const tokenId = log.args.tokenId.toString();
                    // Verify current ownership
                    try {
                        const owner = await publicClient.readContract({
                            address: contractAddress as `0x${string}`,
                            abi: contractConfig.abi,
                            functionName: 'ownerOf',
                            args: [BigInt(tokenId)],
                        }) as string;

                        if (owner.toLowerCase() === walletAddress.toLowerCase()) {
                            tokenIds.add(tokenId);
                        }
                    } catch {
                        // Token might be burned, skip
                    }
                }
            }
            return Array.from(tokenIds);
        }
    } catch (error) {
        console.error('Error getting user owned token IDs:', error);
        throw error;
    }
}

