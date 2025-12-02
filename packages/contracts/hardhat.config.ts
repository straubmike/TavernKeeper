import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@openzeppelin/hardhat-upgrades";
import * as dotenv from "dotenv";

dotenv.config({ path: "../../.env" });

const MONAD_RPC_URL = process.env.NEXT_PUBLIC_MONAD_RPC_URL || "https://testnet-rpc.monad.xyz";

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
                enabled: false,
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
