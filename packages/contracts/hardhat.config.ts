import "@nomicfoundation/hardhat-toolbox";
import "@openzeppelin/hardhat-upgrades";
import * as dotenv from "dotenv";
import { HardhatUserConfig } from "hardhat/config";

dotenv.config({ path: "../../.env" });

// Get RPC URL - prioritize Alchemy if API key is provided
function getRpcUrl(): string {
    // If explicit RPC URL is set, use it
    if (process.env.NEXT_PUBLIC_MONAD_RPC_URL) {
        return process.env.NEXT_PUBLIC_MONAD_RPC_URL;
    }

    // Use Alchemy if API key is provided
    const alchemyApiKey = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY || process.env.ALCHEMY_API_KEY;
    const chainId = parseInt(process.env.NEXT_PUBLIC_MONAD_CHAIN_ID || "10143");

    if (alchemyApiKey) {
        if (chainId === 143) {
            return `https://monad-mainnet.g.alchemy.com/v2/${alchemyApiKey}`;
        } else {
            return `https://monad-testnet.g.alchemy.com/v2/${alchemyApiKey}`;
        }
    }

    // Fallback to free RPC (deprecated - will hit rate limits)
    return chainId === 143 ? "https://rpc.monad.xyz" : "https://testnet-rpc.monad.xyz";
}

const MONAD_RPC_URL = getRpcUrl();

const config: HardhatUserConfig = {
    solidity: {
        compilers: [
            {
                version: "0.8.24",
                settings: {
                    optimizer: {
                        enabled: true,
                        runs: 200,
                    },
                    viaIR: true,
                    evmVersion: "cancun",
                },
            },
            {
                version: "0.8.26",
                settings: {
                    optimizer: {
                        enabled: true,
                        runs: 200,
                    },
                    viaIR: true,
                    evmVersion: "cancun",
                },
            },
        ],
    },
    networks: {
        hardhat: {
            chainId: 31337,
            forking: {
                url: MONAD_RPC_URL,
                enabled: true,
            },
        },
        localhost: {
            url: "http://127.0.0.1:8545",
            accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
        },
        monad: {
            url: MONAD_RPC_URL,
            chainId: parseInt(process.env.NEXT_PUBLIC_MONAD_CHAIN_ID || "10143"),
            accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
        },
    },
    etherscan: {
        apiKey: process.env.ETHERSCAN_API_KEY || "empty",
        customChains: [
            {
                network: "monad",
                chainId: parseInt(process.env.NEXT_PUBLIC_MONAD_CHAIN_ID || "10143"),
                urls: {
                    apiURL: parseInt(process.env.NEXT_PUBLIC_MONAD_CHAIN_ID || "10143") === 143
                        ? "https://api.monadscan.com/api"
                        : "https://api-testnet.monadscan.com/api",
                    browserURL: parseInt(process.env.NEXT_PUBLIC_MONAD_CHAIN_ID || "10143") === 143
                        ? "https://monadscan.com"
                        : "https://testnet.monadscan.com"
                }
            }
        ]
    },
    paths: {
        sources: "./contracts",
        tests: "./test",
        cache: "./cache",
        artifacts: "./artifacts",
    },
};

export default config;
