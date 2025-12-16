/**
 * Contract Registry & Versioning System
 *
 * Tracks contract addresses, implementations, versions, and ABIs
 * to ensure game code stays aligned with deployed contracts.
 */

import { type Address } from 'viem';
import { monad } from '../chains';
import { CONTRACT_ADDRESSES, IMPLEMENTATION_ADDRESSES } from './addresses';

export interface ContractConfig {
  name: string;
  proxyAddress?: Address; // Proxy address (if using proxy pattern)
  implementationAddress?: Address; // Implementation address (for proxies)
  directAddress?: Address; // Direct contract address (if not using proxy)
  version: string; // Semantic version (e.g., "1.0.0")
  proxyType?: 'UUPS' | 'Transparent' | 'Beacon' | 'Minimal' | 'None';
  chainId: number;
  abi: readonly any[]; // Contract ABI
  requiredFunctions: string[]; // Function signatures that must exist
  deploymentBlock?: number;
  lastVerified?: Date;
}

export interface ProxyInfo {
  isProxy: boolean;
  proxyType?: 'UUPS' | 'Transparent' | 'Beacon' | 'Minimal';
  implementationAddress?: Address;
  adminAddress?: Address;
  version?: string;
}

// Contract registry - defines expected contracts and their configurations
export const CONTRACT_REGISTRY: Record<string, ContractConfig> = {
  ERC6551_REGISTRY: {
    name: 'ERC6551 Registry',
    directAddress: CONTRACT_ADDRESSES.ERC6551_REGISTRY,
    version: '1.0.0',
    proxyType: 'None', // Registry is typically not upgradeable
    chainId: monad.id,
    abi: [
      {
        inputs: [
          { name: 'implementation', type: 'address' },
          { name: 'salt', type: 'bytes32' },
          { name: 'chainId', type: 'uint256' },
          { name: 'tokenContract', type: 'address' },
          { name: 'tokenId', type: 'uint256' },
        ],
        name: 'account',
        outputs: [{ name: '', type: 'address' }],
        stateMutability: 'view',
        type: 'function',
      },
      {
        inputs: [
          { name: 'implementation', type: 'address' },
          { name: 'salt', type: 'bytes32' },
          { name: 'chainId', type: 'uint256' },
          { name: 'tokenContract', type: 'address' },
          { name: 'tokenId', type: 'uint256' },
        ],
        name: 'createAccount',
        outputs: [{ name: 'account', type: 'address' }],
        stateMutability: 'payable',
        type: 'function',
      },
    ],
    requiredFunctions: ['account', 'createAccount'],
  },
  ERC6551_IMPLEMENTATION: {
    name: 'ERC6551 Account Implementation',
    directAddress: CONTRACT_ADDRESSES.ERC6551_IMPLEMENTATION,
    version: '1.0.0',
    proxyType: 'None', // Implementation itself is not a proxy
    chainId: monad.id,
    abi: [
      {
        inputs: [
          { name: 'to', type: 'address' },
          { name: 'value', type: 'uint256' },
          { name: 'data', type: 'bytes' },
          { name: 'operation', type: 'uint8' },
        ],
        name: 'execute',
        outputs: [{ name: 'result', type: 'bytes' }],
        stateMutability: 'payable',
        type: 'function',
      },
      {
        inputs: [],
        name: 'token',
        outputs: [
          { name: 'chainId', type: 'uint256' },
          { name: 'tokenContract', type: 'address' },
          { name: 'tokenId', type: 'uint256' },
        ],
        stateMutability: 'view',
        type: 'function',
      },
      {
        inputs: [],
        name: 'owner',
        outputs: [{ name: '', type: 'address' }],
        stateMutability: 'view',
        type: 'function',
      },
    ],
    requiredFunctions: ['execute', 'token', 'owner'],
  },
  KEEP_TOKEN: {
    name: 'Keep Token (ERC-20)',
    proxyAddress: CONTRACT_ADDRESSES.KEEP_TOKEN || undefined,
    implementationAddress: IMPLEMENTATION_ADDRESSES.KEEP_TOKEN || undefined,
    version: '1.0.0',
    proxyType: 'UUPS', // Should be upgradeable
    chainId: monad.id,
    abi: [
      {
        inputs: [],
        name: 'totalSupply',
        outputs: [{ name: '', type: 'uint256' }],
        stateMutability: 'view',
        type: 'function',
      },
      {
        inputs: [{ name: 'account', type: 'address' }],
        name: 'balanceOf',
        outputs: [{ name: '', type: 'uint256' }],
        stateMutability: 'view',
        type: 'function',
      },
      {
        inputs: [
          { name: 'to', type: 'address' },
          { name: 'amount', type: 'uint256' },
        ],
        name: 'mint',
        outputs: [],
        stateMutability: 'nonpayable',
        type: 'function',
      },
      {
        inputs: [
          { name: 'from', type: 'address' },
          { name: 'amount', type: 'uint256' },
        ],
        name: 'burn',
        outputs: [],
        stateMutability: 'nonpayable',
        type: 'function',
      },
      {
        inputs: [
          { name: 'owner', type: 'address' },
          { name: 'spender', type: 'address' },
        ],
        name: 'allowance',
        outputs: [{ name: '', type: 'uint256' }],
        stateMutability: 'view',
        type: 'function',
      },
      {
        inputs: [
          { name: 'spender', type: 'address' },
          { name: 'amount', type: 'uint256' },
        ],
        name: 'approve',
        outputs: [{ name: '', type: 'bool' }],
        stateMutability: 'nonpayable',
        type: 'function',
      },
    ],
    requiredFunctions: ['totalSupply', 'balanceOf', 'mint', 'burn'],
  },
  CELLAR_TOKEN: {
    name: 'Cellar Token (CLP)',
    proxyAddress: undefined, // Standard ERC20, not proxy
    directAddress: CONTRACT_ADDRESSES.CELLAR_TOKEN,
    version: '1.0.0',
    proxyType: 'None',
    chainId: monad.id,
    abi: [
      {
        inputs: [],
        name: 'totalSupply',
        outputs: [{ name: '', type: 'uint256' }],
        stateMutability: 'view',
        type: 'function',
      },
      {
        inputs: [{ name: 'account', type: 'address' }],
        name: 'balanceOf',
        outputs: [{ name: '', type: 'uint256' }],
        stateMutability: 'view',
        type: 'function',
      },
      {
        inputs: [
          { name: 'to', type: 'address' },
          { name: 'amount', type: 'uint256' },
        ],
        name: 'transfer',
        outputs: [{ name: '', type: 'bool' }],
        stateMutability: 'nonpayable',
        type: 'function',
      },
      {
        inputs: [
          { name: "spender", type: "address" },
          { name: "amount", type: "uint256" }
        ],
        name: "approve",
        outputs: [{ name: "", type: "bool" }],
        stateMutability: "nonpayable",
        type: "function"
      },
      {
        inputs: [
          { name: "owner", type: "address" },
          { name: "spender", type: "address" }
        ],
        name: "allowance",
        outputs: [{ name: "", type: "uint256" }],
        stateMutability: "view",
        type: "function"
      }
    ],
    requiredFunctions: ['totalSupply', 'balanceOf', 'transfer', 'approve', 'allowance'],
  },
  INVENTORY: {
    name: 'Inventory (ERC-1155)',
    proxyAddress: CONTRACT_ADDRESSES.INVENTORY,
    implementationAddress: IMPLEMENTATION_ADDRESSES.INVENTORY,
    version: '1.0.0',
    proxyType: 'UUPS', // Should be upgradeable
    chainId: monad.id,
    abi: [
      {
        inputs: [
          { name: 'account', type: 'address' },
          { name: 'id', type: 'uint256' },
        ],
        name: 'balanceOf',
        outputs: [{ name: '', type: 'uint256' }],
        stateMutability: 'view',
        type: 'function',
      },
      {
        inputs: [
          { name: 'from', type: 'address' },
          { name: 'to', type: 'address' },
          { name: 'ids', type: 'uint256[]' },
          { name: 'amounts', type: 'uint256[]' },
          { name: 'data', type: 'bytes' },
        ],
        name: 'claimLootWithFee',
        outputs: [],
        stateMutability: 'payable',
        type: 'function',
      },
      {
        inputs: [
          { name: 'from', type: 'address' },
          { name: 'to', type: 'address' },
          { name: 'ids', type: 'uint256[]' },
          { name: 'amounts', type: 'uint256[]' },
          { name: 'data', type: 'bytes' },
        ],
        name: 'safeBatchTransferFrom',
        outputs: [],
        stateMutability: 'nonpayable',
        type: 'function',
      },
      {
        inputs: [
          { name: 'account', type: 'address' },
          { name: 'id', type: 'uint256' },
          { name: 'amount', type: 'uint256' },
          { name: 'data', type: 'bytes' },
        ],
        name: 'safeTransferFrom',
        outputs: [],
        stateMutability: 'nonpayable',
        type: 'function',
      },
      {
        inputs: [
          { name: 'account', type: 'address' },
          { name: 'id', type: 'uint256' },
          { name: 'amount', type: 'uint256' },
          { name: 'data', type: 'bytes' },
        ],
        name: 'mint',
        outputs: [],
        stateMutability: 'payable',
        type: 'function',
      },
      {
        inputs: [],
        name: 'feeRecipient',
        outputs: [{ name: '', type: 'address' }],
        stateMutability: 'view',
        type: 'function',
      },
    ],
    requiredFunctions: ['balanceOf', 'claimLootWithFee', 'safeBatchTransferFrom', 'mint', 'feeRecipient'],
  },
  ADVENTURER: {
    name: 'Adventurer (ERC-721)',
    proxyAddress: CONTRACT_ADDRESSES.ADVENTURER,
    implementationAddress: IMPLEMENTATION_ADDRESSES.ADVENTURER,
    version: '1.0.0',
    proxyType: 'UUPS', // Should be upgradeable
    chainId: monad.id,
    abi: [
      {
        inputs: [{ name: 'tokenId', type: 'uint256' }],
        name: 'ownerOf',
        outputs: [{ name: '', type: 'address' }],
        stateMutability: 'view',
        type: 'function',
      },
      {
        inputs: [{ name: 'tokenId', type: 'uint256' }],
        name: 'tokenURI',
        outputs: [{ name: '', type: 'string' }],
        stateMutability: 'view',
        type: 'function',
      },
      {
        inputs: [
          { name: 'to', type: 'address' },
          { name: 'uri', type: 'string' },
        ],
        name: 'safeMint',
        outputs: [{ name: '', type: 'uint256' }],
        stateMutability: 'nonpayable',
        type: 'function',
      },
      {
        inputs: [
          { name: 'tavernKeeperTokenId', type: 'uint256' },
          { name: 'metadataUri', type: 'string' },
        ],
        name: 'claimFreeHero',
        outputs: [{ name: '', type: 'uint256' }],
        stateMutability: 'nonpayable',
        type: 'function',
      },
      {
        inputs: [{ name: 'tavernKeeperTokenId', type: 'uint256' }],
        name: 'freeHeroClaimed',
        outputs: [{ name: '', type: 'bool' }],
        stateMutability: 'view',
        type: 'function',
      },
      {
        inputs: [{ name: 'tokenId', type: 'uint256' }],
        name: 'getMintPrice',
        outputs: [{ name: '', type: 'uint256' }],
        stateMutability: 'view',
        type: 'function',
      },
      {
        inputs: [],
        name: 'tier1Price',
        outputs: [{ name: '', type: 'uint256' }],
        stateMutability: 'view',
        type: 'function',
      },
      {
        inputs: [
          { name: 'tokenId', type: 'uint256' },
          { name: 'newUri', type: 'string' }
        ],
        name: 'updateTokenURI',
        outputs: [],
        stateMutability: 'nonpayable',
        type: 'function',
      },
      // Whitelist functions (from compiled artifact)
      {
        inputs: [
          { internalType: 'address', name: 'to', type: 'address' },
          { internalType: 'string', name: 'metadataUri', type: 'string' },
          { internalType: 'uint256', name: 'amount', type: 'uint256' },
          { internalType: 'uint256', name: 'deadline', type: 'uint256' },
          { internalType: 'bytes', name: 'signature', type: 'bytes' },
        ],
        name: 'mintHero',
        outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
        stateMutability: 'payable',
        type: 'function',
      },
      {
        inputs: [
          { internalType: 'address', name: 'to', type: 'address' },
          { internalType: 'string', name: 'metadataUri', type: 'string' },
        ],
        name: 'mintHeroWhitelist',
        outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
        stateMutability: 'nonpayable',
        type: 'function',
      },
      {
        inputs: [{ internalType: 'address', name: '', type: 'address' }],
        name: 'nonces',
        outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
        stateMutability: 'view',
        type: 'function',
      },
      {
        inputs: [{ internalType: 'address', name: '', type: 'address' }],
        name: 'whitelist',
        outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
        stateMutability: 'view',
        type: 'function',
      },
      {
        inputs: [{ internalType: 'address', name: '', type: 'address' }],
        name: 'whitelistMinted',
        outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
        stateMutability: 'view',
        type: 'function',
      },
      {
        inputs: [],
        name: 'erc6551Registry',
        outputs: [{ internalType: 'address', name: '', type: 'address' }],
        stateMutability: 'view',
        type: 'function',
      },
      {
        inputs: [],
        name: 'erc6551AccountImpl',
        outputs: [{ internalType: 'address', name: '', type: 'address' }],
        stateMutability: 'view',
        type: 'function',
      },
      {
        inputs: [],
        name: 'tavernKeeperContract',
        outputs: [{ internalType: 'address', name: '', type: 'address' }],
        stateMutability: 'view',
        type: 'function',
      },
    ],
    requiredFunctions: ['ownerOf', 'safeMint', 'whitelist', 'whitelistMinted', 'mintHeroWhitelist'],
  },
  TAVERNKEEPER: {
    name: 'TavernKeeper (ERC-721)',
    proxyAddress: CONTRACT_ADDRESSES.TAVERNKEEPER,
    implementationAddress: IMPLEMENTATION_ADDRESSES.TAVERNKEEPER,
    version: '1.0.0',
    proxyType: 'UUPS', // Should be upgradeable
    chainId: monad.id,
    abi: [
      {
        inputs: [{ name: 'tokenId', type: 'uint256' }],
        name: 'ownerOf',
        outputs: [{ name: '', type: 'address' }],
        stateMutability: 'view',
        type: 'function',
      },
      {
        inputs: [{ name: 'tokenId', type: 'uint256' }],
        name: 'tokenURI',
        outputs: [{ name: '', type: 'string' }],
        stateMutability: 'view',
        type: 'function',
      },
      {
        inputs: [
          { name: 'to', type: 'address' },
          { name: 'uri', type: 'string' },
        ],
        name: 'safeMint',
        outputs: [{ name: '', type: 'uint256' }],
        stateMutability: 'nonpayable',
        type: 'function',
      },
      {
        inputs: [{ name: 'tokenId', type: 'uint256' }],
        name: 'claimTokens',
        outputs: [],
        stateMutability: 'nonpayable',
        type: 'function',
      },
      {
        inputs: [{ name: 'tokenId', type: 'uint256' }],
        name: 'calculatePendingTokens',
        outputs: [{ name: '', type: 'uint256' }],
        stateMutability: 'view',
        type: 'function',
      },
      // The Office Functions (V2)
      {
        inputs: [],
        name: 'getSlot0',
        outputs: [
          {
            components: [
              { name: 'locked', type: 'uint8' },
              { name: 'epochId', type: 'uint16' },
              { name: 'initPrice', type: 'uint192' },
              { name: 'startTime', type: 'uint40' },
              { name: 'dps', type: 'uint256' },
              { name: 'miner', type: 'address' },
              { name: 'uri', type: 'string' },
            ],
            internalType: 'struct TavernKeeper.Slot0',
            name: '',
            type: 'tuple',
          },
        ],

        stateMutability: 'view',
        type: 'function',
      },
      {
        inputs: [],
        name: 'getPrice',
        outputs: [{ name: '', type: 'uint256' }],
        stateMutability: 'view',
        type: 'function',
      },
      {
        inputs: [],
        name: 'getDps',
        outputs: [{ name: '', type: 'uint256' }],
        stateMutability: 'view',
        type: 'function',
      },
      {
        inputs: [
          { name: 'epochId', type: 'uint256' },
          { name: 'deadline', type: 'uint256' },
          { name: 'maxPrice', type: 'uint256' },
          { name: 'uri', type: 'string' },
        ],
        name: 'takeOffice',
        outputs: [{ name: 'price', type: 'uint256' }],
        stateMutability: 'payable',
        type: 'function',
      },
      {
        inputs: [{ name: 'tokenId', type: 'uint256' }],
        name: 'getMintPrice',
        outputs: [{ name: '', type: 'uint256' }],
        stateMutability: 'view',
        type: 'function',
      },
      {
        inputs: [],
        name: 'tier1Price',
        outputs: [{ name: '', type: 'uint256' }],
        stateMutability: 'view',
        type: 'function',
      },
      {
        inputs: [
          { name: 'tokenId', type: 'uint256' },
          { name: 'newUri', type: 'string' }
        ],
        name: 'updateTokenURI',
        outputs: [],
        stateMutability: 'nonpayable',
        type: 'function',
      },
      {
        inputs: [],
        name: 'claimOfficeRewards',
        outputs: [],
        stateMutability: 'nonpayable',
        type: 'function',
      },
      {
        inputs: [],
        name: 'getPendingOfficeRewards',
        outputs: [{ name: '', type: 'uint256' }],
        stateMutability: 'view',
        type: 'function',
      },
      // Pause functions (v4.4.0+)
      {
        inputs: [],
        name: 'paused',
        outputs: [{ name: '', type: 'bool' }],
        stateMutability: 'view',
        type: 'function',
      },
      // Cooldown functions (v4.6.0+)
      {
        inputs: [{ internalType: 'address', name: 'wallet', type: 'address' }],
        name: 'canClaimOffice',
        outputs: [
          { name: 'canClaim', type: 'bool' },
          { name: 'timeRemaining', type: 'uint256' },
        ],
        stateMutability: 'view',
        type: 'function',
      },
      {
        inputs: [{ internalType: 'address', name: 'wallet', type: 'address' }],
        name: 'getLastOfficeClaimTime',
        outputs: [{ name: '', type: 'uint256' }],
        stateMutability: 'view',
        type: 'function',
      },
      {
        inputs: [],
        name: 'COOLDOWN_PERIOD',
        outputs: [{ name: '', type: 'uint256' }],
        stateMutability: 'view',
        type: 'function',
      },
      // Whitelist functions (from compiled artifact)
      {
        inputs: [
          { internalType: 'string', name: 'uri', type: 'string' },
          { internalType: 'uint256', name: 'amount', type: 'uint256' },
          { internalType: 'uint256', name: 'deadline', type: 'uint256' },
          { internalType: 'bytes', name: 'signature', type: 'bytes' },
        ],
        name: 'mintTavernKeeper',
        outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
        stateMutability: 'payable',
        type: 'function',
      },
      {
        inputs: [{ internalType: 'string', name: 'uri', type: 'string' }],
        name: 'mintTavernKeeperWhitelist',
        outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
        stateMutability: 'nonpayable',
        type: 'function',
      },
      {
        inputs: [{ internalType: 'address', name: '', type: 'address' }],
        name: 'nonces',
        outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
        stateMutability: 'view',
        type: 'function',
      },
      {
        inputs: [{ internalType: 'address', name: '', type: 'address' }],
        name: 'whitelist',
        outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
        stateMutability: 'view',
        type: 'function',
      },
      {
        inputs: [{ internalType: 'address', name: '', type: 'address' }],
        name: 'whitelistMinted',
        outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
        stateMutability: 'view',
        type: 'function',
      },
    ],
    requiredFunctions: ['ownerOf', 'safeMint', 'claimTokens', 'calculatePendingTokens', 'takeOffice', 'getSlot0', 'claimOfficeRewards', 'whitelist', 'whitelistMinted', 'mintTavernKeeperWhitelist'],
  },
  THECELLAR: {
    name: 'TheCellarV3 (Uniswap V3 Managed)',
    proxyAddress: CONTRACT_ADDRESSES.THE_CELLAR,
    version: '3.0.0',
    proxyType: 'UUPS',
    chainId: monad.id,
    abi: [
      {
        inputs: [
          { name: 'amountMonDesired', type: 'uint256' },
          { name: 'amountKeepDesired', type: 'uint256' },
        ],
        name: 'addLiquidity',
        outputs: [{ name: 'liquidity', type: 'uint256' }],
        stateMutability: 'nonpayable',
        type: 'function',
      },
      {
        inputs: [{ name: 'lpAmount', type: 'uint256' }],
        name: 'withdraw',
        outputs: [],
        stateMutability: 'nonpayable',
        type: 'function',
      },
      {
        inputs: [{ name: 'lpBid', type: 'uint256' }],
        name: 'raid',
        outputs: [],
        stateMutability: 'nonpayable',
        type: 'function',
      },
      {
        inputs: [],
        name: 'harvest',
        outputs: [],
        stateMutability: 'nonpayable',
        type: 'function',
      },
      {
        inputs: [],
        name: 'potBalanceMON',
        outputs: [{ name: '', type: 'uint256' }],
        stateMutability: 'view',
        type: 'function',
      },
      {
        inputs: [],
        name: 'potBalanceKEEP',
        outputs: [{ name: '', type: 'uint256' }],
        stateMutability: 'view',
        type: 'function',
      },
      {
        inputs: [],
        name: 'tokenId',
        outputs: [{ name: '', type: 'uint256' }],
        stateMutability: 'view',
        type: 'function',
      },
      {
        inputs: [],
        name: 'cellarToken',
        outputs: [{ name: '', type: 'address' }],
        stateMutability: 'view',
        type: 'function',
      },
      {
        inputs: [],
        name: 'getAuctionPrice',
        outputs: [{ name: '', type: 'uint256' }],
        stateMutability: 'view',
        type: 'function',
      },
      {
        inputs: [],
        name: 'slot0',
        outputs: [
          {
            components: [
              { name: 'locked', type: 'uint8' },
              { name: 'epochId', type: 'uint16' },
              { name: 'initPrice', type: 'uint192' },
              { name: 'startTime', type: 'uint40' },
            ],
            internalType: 'struct TheCellarV3.Slot0',
            name: '',
            type: 'tuple',
          },
        ],
        stateMutability: 'view',
        type: 'function',
      },
      {
        inputs: [],
        name: 'epochPeriod',
        outputs: [{ name: '', type: 'uint256' }],
        stateMutability: 'view',
        type: 'function',
      },
      {
        inputs: [],
        name: 'priceMultiplier',
        outputs: [{ name: '', type: 'uint256' }],
        stateMutability: 'view',
        type: 'function',
      },
      {
        inputs: [],
        name: 'minInitPrice',
        outputs: [{ name: '', type: 'uint256' }],
        stateMutability: 'view',
        type: 'function',
      },
    ],
    requiredFunctions: ['addLiquidity', 'withdraw', 'raid', 'potBalanceMON', 'potBalanceKEEP', 'getAuctionPrice', 'slot0'],
  },
  CELLAR_ZAP: {
    name: 'CellarZap V4',
    proxyAddress: CONTRACT_ADDRESSES.CELLAR_ZAP,
    version: '1.0.0',
    proxyType: 'UUPS',
    chainId: monad.id,
    abi: [
      {
        inputs: [
          { name: 'amountMON', type: 'uint256' },
          { name: 'amountKEEP', type: 'uint256' },
        ],
        name: 'mintLP',
        outputs: [],
        stateMutability: 'payable',
        type: 'function',
      },
    ],

    requiredFunctions: ['mintLP'],
  },
  TAVERN_REGULARS_MANAGER: {
    name: 'Tavern Regulars Manager',
    proxyAddress: CONTRACT_ADDRESSES.TAVERN_REGULARS_MANAGER,
    version: '1.0.0',
    proxyType: 'UUPS',
    chainId: monad.id,
    abi: [
      {
        inputs: [{ name: 'groupName', type: 'string' }],
        name: 'createTavernRegularsGroup',
        outputs: [{ name: 'groupId', type: 'uint256' }],
        stateMutability: 'nonpayable',
        type: 'function',
      },
      {
        inputs: [{ name: 'groupId', type: 'uint256' }],
        name: 'joinTavernRegularsGroup',
        outputs: [],
        stateMutability: 'nonpayable',
        type: 'function',
      },
      {
        inputs: [
          { name: 'groupId', type: 'uint256' },
          { name: 'amountMON', type: 'uint256' },
          { name: 'amountKEEP', type: 'uint256' },
        ],
        name: 'contributeToTavernRegularsGroup',
        outputs: [{ name: 'lpTokensReceived', type: 'uint256' }],
        stateMutability: 'payable',
        type: 'function',
      },
      {
        inputs: [
          { name: 'groupId', type: 'uint256' },
          { name: 'lpTokenAmount', type: 'uint256' },
        ],
        name: 'withdrawFromTavernRegularsGroup',
        outputs: [],
        stateMutability: 'nonpayable',
        type: 'function',
      },
      {
        inputs: [
          { name: 'groupId', type: 'uint256' },
          { name: 'totalFees', type: 'uint256' },
        ],
        name: 'distributeGroupFees',
        outputs: [],
        stateMutability: 'payable',
        type: 'function',
      },
      {
        inputs: [{ name: 'groupId', type: 'uint256' }],
        name: 'claimTavernRegularsFees',
        outputs: [],
        stateMutability: 'nonpayable',
        type: 'function',
      },
      {
        inputs: [{ name: 'groupId', type: 'uint256' }],
        name: 'getGroupMembers',
        outputs: [{ name: '', type: 'address[]' }],
        stateMutability: 'view',
        type: 'function',
      },
      {
        inputs: [
          { name: 'groupId', type: 'uint256' },
          { name: 'member', type: 'address' },
        ],
        name: 'getMemberShare',
        outputs: [{ name: '', type: 'uint256' }],
        stateMutability: 'view',
        type: 'function',
      },
      {
        inputs: [
          { name: 'groupId', type: 'uint256' },
          { name: 'member', type: 'address' },
        ],
        name: 'getPendingFees',
        outputs: [{ name: '', type: 'uint256' }],
        stateMutability: 'view',
        type: 'function',
      },
      {
        inputs: [{ name: 'user', type: 'address' }],
        name: 'getUserGroups',
        outputs: [{ name: '', type: 'uint256[]' }],
        stateMutability: 'view',
        type: 'function',
      },
    ],
    requiredFunctions: ['createTavernRegularsGroup', 'joinTavernRegularsGroup', 'contributeToTavernRegularsGroup'],
  },
  TOWN_POSSE_MANAGER: {
    name: 'Town Posse Manager',
    proxyAddress: CONTRACT_ADDRESSES.TOWN_POSSE_MANAGER,
    version: '1.0.0',
    proxyType: 'UUPS',
    chainId: monad.id,
    abi: [
      {
        inputs: [
          { name: 'name', type: 'string' },
          { name: 'maxMembers', type: 'uint256' },
          { name: 'openMembership', type: 'bool' },
          { name: 'minContribution', type: 'uint256' },
        ],
        name: 'createTownPosse',
        outputs: [{ name: 'posseId', type: 'uint256' }],
        stateMutability: 'nonpayable',
        type: 'function',
      },
      {
        inputs: [{ name: 'posseId', type: 'uint256' }],
        name: 'requestJoinTownPosse',
        outputs: [],
        stateMutability: 'nonpayable',
        type: 'function',
      },
      {
        inputs: [
          { name: 'posseId', type: 'uint256' },
          { name: 'member', type: 'address' },
        ],
        name: 'approveTownPosseMember',
        outputs: [],
        stateMutability: 'nonpayable',
        type: 'function',
      },
      {
        inputs: [
          { name: 'posseId', type: 'uint256' },
          { name: 'amountMON', type: 'uint256' },
          { name: 'amountKEEP', type: 'uint256' },
        ],
        name: 'contributeToTownPosse',
        outputs: [{ name: 'lpTokensReceived', type: 'uint256' }],
        stateMutability: 'payable',
        type: 'function',
      },
      {
        inputs: [
          { name: 'posseId', type: 'uint256' },
          { name: 'lpTokenAmount', type: 'uint256' },
        ],
        name: 'withdrawFromTownPosse',
        outputs: [],
        stateMutability: 'nonpayable',
        type: 'function',
      },
      {
        inputs: [
          { name: 'posseId', type: 'uint256' },
          { name: 'description', type: 'string' },
          { name: 'data', type: 'bytes' },
        ],
        name: 'createTownPosseProposal',
        outputs: [{ name: 'proposalId', type: 'uint256' }],
        stateMutability: 'nonpayable',
        type: 'function',
      },
      {
        inputs: [
          { name: 'posseId', type: 'uint256' },
          { name: 'proposalId', type: 'uint256' },
          { name: 'support', type: 'bool' },
        ],
        name: 'voteOnTownPosseProposal',
        outputs: [],
        stateMutability: 'nonpayable',
        type: 'function',
      },
      {
        inputs: [
          { name: 'posseId', type: 'uint256' },
          { name: 'proposalId', type: 'uint256' },
        ],
        name: 'executeTownPosseProposal',
        outputs: [],
        stateMutability: 'nonpayable',
        type: 'function',
      },
      {
        inputs: [
          { name: 'posseId', type: 'uint256' },
          { name: 'totalFees', type: 'uint256' },
        ],
        name: 'distributeTownPosseFees',
        outputs: [],
        stateMutability: 'payable',
        type: 'function',
      },
      {
        inputs: [{ name: 'posseId', type: 'uint256' }],
        name: 'claimTownPosseFees',
        outputs: [],
        stateMutability: 'nonpayable',
        type: 'function',
      },
      {
        inputs: [{ name: 'posseId', type: 'uint256' }],
        name: 'getPosseMembers',
        outputs: [{ name: '', type: 'address[]' }],
        stateMutability: 'view',
        type: 'function',
      },
      {
        inputs: [
          { name: 'posseId', type: 'uint256' },
          { name: 'member', type: 'address' },
        ],
        name: 'getMemberTier',
        outputs: [{ name: '', type: 'uint256' }],
        stateMutability: 'view',
        type: 'function',
      },
      {
        inputs: [
          { name: 'posseId', type: 'uint256' },
          { name: 'member', type: 'address' },
        ],
        name: 'getMemberShare',
        outputs: [{ name: '', type: 'uint256' }],
        stateMutability: 'view',
        type: 'function',
      },
      {
        inputs: [{ name: 'user', type: 'address' }],
        name: 'getUserPosses',
        outputs: [{ name: '', type: 'uint256[]' }],
        stateMutability: 'view',
        type: 'function',
      },
    ],
    requiredFunctions: ['createTownPosse', 'requestJoinTownPosse', 'contributeToTownPosse'],

  },
  LP_STAKING: {
    name: 'LP Staking',
    directAddress: CONTRACT_ADDRESSES.LP_STAKING,
    version: '1.0.0',
    proxyType: 'None',
    chainId: monad.id,
    abi: [
      {
        inputs: [
          { name: 'amount', type: 'uint256' },
          { name: 'lockDays', type: 'uint256' },
        ],
        name: 'stake',
        outputs: [],
        stateMutability: 'nonpayable',
        type: 'function',
      },
      {
        inputs: [{ name: 'amount', type: 'uint256' }],
        name: 'unstake',
        outputs: [],
        stateMutability: 'nonpayable',
        type: 'function',
      },
      {
        inputs: [],
        name: 'claimRewards',
        outputs: [],
        stateMutability: 'nonpayable',
        type: 'function',
      },
      {
        inputs: [{ name: 'user', type: 'address' }],
        name: 'getPendingRewards',
        outputs: [{ name: '', type: 'uint256' }],
        stateMutability: 'view',
        type: 'function',
      },
      {
        inputs: [{ name: 'user', type: 'address' }],
        name: 'getUserStake',
        outputs: [
          {
            components: [
              { name: 'amount', type: 'uint256' },
              { name: 'lockExpiry', type: 'uint256' },
              { name: 'lockMultiplier', type: 'uint256' },
              { name: 'rewardDebt', type: 'uint256' },
            ],
            name: '',
            type: 'tuple',
          },
        ],
        stateMutability: 'view',
        type: 'function',
      },
      {
        inputs: [],
        name: 'stakingToken',
        outputs: [{ name: '', type: 'address' }],
        stateMutability: 'view',
        type: 'function',
      },
      {
        inputs: [],
        name: 'rewardToken',
        outputs: [{ name: '', type: 'address' }],
        stateMutability: 'view',
        type: 'function',
      },
      {
        inputs: [],
        name: 'totalWeightedStake',
        outputs: [{ name: '', type: 'uint256' }],
        stateMutability: 'view',
        type: 'function',
      },
    ],
    requiredFunctions: ['stake', 'unstake', 'claimRewards', 'getPendingRewards'],
  },
  KEEP_STAKING: {
    name: 'KEEP Staking',
    directAddress: CONTRACT_ADDRESSES.KEEP_STAKING,
    version: '1.0.0',
    proxyType: 'None',
    chainId: monad.id,
    abi: [
      {
        inputs: [
          { name: 'amount', type: 'uint256' },
          { name: 'lockDays', type: 'uint256' },
        ],
        name: 'stake',
        outputs: [],
        stateMutability: 'nonpayable',
        type: 'function',
      },
      {
        inputs: [{ name: 'amount', type: 'uint256' }],
        name: 'unstake',
        outputs: [],
        stateMutability: 'nonpayable',
        type: 'function',
      },
      {
        inputs: [],
        name: 'claimRewards',
        outputs: [],
        stateMutability: 'nonpayable',
        type: 'function',
      },
      {
        inputs: [{ name: 'user', type: 'address' }],
        name: 'getPendingRewards',
        outputs: [{ name: '', type: 'uint256' }],
        stateMutability: 'view',
        type: 'function',
      },
      {
        inputs: [{ name: 'user', type: 'address' }],
        name: 'getUserStake',
        outputs: [
          {
            components: [
              { name: 'amount', type: 'uint256' },
              { name: 'lockExpiry', type: 'uint256' },
              { name: 'lockMultiplier', type: 'uint256' },
              { name: 'rewardDebt', type: 'uint256' },
            ],
            name: '',
            type: 'tuple',
          },
        ],
        stateMutability: 'view',
        type: 'function',
      },
      {
        inputs: [],
        name: 'stakingToken',
        outputs: [{ name: '', type: 'address' }],
        stateMutability: 'view',
        type: 'function',
      },
      {
        inputs: [],
        name: 'rewardToken',
        outputs: [{ name: '', type: 'address' }],
        stateMutability: 'view',
        type: 'function',
      },
      {
        inputs: [],
        name: 'totalWeightedStake',
        outputs: [{ name: '', type: 'uint256' }],
        stateMutability: 'view',
        type: 'function',
      },
    ],
    requiredFunctions: ['stake', 'unstake', 'claimRewards', 'getPendingRewards'],
  },
};

/**
 * Get the fee recipient address (treasury wallet)
 */
export function getFeeRecipientAddress(): Address | null {
  return CONTRACT_ADDRESSES.FEE_RECIPIENT;
}

/**
 * Get the active contract address (proxy if exists, otherwise direct)
 */
export function getContractAddress(config: ContractConfig): Address | undefined {
  if (config.proxyAddress) {
    return config.proxyAddress;
  }
  return config.directAddress;
}

/**
 * Get all contract addresses that should be configured
 */
export function getRequiredContractAddresses(): Record<string, Address | undefined> {
  const addresses: Record<string, Address | undefined> = {};

  for (const [key, config] of Object.entries(CONTRACT_REGISTRY)) {
    addresses[key] = getContractAddress(config);
  }

  return addresses;
}

