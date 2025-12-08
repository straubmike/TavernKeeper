import { createPublicClient, encodeFunctionData, formatEther, http } from 'viem';
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
            transport: http(monad.rpcUrls.default.http[0]),
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
                    // Calculate TBA (may return empty string if TBA calculation fails, but we still include the keeper)
                    const tba = await this.getTBA(id);

                    // Determine Tier (Simple logic based on ID)
                    const idNum = Number(id);
                    let tier = 3;
                    if (idNum <= 100) tier = 1;
                    else if (idNum <= 1000) tier = 2;

                    // Always include the keeper, even if TBA is empty
                    // Empty TBA just means we can't fetch heroes for it yet
                    ownedKeepers.push({
                        tokenId: id,
                        tbaAddress: tba || '', // Ensure it's always a string, even if empty
                        tier
                    });

                    if (!tba) {
                        console.warn(`⚠️ TBA calculation returned empty for TavernKeeper #${id} - heroes may not be queryable`);
                    }
                } catch (error) {
                    // Don't skip - include the keeper even if TBA calculation fails
                    const idNum = Number(id);
                    let tier = 3;
                    if (idNum <= 100) tier = 1;
                    else if (idNum <= 1000) tier = 2;

                    console.error(`❌ Failed to get TBA for token ${id}, but including keeper anyway:`, error);
                    ownedKeepers.push({
                        tokenId: id,
                        tbaAddress: '', // Empty TBA - can't fetch heroes
                        tier
                    });
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
        if (!address) {
            console.error(`[getTavernKeeperTokenURI] Contract address not found for tokenId ${tokenId}`);
            return '';
        }

        const publicClient = createPublicClient({
            chain: monad,
            transport: http(monad.rpcUrls.default.http[0]),
        });

        try {
            const uri = await publicClient.readContract({
                address,
                abi: contractConfig.abi,
                functionName: 'tokenURI',
                args: [BigInt(tokenId)],
            });
            const uriString = uri as string;
            if (!uriString || uriString.trim() === '') {
                console.warn(`[getTavernKeeperTokenURI] Empty tokenURI returned for tokenId ${tokenId}`);
                return '';
            }
            console.log(`[getTavernKeeperTokenURI] TokenId ${tokenId}: ${uriString.substring(0, 100)}...`);
            return uriString;
        } catch (e) {
            console.error(`[getTavernKeeperTokenURI] Failed to fetch token URI for tokenId ${tokenId}:`, e);
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

        if (!registryAddress || !accountImplAddress || !tokenContractAddress) {
            console.error('❌ Missing addresses for TBA calculation:', {
                registry: registryAddress,
                impl: accountImplAddress,
                tokenContract: tokenContractAddress
            });
            return '';
        }

        const publicClient = createPublicClient({
            chain: monad,
            transport: http(monad.rpcUrls.default.http[0]),
        });

        // Try to get actual addresses from Adventurer contract (if available)
        // This ensures we use the same addresses the contract uses
        let actualRegistryAddress = registryAddress;
        let actualImplAddress = accountImplAddress;
        let actualTokenContractAddress = tokenContractAddress;

        try {
            const adventurerConfig = CONTRACT_REGISTRY.ADVENTURER;
            const adventurerAddress = getContractAddress(adventurerConfig);
            if (adventurerAddress) {
                const [contractRegistry, contractImpl, contractTavernKeeper] = await Promise.all([
                    publicClient.readContract({
                        address: adventurerAddress,
                        abi: adventurerConfig.abi,
                        functionName: 'erc6551Registry',
                    }).catch(() => null),
                    publicClient.readContract({
                        address: adventurerAddress,
                        abi: adventurerConfig.abi,
                        functionName: 'erc6551AccountImpl',
                    }).catch(() => null),
                    publicClient.readContract({
                        address: adventurerAddress,
                        abi: adventurerConfig.abi,
                        functionName: 'tavernKeeperContract',
                    }).catch(() => null),
                ]);

                if (contractRegistry) actualRegistryAddress = contractRegistry as string;
                if (contractImpl) actualImplAddress = contractImpl as string;
                if (contractTavernKeeper) actualTokenContractAddress = contractTavernKeeper as string;

                console.log(`🔍 TBA Calculation for TavernKeeper #${tokenId}:`);
                console.log(`   Registry: ${actualRegistryAddress} ${actualRegistryAddress !== registryAddress ? '(from contract)' : '(from config)'}`);
                console.log(`   Impl: ${actualImplAddress} ${actualImplAddress !== accountImplAddress ? '(from contract)' : '(from config)'}`);
                console.log(`   TokenContract: ${actualTokenContractAddress} ${actualTokenContractAddress !== tokenContractAddress ? '(from contract)' : '(from config)'}`);
                console.log(`   ChainId: ${monad.id}`);
                console.log(`   Salt: 0`);
            }
        } catch (e) {
            console.warn('⚠️ Could not fetch addresses from contract, using config addresses:', e);
        }

        try {
            // Convert salt (0) to bytes32
            const saltBytes32 = '0x' + '0'.repeat(64); // bytes32(0)

            const tba = await publicClient.readContract({
                address: actualRegistryAddress,
                abi: registryConfig.abi,
                functionName: 'account',
                args: [
                    actualImplAddress,      // implementation
                    saltBytes32 as `0x${string}`,  // salt (bytes32)
                    BigInt(monad.id),        // chainId
                    actualTokenContractAddress,     // tokenContract
                    BigInt(tokenId)         // tokenId
                ]
            });

            console.log(`✅ TBA for TavernKeeper #${tokenId}: ${tba}`);
            return tba as string;
        } catch (error: any) {
            // If account() reverts, the TBA hasn't been created yet (token might not exist or TBA not initialized)
            // Return empty string to indicate TBA is not available
            console.error(`❌ TBA calculation failed for token ${tokenId}:`, error?.message || error);
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
        if (!address) {
            console.error('❌ Adventurer contract address not found');
            return [];
        }

        console.log(`🔍 getHeroes: Looking for heroes owned by ${ownerAddress}`);
        console.log(`   Contract address: ${address}`);
        console.log(`   Chain ID: ${monad.id}`);
        console.log(`   RPC URL: ${monad.rpcUrls.default.http[0]}`);

        const publicClient = createPublicClient({
            chain: monad,
            transport: http(monad.rpcUrls.default.http[0]),
        });

        try {
            // Try getTokensOfOwner first (if it exists)
            let tokenIds: bigint[] = [];
            try {
                tokenIds = await publicClient.readContract({
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
                console.log(`✅ getTokensOfOwner returned ${tokenIds.length} token(s)`);
            } catch (error: any) {
                console.warn('⚠️ getTokensOfOwner failed, trying balanceOf + tokenOfOwnerByIndex:', error?.message);

                // Fallback: Use balanceOf + tokenOfOwnerByIndex
                try {
                    const balance = await publicClient.readContract({
                        address,
                        abi: contractConfig.abi,
                        functionName: 'balanceOf',
                        args: [ownerAddress as `0x${string}`],
                    }) as bigint;

                    console.log(`   balanceOf(${ownerAddress}): ${balance.toString()}`);

                    if (balance > 0n) {
                        // Fetch each token by index
                        for (let i = 0n; i < balance; i++) {
                            try {
                                const tokenId = await publicClient.readContract({
                                    address,
                                    abi: [...contractConfig.abi, {
                                        "inputs": [
                                            { "internalType": "address", "name": "owner", "type": "address" },
                                            { "internalType": "uint256", "name": "index", "type": "uint256" }
                                        ],
                                        "name": "tokenOfOwnerByIndex",
                                        "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
                                        "stateMutability": "view",
                                        "type": "function"
                                    }],
                                    functionName: 'tokenOfOwnerByIndex',
                                    args: [ownerAddress as `0x${string}`, i],
                                }) as bigint;
                                tokenIds.push(tokenId);
                            } catch (e) {
                                console.warn(`   Failed to get token at index ${i}:`, e);
                            }
                        }
                        console.log(`✅ Found ${tokenIds.length} token(s) using tokenOfOwnerByIndex`);
                    }
                } catch (fallbackError) {
                    console.error('❌ Fallback method also failed:', fallbackError);
                    return [];
                }
            }

            if (tokenIds.length === 0) {
                console.log(`ℹ️ No heroes found for address ${ownerAddress}`);
                console.log(`   This could mean:`);
                console.log(`   1. No heroes have been minted to this TBA yet`);
                console.log(`   2. The TBA address is incorrect`);
                console.log(`   3. The contract address is incorrect`);
                console.log(`   4. The transaction hasn't been confirmed yet`);
                return [];
            }

            console.log(`📋 Processing ${tokenIds.length} hero token(s)...`);
            const ownedHeroes: HeroNFT[] = [];
            for (const idBigInt of tokenIds) {
                const id = idBigInt.toString();
                try {
                    // Fetch metadata URI using tokenURI from ABI
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
                    console.log(`   ✅ Hero #${id} added (URI: ${uri.substring(0, 50)}...)`);
                } catch (e) {
                    console.warn(`   ⚠️ Failed to process hero #${id}:`, e);
                }
            }

            console.log(`✅ getHeroes: Returning ${ownedHeroes.length} hero(es)`);
            return ownedHeroes.sort((a, b) => Number(a.tokenId) - Number(b.tokenId));
        } catch (e) {
            console.error("❌ Failed to fetch heroes", e);
            return [];
        }
    },

    async getHeroTBA(tokenId: string): Promise<string> {
        const registryConfig = CONTRACT_REGISTRY.ERC6551_REGISTRY;
        const registryAddress = getContractAddress(registryConfig);
        const accountImplConfig = CONTRACT_REGISTRY.ERC6551_IMPLEMENTATION;
        const accountImplAddress = getContractAddress(accountImplConfig);
        const tokenContractAddress = getContractAddress(CONTRACT_REGISTRY.ADVENTURER);

        if (!registryAddress || !accountImplAddress || !tokenContractAddress) {
            console.error('❌ Missing addresses for Hero TBA calculation');
            return '';
        }

        const publicClient = createPublicClient({
            chain: monad,
            transport: http(monad.rpcUrls.default.http[0]),
        });

        // Try to get actual addresses from Adventurer contract (if available)
        let actualRegistryAddress = registryAddress;
        let actualImplAddress = accountImplAddress;

        try {
            const adventurerConfig = CONTRACT_REGISTRY.ADVENTURER;
            const adventurerAddress = getContractAddress(adventurerConfig);
            if (adventurerAddress) {
                const [contractRegistry, contractImpl] = await Promise.all([
                    publicClient.readContract({
                        address: adventurerAddress,
                        abi: adventurerConfig.abi,
                        functionName: 'erc6551Registry',
                    }).catch(() => null),
                    publicClient.readContract({
                        address: adventurerAddress,
                        abi: adventurerConfig.abi,
                        functionName: 'erc6551AccountImpl',
                    }).catch(() => null),
                ]);

                if (contractRegistry) actualRegistryAddress = contractRegistry as string;
                if (contractImpl) actualImplAddress = contractImpl as string;
            }
        } catch (e) {
            console.warn('⚠️ Could not fetch addresses from contract for Hero TBA, using config:', e);
        }

        try {
            // Convert salt (0) to bytes32 - CORRECT ORDER: implementation, salt (bytes32), chainId, tokenContract, tokenId
            const saltBytes32 = '0x' + '0'.repeat(64); // bytes32(0)

            const tba = await publicClient.readContract({
                address: actualRegistryAddress,
                abi: registryConfig.abi,
                functionName: 'account',
                args: [
                    actualImplAddress,      // implementation (1st)
                    saltBytes32 as `0x${string}`,  // salt (bytes32, 2nd)
                    BigInt(monad.id),        // chainId (3rd)
                    tokenContractAddress,     // tokenContract (4th)
                    BigInt(tokenId)         // tokenId (5th)
                ]
            });

            return tba as string;
        } catch (error: any) {
            console.error(`❌ Hero TBA calculation failed for token ${tokenId}:`, error?.message || error);
            return '';
        }
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
                transport: http(monad.rpcUrls.default.http[0]),
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
                transport: http(monad.rpcUrls.default.http[0]),
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
            transport: http(monad.rpcUrls.default.http[0]),
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
            transport: http(monad.rpcUrls.default.http[0]),
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
                rpcUrl: monad.rpcUrls.default.http[0],
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

        // Get price signature from API (fresh signature ensures correct nonce)
        const priceSig = await this.getPriceSignature('adventurer', mintTier, address);

        const args = [
            to,
            uri,
            BigInt(priceSig.amountWei),
            BigInt(priceSig.deadline),
            priceSig.signature,
        ] as const;

        const value = BigInt(priceSig.amountWei);

        // Simulate transaction first to get better error messages
        try {
            const rpcUrl = monad.rpcUrls.default.http[0];
            const publicClient = createPublicClient({
                chain: monad,
                transport: http(rpcUrl),
            });

            const { request } = await publicClient.simulateContract({
                address: contractAddress,
                abi: contractConfig.abi,
                functionName: 'mintHero',
                args: args,
                value: value,
                account: address as `0x${string}`,
            });

            // If simulation succeeds, execute the transaction
            return await walletClient.writeContract(request);
        } catch (simError: any) {
            // Extract the actual revert reason from simulation error
            const errorMessage = simError?.shortMessage || simError?.message || 'Transaction simulation failed';

            // Check for common revert reasons
            if (errorMessage.includes('Public minting is disabled')) {
                throw new Error('Public minting is currently disabled. Please try again later.');
            }
            if (errorMessage.includes('Signature expired')) {
                throw new Error('Price signature expired. Please try again.');
            }
            if (errorMessage.includes('Invalid signature')) {
                throw new Error('Invalid price signature. This may be due to a nonce mismatch. Please try again.');
            }
            if (errorMessage.includes('Incorrect payment amount')) {
                throw new Error('Payment amount mismatch. Please refresh and try again.');
            }
            if (errorMessage.includes('Signer not set')) {
                throw new Error('Contract configuration error. Please contact support.');
            }

            // Re-throw with more context
            throw new Error(`Hero mint failed: ${errorMessage}`);
        }
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
            transport: http(monad.rpcUrls.default.http[0]),
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
            transport: http(monad.rpcUrls.default.http[0]),
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
     * Handles both direct ownership and TBA ownership
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

        const publicClient = createPublicClient({
            chain: monad,
            transport: http(monad.rpcUrls.default.http[0]),
        });

        // Check who owns the hero
        const owner = await publicClient.readContract({
            address: contractAddress,
            abi: contractConfig.abi,
            functionName: 'ownerOf',
            args: [BigInt(tokenId)],
        }) as string;

        console.log(`[updateHeroMetadata] Hero #${tokenId} owner: ${owner}, caller: ${address}`);

        // If hero is owned by a TBA, we need to call through the TBA
        if (owner.toLowerCase() !== address.toLowerCase()) {
            // Hero is owned by TBA, use TBA execute
            const tbaConfig = CONTRACT_REGISTRY.ERC6551_IMPLEMENTATION;
            const tbaAddress = owner as `0x${string}`;

            console.log(`[updateHeroMetadata] Hero is owned by TBA ${tbaAddress}, using TBA execute`);

            // Encode the updateTokenURI call
            const callData = encodeFunctionData({
                abi: contractConfig.abi,
                functionName: 'updateTokenURI',
                args: [BigInt(tokenId), newMetadataUri],
            });

            // Call TBA execute to call updateTokenURI on behalf of the TBA
            return await walletClient.writeContract({
                address: tbaAddress,
                abi: tbaConfig.abi,
                functionName: 'execute',
                args: [
                    contractAddress, // to: Adventurer contract
                    0n, // value: 0
                    callData, // data: encoded updateTokenURI call
                    0, // operation: 0 = call
                ],
                account: address as `0x${string}`,
                chain: monad
            });
        } else {
            // Hero is directly owned by the caller, use direct call
            console.log(`[updateHeroMetadata] Hero is directly owned, using direct call`);
            return await walletClient.writeContract({
                address: contractAddress,
                abi: contractConfig.abi,
                functionName: 'updateTokenURI',
                args: [BigInt(tokenId), newMetadataUri],
                account: address as `0x${string}`,
                chain: monad
            });
        }
    }
};
