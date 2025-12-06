import { defineChain } from 'viem';

// Monad chain definition
const USE_LOCALHOST = process.env.NEXT_PUBLIC_USE_LOCALHOST === 'true';
const CHAIN_ID = parseInt(process.env.NEXT_PUBLIC_MONAD_CHAIN_ID || '143');

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
            http: [
                USE_LOCALHOST
                    ? 'http://127.0.0.1:8545'
                    : (process.env.NEXT_PUBLIC_MONAD_RPC_URL || (CHAIN_ID === 143 ? 'https://rpc.monad.xyz' : 'https://testnet-rpc.monad.xyz'))
            ],
        },
    },
    blockExplorers: {
        default: {
            name: 'Monad Explorer',
            url: process.env.NEXT_PUBLIC_MONAD_EXPLORER_URL || 'https://testnet-explorer.monad.xyz',
        },
    },
});
