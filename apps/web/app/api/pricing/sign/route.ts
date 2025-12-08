import { monad } from '@/lib/chains';
import { CONTRACT_REGISTRY, getContractAddress } from '@/lib/contracts/registry';
import { getMonPrice } from '@/lib/services/monPriceService';
import { NextRequest, NextResponse } from 'next/server';
import { createPublicClient, encodePacked, formatEther, http, keccak256, parseEther } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

// USD prices per tier (same for both TavernKeeper and Adventurer)
const TIER_USD_PRICES = {
    0: 0.00,   // $0 - Whitelist tier (free)
    1: 1.00,   // $1
    2: 5.00,   // $5
    3: 10.00,  // $10
};

interface SignPriceRequest {
    contractType: 'tavernkeeper' | 'adventurer';
    tier: 0 | 1 | 2 | 3;
    userAddress: string;
}

export async function POST(request: NextRequest) {
    try {
        const body: SignPriceRequest = await request.json();
        const { contractType, tier, userAddress } = body;

        // Validate inputs
        if (!contractType || !['tavernkeeper', 'adventurer'].includes(contractType)) {
            return NextResponse.json(
                { error: 'Invalid contractType. Must be "tavernkeeper" or "adventurer"' },
                { status: 400 }
            );
        }

        if (tier === undefined || ![0, 1, 2, 3].includes(tier)) {
            return NextResponse.json(
                { error: 'Invalid tier. Must be 0 (whitelist), 1, 2, or 3' },
                { status: 400 }
            );
        }

        if (!userAddress || !/^0x[a-fA-F0-9]{40}$/.test(userAddress)) {
            return NextResponse.json(
                { error: 'Invalid userAddress. Must be a valid Ethereum address' },
                { status: 400 }
            );
        }

        // Get signer private key from environment
        const signerPrivateKeyRaw = process.env.PRICING_SIGNER_PRIVATE_KEY;
        if (!signerPrivateKeyRaw) {
            console.error('PRICING_SIGNER_PRIVATE_KEY not set in environment');
            return NextResponse.json(
                { error: 'Pricing signer not configured' },
                { status: 500 }
            );
        }

        // Normalize private key: ensure it starts with 0x and is valid hex
        let signerPrivateKey = signerPrivateKeyRaw.trim();
        if (!signerPrivateKey.startsWith('0x')) {
            signerPrivateKey = `0x${signerPrivateKey}`;
        }

        // Validate private key format (should be 0x + 64 hex characters = 66 total)
        if (!/^0x[a-fA-F0-9]{64}$/.test(signerPrivateKey)) {
            console.error('PRICING_SIGNER_PRIVATE_KEY has invalid format. Expected 64 hex characters (with or without 0x prefix)');
            return NextResponse.json(
                { error: 'Invalid pricing signer private key format' },
                { status: 500 }
            );
        }

        // Get contract address
        const contractConfig = contractType === 'tavernkeeper'
            ? CONTRACT_REGISTRY.TAVERNKEEPER
            : CONTRACT_REGISTRY.ADVENTURER;
        const contractAddress = getContractAddress(contractConfig);

        if (!contractAddress) {
            return NextResponse.json(
                { error: 'Contract address not found' },
                { status: 500 }
            );
        }

        // Fetch current MON price
        const monPriceUsd = await getMonPrice();

        // Calculate MON amount from USD price
        const usdPrice = TIER_USD_PRICES[tier];
        const monAmount = usdPrice / monPriceUsd;
        const monAmountWei = parseEther(monAmount.toFixed(18));

        // Get user's current nonce from contract
        const rpcUrl = process.env.NEXT_PUBLIC_MONAD_RPC_URL || monad.rpcUrls.default.http[0];
        const publicClient = createPublicClient({
            chain: monad,
            transport: http(rpcUrl),
        });

        let userNonce = 0n;
        try {
            userNonce = await publicClient.readContract({
                address: contractAddress,
                abi: contractConfig.abi,
                functionName: 'nonces',
                args: [userAddress as `0x${string}`],
            }) as bigint;
        } catch (error) {
            console.error('Failed to fetch nonce from contract:', error);
            // Nonce defaults to 0 if contract call fails
        }

        // Create deadline (5 minutes from now)
        const deadline = BigInt(Math.floor(Date.now() / 1000) + 300);

        // Create hash to sign (same as contract: keccak256(abi.encodePacked(...)))
        // Contract uses: keccak256(abi.encodePacked(msg.sender, amount, nonces[msg.sender], deadline, block.chainid, address(this)))
        const hash = keccak256(
            encodePacked(
                ['address', 'uint256', 'uint256', 'uint256', 'uint256', 'address'],
                [
                    userAddress as `0x${string}`,
                    monAmountWei,
                    userNonce,
                    deadline,
                    BigInt(monad.id),
                    contractAddress,
                ]
            )
        );

        // Sign the hash
        // viem's signMessage automatically adds the Ethereum message prefix
        // Contract does: MessageHashUtils.toEthSignedMessageHash(hash).recover(signature)
        // viem's signMessage does the same: adds prefix, hashes, then signs
        // So we sign the hash directly and viem handles the prefix
        const account = privateKeyToAccount(signerPrivateKey as `0x${string}`);
        const signature = await account.signMessage({
            message: {
                raw: hash, // viem will add "\x19Ethereum Signed Message:\n32" prefix and hash it
            },
        });

        return NextResponse.json({
            amount: formatEther(monAmountWei),
            amountWei: monAmountWei.toString(),
            deadline: deadline.toString(),
            signature: signature,
            monPrice: monPriceUsd,
            usdPrice: usdPrice,
            tier: tier,
        });
    } catch (error) {
        console.error('Error signing price:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to sign price' },
            { status: 500 }
        );
    }
}
