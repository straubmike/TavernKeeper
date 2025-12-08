import { defineChain } from 'viem';

// Monad chain definition
const USE_LOCALHOST = process.env.NEXT_PUBLIC_USE_LOCALHOST === 'true';
const CHAIN_ID = parseInt(process.env.NEXT_PUBLIC_MONAD_CHAIN_ID || '143');

// Get RPC URL - prioritize Alchemy if API key is provided
function getRpcUrl(): string {
    if (USE_LOCALHOST) {
        return 'http://127.0.0.1:8545';
    }

    // If explicit RPC URL is set, use it
    if (process.env.NEXT_PUBLIC_MONAD_RPC_URL) {
        return process.env.NEXT_PUBLIC_MONAD_RPC_URL;
    }

    // Use Alchemy if API key is provided
    const alchemyApiKey = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY || process.env.ALCHEMY_API_KEY;
    if (alchemyApiKey) {
        if (CHAIN_ID === 143) {
            return `https://monad-mainnet.g.alchemy.com/v2/${alchemyApiKey}`;
        } else {
            return `https://monad-testnet.g.alchemy.com/v2/${alchemyApiKey}`;
        }
    }

    // Fallback to free RPC (deprecated - will hit rate limits)
    return CHAIN_ID === 143 ? 'https://rpc.monad.xyz' : 'https://testnet-rpc.monad.xyz';
}

// Monad chain definition
export const monad = defineChain({
    id: CHAIN_ID,
    name: USE_LOCALHOST ? 'Monad Local' : (CHAIN_ID === 143 ? 'Monad Mainnet' : 'Monad Testnet'),
    nativeCurrency: {
        name: 'Monad',
        symbol: 'MON',
        decimals: 18,
    },
    rpcUrls: {
        default: {
            http: [getRpcUrl()],
        },
    },
    blockExplorers: {
        default: {
            name: 'Monad Explorer',
            url: process.env.NEXT_PUBLIC_MONAD_EXPLORER_URL || 'https://testnet-explorer.monad.xyz',
        },
    },
});
