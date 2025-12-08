import { createPublicClient, formatEther, http } from 'viem';
import { monad } from '../chains';
import { CONTRACT_REGISTRY, getContractAddress } from '../contracts/registry';

export interface TavernKeeperNFT {
    tokenId: string;
    tbaAddress: string;
    tier: number;
}

export interface HeroNFT {
    tokenId: string;
    metadataUri: string;
    tbaAddress: string; // The TBA that owns this hero (if any)
}

export const rpgService = {
    // --- Read Functions ---

    /**
     * Get all TavernKeeper NFTs owned by a user.
     * Uses getTokensOfOwner view function.
     */
    async getUserTavernKeepers(userAddress: string): Promise<TavernKeeperNFT[]> {
        const contractConfig = CONTRACT_REGISTRY.TAVERNKEEPER;
        const address = getContractAddress(contractConfig);
        if (!address) return [];

        const publicClient = createPublicClient({
            chain: monad,
            transport: http(process.env.NEXT_PUBLIC_MONAD_RPC_URL || monad.rpcUrls.default.http[0]),
        });

        try {
            // Fetch token IDs directly from contract
            const tokenIds = await publicClient.readContract({
                address,
                abi: [...contractConfig.abi, {
                    "inputs": [{ "internalType": "address", "name": "owner", "type": "address" }],
                    "name": "getTokensOfOwner",
                    "outputs": [{ "internalType": "uint256[]", "name": "", "type": "uint256[]" }],
                    "stateMutability": "view",
                    "type": "function"
                }],
                functionName: 'getTokensOfOwner',
                args: [userAddress as `0x${string}`],
            }) as bigint[];

            const ownedKeepers: TavernKeeperNFT[] = [];

            for (const idBigInt of tokenIds) {
                const id = idBigInt.toString();
                try {
                    // Calculate TBA (may return empty string if TBA not created yet)
                    const tba = await this.getTBA(id);
                    // Determine Tier (Simple logic based on ID)
                    const idNum = Number(id);
                    let tier = 3;
                    if (idNum <= 100) tier = 1;
                    else if (idNum <= 1000) tier = 2;

                    ownedKeepers.push({
                        tokenId: id,
                        tbaAddress: tba,
                        tier
                    });
                } catch (error) {
                    // Skip tokens that fail to fetch TBA (might not exist or TBA not initialized)
                    console.warn(`Failed to get TBA for token ${id}, skipping:`, error);
                }
            }

            return ownedKeepers.sort((a, b) => Number(a.tokenId) - Number(b.tokenId));
        } catch (e) {
            console.error("Failed to fetch user tavern keepers", e);
            return [];
        }
    },

    /**
     * Get tokenURI for a TavernKeeper NFT
     */
    async getTavernKeeperTokenURI(tokenId: string): Promise<string> {
        const contractConfig = CONTRACT_REGISTRY.TAVERNKEEPER;
        const address = getContractAddress(contractConfig);
        if (!address) return '';

        const publicClient = createPublicClient({
            chain: monad,
            transport: http(process.env.NEXT_PUBLIC_MONAD_RPC_URL || monad.rpcUrls.default.http[0]),
        });

        try {
            const uri = await publicClient.readContract({
                address,
                abi: contractConfig.abi,
                functionName: 'tokenURI',
                args: [BigInt(tokenId)],
            });
            return uri as string;
        } catch (e) {
            console.error("Failed to fetch tavern keeper token URI", e);
            return '';
        }
    },

    /**
     * Get the Token Bound Account (TBA) address for a TavernKeeper NFT.
     */
    async getTBA(tokenId: string): Promise<string> {
        const registryConfig = CONTRACT_REGISTRY.ERC6551_REGISTRY;
        const registryAddress = getContractAddress(registryConfig);
        const accountImplConfig = CONTRACT_REGISTRY.ERC6551_IMPLEMENTATION;
        const accountImplAddress = getContractAddress(accountImplConfig);
        const tokenContractAddress = getContractAddress(CONTRACT_REGISTRY.TAVERNKEEPER);

        if (!registryAddress || !accountImplAddress || !tokenContractAddress) return '';

        const publicClient = createPublicClient({
            chain: monad,
            transport: http(process.env.NEXT_PUBLIC_MONAD_RPC_URL || monad.rpcUrls.default.http[0]),
        });

        try {
            const tba = await publicClient.readContract({
                address: registryAddress,
                abi: registryConfig.abi,
                functionName: 'account',
                args: [
                    accountImplAddress,      // implementation
                    BigInt(monad.id),        // chainId
                    tokenContractAddress,     // tokenContract
                    BigInt(tokenId),         // tokenId
                    BigInt(0)                // salt
                ]
            });

            return tba as string;
        } catch (error: any) {
            // If account() reverts, the TBA hasn't been created yet (token might not exist or TBA not initialized)
            // Return empty string to indicate TBA is not available
            console.warn(`TBA not available for token ${tokenId}:`, error?.message || error);
            return '';
        }
    },

    /**
     * Get all Heroes owned by a specific address (usually a TBA).
     */
    async getHeroes(ownerAddress: string): Promise<HeroNFT[]> {
        // Validate address before proceeding
        if (!ownerAddress || ownerAddress.trim() === '' || !ownerAddress.startsWith('0x')) {
            console.warn('getHeroes called with invalid address:', ownerAddress);
            return [];
        }

        const contractConfig = CONTRACT_REGISTRY.ADVENTURER;
        const address = getContractAddress(contractConfig);
        if (!address) return [];

        const publicClient = createPublicClient({
            chain: monad,
            transport: http(process.env.NEXT_PUBLIC_MONAD_RPC_URL || monad.rpcUrls.default.http[0]),
        });

        try {
            // Fetch token IDs directly from contract
            const tokenIds = await publicClient.readContract({
                address,
                abi: [...contractConfig.abi, {
                    "inputs": [{ "internalType": "address", "name": "owner", "type": "address" }],
                    "name": "getTokensOfOwner",
                    "outputs": [{ "internalType": "uint256[]", "name": "", "type": "uint256[]" }],
                    "stateMutability": "view",
                    "type": "function"
                }],
                functionName: 'getTokensOfOwner',
                args: [ownerAddress as `0x${string}`],
            }) as bigint[];

            const ownedHeroes: HeroNFT[] = [];
            for (const idBigInt of tokenIds) {
                const id = idBigInt.toString();
                // Fetch metadata URI
                const uri = await publicClient.readContract({
                    address,
                    abi: contractConfig.abi,
                    functionName: 'tokenURI',
                    args: [BigInt(id)],
                });

                // Calculate TBA for the Hero (Recursive!)
                // Heroes can also have inventories
                const tba = await this.getHeroTBA(id);

                ownedHeroes.push({
                    tokenId: id,
                    metadataUri: uri as string,
                    tbaAddress: tba
                });
            }

            return ownedHeroes.sort((a, b) => Number(a.tokenId) - Number(b.tokenId));
        } catch (e) {
            console.error("Failed to fetch heroes", e);
            return [];
        }
    },

    async getHeroTBA(tokenId: string): Promise<string> {
        const registryConfig = CONTRACT_REGISTRY.ERC6551_REGISTRY;
        const registryAddress = getContractAddress(registryConfig);
        const accountImplConfig = CONTRACT_REGISTRY.ERC6551_IMPLEMENTATION;
        const accountImplAddress = getContractAddress(accountImplConfig);
        const tokenContractAddress = getContractAddress(CONTRACT_REGISTRY.ADVENTURER);

        if (!registryAddress || !accountImplAddress || !tokenContractAddress) return '';

        const publicClient = createPublicClient({
            chain: monad,
            transport: http(process.env.NEXT_PUBLIC_MONAD_RPC_URL || monad.rpcUrls.default.http[0]),
        });

        const tba = await publicClient.readContract({
            address: registryAddress,
            abi: registryConfig.abi,
            functionName: 'account',
            args: [
                accountImplAddress,
                BigInt(0),
                BigInt(monad.id),
                tokenContractAddress,
                BigInt(tokenId)
            ]
        });

        return tba as string;
    },

    // --- Write Functions ---

    /**
     * Get price signature from backend API
     */
    async getPriceSignature(
        contractType: 'tavernkeeper' | 'adventurer',
        tier: 0 | 1 | 2 | 3,
        userAddress: string
    ): Promise<{
        amount: string;
        amountWei: string;
        deadline: string;
        signature: `0x${string}`;
        monPrice: number;
        usdPrice: number;
        tier: number;
    }> {
        const response = await fetch('/api/pricing/sign', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                contractType,
                tier,
                userAddress,
            }),
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to get price signature');
        }

        return await response.json();
    },

    async isWhitelisted(contractType: 'tavernkeeper' | 'adventurer', address: string): Promise<boolean> {
        try {
            const contractConfig = contractType === 'tavernkeeper'
                ? CONTRACT_REGISTRY.TAVERNKEEPER
                : CONTRACT_REGISTRY.ADVENTURER;
            const contractAddress = getContractAddress(contractConfig);
            if (!contractAddress) return false;

            const publicClient = createPublicClient({
                chain: monad,
                transport: http(process.env.NEXT_PUBLIC_MONAD_RPC_URL || monad.rpcUrls.default.http[0]),
            });

            const isWhitelisted = await publicClient.readContract({
                address: contractAddress,
                abi: contractConfig.abi,
                functionName: 'whitelist',
                args: [address as `0x${string}`],
            }) as boolean;

            return isWhitelisted;
        } catch (error) {
            console.error('Failed to check whitelist status:', error);
            return false;
        }
    },

    async hasWhitelistMinted(contractType: 'tavernkeeper' | 'adventurer', address: string): Promise<boolean> {
        try {
            const contractConfig = contractType === 'tavernkeeper'
                ? CONTRACT_REGISTRY.TAVERNKEEPER
                : CONTRACT_REGISTRY.ADVENTURER;
            const contractAddress = getContractAddress(contractConfig);
            if (!contractAddress) return false;

            const publicClient = createPublicClient({
                chain: monad,
                transport: http(process.env.NEXT_PUBLIC_MONAD_RPC_URL || monad.rpcUrls.default.http[0]),
            });

            const hasMinted = await publicClient.readContract({
                address: contractAddress,
                abi: contractConfig.abi,
                functionName: 'whitelistMinted',
                args: [address as `0x${string}`],
            }) as boolean;

            return hasMinted;
        } catch (error) {
            console.error('Failed to check whitelist mint status:', error);
            return false;
        }
    },

    /**
     * Determine tier based on current token count
     */
    async getCurrentTier(contractType: 'tavernkeeper' | 'adventurer'): Promise<1 | 2 | 3> {
        const contractConfig = contractType === 'tavernkeeper'
            ? CONTRACT_REGISTRY.TAVERNKEEPER
            : CONTRACT_REGISTRY.ADVENTURER;
        const address = getContractAddress(contractConfig);
        if (!address) return 1; // Default to tier 1

        const publicClient = createPublicClient({
            chain: monad,
            transport: http(process.env.NEXT_PUBLIC_MONAD_RPC_URL || monad.rpcUrls.default.http[0]),
        });

        try {
            // Get total supply or next token ID
            // We'll use a workaround - try to get the next token ID from the contract
            // For now, we'll estimate based on user's tokens or default to tier 1
            // In practice, you might want to track this differently
            return 1; // Default to tier 1 for first mint
        } catch (e) {
            console.error('Failed to determine tier:', e);
            return 1; // Default to tier 1
        }
    },

    async mintTavernKeeper(
        walletClient: any,
        address: string,
        uri: string,
        tier?: 1 | 2 | 3
    ) {
        const contractConfig = CONTRACT_REGISTRY.TAVERNKEEPER;
        const contractAddress = getContractAddress(contractConfig);
        if (!contractAddress) throw new Error("Contract not found");

        // Determine tier if not provided
        const mintTier = tier || await this.getCurrentTier('tavernkeeper');

        // Get price signature from API
        const priceSig = await this.getPriceSignature('tavernkeeper', mintTier, address);

        return await walletClient.writeContract({
            address: contractAddress,
            abi: contractConfig.abi,
            functionName: 'mintTavernKeeper',
            args: [
                uri,
                BigInt(priceSig.amountWei),
                BigInt(priceSig.deadline),
                priceSig.signature,
            ],
            value: BigInt(priceSig.amountWei),
            account: address as `0x${string}`,
            chain: monad
        });
    },

    async mintTavernKeeperWhitelist(
        walletClient: any,
        address: string,
        uri: string
    ) {
        const contractConfig = CONTRACT_REGISTRY.TAVERNKEEPER;
        const contractAddress = getContractAddress(contractConfig);
        if (!contractAddress) throw new Error("Contract not found");

        return await walletClient.writeContract({
            address: contractAddress,
            abi: contractConfig.abi,
            functionName: 'mintTavernKeeperWhitelist',
            args: [uri],
            account: address as `0x${string}`,
            chain: monad
        });
    },

    /**
     * Check if a TavernKeeper has already claimed their free hero
     */
    async hasClaimedFreeHero(tavernKeeperId: string): Promise<boolean> {
        const contractConfig = CONTRACT_REGISTRY.ADVENTURER;
        const contractAddress = getContractAddress(contractConfig);
        if (!contractAddress) {
            console.warn('⚠️ Adventurer contract address not found. Cannot check free hero claim status.');
            return false;
        }

        const publicClient = createPublicClient({
            chain: monad,
            transport: http(process.env.NEXT_PUBLIC_MONAD_RPC_URL || monad.rpcUrls.default.http[0]),
        });

        try {
            console.log(`🔍 Checking free hero claim status for TavernKeeper #${tavernKeeperId}...`);
            const claimed = await publicClient.readContract({
                address: contractAddress,
                abi: contractConfig.abi,
                functionName: 'freeHeroClaimed',
                args: [BigInt(tavernKeeperId)],
            });
            const isClaimed = claimed as boolean;
            console.log(`✅ Free hero claim status for TavernKeeper #${tavernKeeperId}: ${isClaimed ? 'CLAIMED' : 'NOT CLAIMED'}`);
            return isClaimed;
        } catch (error: any) {
            console.error('❌ Failed to check free hero claim status:', {
                error: error?.message || error,
                tavernKeeperId,
                contractAddress,
                rpcUrl: process.env.NEXT_PUBLIC_MONAD_RPC_URL || monad.rpcUrls.default.http[0],
            });
            // Return false on error - this means we won't show the free hero banner if there's an RPC issue
            // But at least we log it so the user can see what went wrong
            return false;
        }
    },

    async claimFreeHero(walletClient: any, address: string, tavernKeeperId: string, heroUri: string) {
        const contractConfig = CONTRACT_REGISTRY.ADVENTURER;
        const contractAddress = getContractAddress(contractConfig);
        if (!contractAddress) throw new Error("Contract not found");

        return await walletClient.writeContract({
            address: contractAddress,
            abi: contractConfig.abi,
            functionName: 'claimFreeHero',
            args: [BigInt(tavernKeeperId), heroUri],
            account: address as `0x${string}`,
            chain: monad
        });
    },

    async mintHero(
        walletClient: any,
        address: string,
        to: string,
        uri: string,
        tier?: 1 | 2 | 3
    ) {
        const contractConfig = CONTRACT_REGISTRY.ADVENTURER;
        const contractAddress = getContractAddress(contractConfig);
        if (!contractAddress) throw new Error("Contract not found");

        // Determine tier if not provided
        const mintTier = tier || await this.getCurrentTier('adventurer');

        // Get price signature from API
        const priceSig = await this.getPriceSignature('adventurer', mintTier, address);

        return await walletClient.writeContract({
            address: contractAddress,
            abi: contractConfig.abi,
            functionName: 'mintHero',
            args: [
                to,
                uri,
                BigInt(priceSig.amountWei),
                BigInt(priceSig.deadline),
                priceSig.signature,
            ],
            value: BigInt(priceSig.amountWei),
            account: address as `0x${string}`,
            chain: monad
        });
    },

    async mintHeroWhitelist(
        walletClient: any,
        address: string,
        to: string,
        uri: string
    ) {
        const contractConfig = CONTRACT_REGISTRY.ADVENTURER;
        const contractAddress = getContractAddress(contractConfig);
        if (!contractAddress) throw new Error("Contract not found");

        return await walletClient.writeContract({
            address: contractAddress,
            abi: contractConfig.abi,
            functionName: 'mintHeroWhitelist',
            args: [to, uri],
            account: address as `0x${string}`,
            chain: monad
        });
    },

    async getTavernKeeperPrice(tokenId: number): Promise<string> {
        const contractConfig = CONTRACT_REGISTRY.TAVERNKEEPER;
        const address = getContractAddress(contractConfig);
        if (!address) return '0';

        const publicClient = createPublicClient({
            chain: monad,
            transport: http(process.env.NEXT_PUBLIC_MONAD_RPC_URL || monad.rpcUrls.default.http[0]),
        });

        const price = await publicClient.readContract({
            address,
            abi: contractConfig.abi,
            functionName: 'getMintPrice',
            args: [BigInt(tokenId)],
        });

        return formatEther(price as bigint);
    },

    async getHeroPrice(tokenId: number): Promise<string> {
        const contractConfig = CONTRACT_REGISTRY.ADVENTURER;
        const address = getContractAddress(contractConfig);
        if (!address) return '0';

        const publicClient = createPublicClient({
            chain: monad,
            transport: http(process.env.NEXT_PUBLIC_MONAD_RPC_URL || monad.rpcUrls.default.http[0]),
        });

        const price = await publicClient.readContract({
            address,
            abi: contractConfig.abi,
            functionName: 'getMintPrice',
            args: [BigInt(tokenId)],
        });

        return formatEther(price as bigint);
    },

    /**
     * Update TavernKeeper metadata URI
     */
    async updateTavernKeeperMetadata(
        walletClient: any,
        address: string,
        tokenId: string,
        newMetadataUri: string
    ): Promise<string> {
        const contractConfig = CONTRACT_REGISTRY.TAVERNKEEPER;
        const contractAddress = getContractAddress(contractConfig);
        if (!contractAddress) throw new Error("Contract not found");

        return await walletClient.writeContract({
            address: contractAddress,
            abi: contractConfig.abi,
            functionName: 'updateTokenURI',
            args: [BigInt(tokenId), newMetadataUri],
            account: address as `0x${string}`,
            chain: monad
        });
    },

    /**
     * Update Hero metadata URI
     */
    async updateHeroMetadata(
        walletClient: any,
        address: string,
        tokenId: string,
        newMetadataUri: string
    ): Promise<string> {
        const contractConfig = CONTRACT_REGISTRY.ADVENTURER;
        const contractAddress = getContractAddress(contractConfig);
        if (!contractAddress) throw new Error("Contract not found");

        return await walletClient.writeContract({
            address: contractAddress,
            abi: contractConfig.abi,
            functionName: 'updateTokenURI',
            args: [BigInt(tokenId), newMetadataUri],
            account: address as `0x${string}`,
            chain: monad
        });
    }
};
