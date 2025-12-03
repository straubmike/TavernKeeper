import { Address } from 'viem';

/**
 * Address Configuration:
 * - DEPLOYER_ADDRESS: Wallet receiving team/dev fees (5% from TavernKeeper, owner tax from groups)
 * - FEE_RECIPIENT_ADDRESS: Wallet receiving Inventory contract fees (loot claiming)
 * - TREASURY_ADDRESS: Wallet receiving 5% from group manager fees (TavernRegulars/TownPosse)
 * - THE_CELLAR: CellarHook contract receiving 15% from TavernKeeper Office fees (pot)
 */

// Monad Testnet Addresses (Chain ID: 10143)
const MONAD_TESTNET_ADDRESSES = {
    // Infrastructure
    ERC6551_REGISTRY: '0xca3f315D82cE6Eecc3b9E29Ecc8654BA61e7508C' as Address,
    ERC6551_IMPLEMENTATION: '0x9B5980110654dcA57a449e2D6BEc36fE54123B0F' as Address,

    // Game Contracts (Proxies)
    KEEP_TOKEN: '0x96982EC3625145f098DCe06aB34E99E7207b0520' as Address,
    INVENTORY: '0x2ABb5F58DE56948dD0E06606B88B43fFe86206c2' as Address,
    ADVENTURER: '0x4Fff2Ce5144989246186462337F0eE2C086F913E' as Address,
    TAVERNKEEPER: '0xFaC0786eF353583FBD43Ee7E7e84836c1857A381' as Address,
    DUNGEON_GATEKEEPER: '0x931Bf6DF5AC8d75b97Cb9cF0800F4C2831085c45' as Address,

    // Treasury / Mechanics
    THE_CELLAR: '0xA43034595E2d1c52Ab08a057B95dD38bCbFf87dC' as Address,
    CELLAR_ZAP: '0x8a2bA1Bc458c17dB722ce36EF015e33959eD167a' as Address,
    POOL_MANAGER: '0x8788E862023A49a77E8F27277a8b3F07B4E9A7d8' as Address,
    // Fee recipient from env (NEXT_PUBLIC_FEE_RECIPIENT_ADDRESS), fallback to Cellar if not set
    FEE_RECIPIENT: (process.env.NEXT_PUBLIC_FEE_RECIPIENT_ADDRESS as Address | undefined) || '0xaB837301d12cDc4b97f1E910FC56C9179894d9cf' as Address,

    // Group LP Management
    TAVERN_REGULARS_MANAGER: '0xE671CA8cDA72a70Ca4adb8BCfA03631FCfFe2cE8' as Address,
    TOWN_POSSE_MANAGER: '0xEa0F26c751b27504Df2D6D99Aa225e8f0D79Be58' as Address,
};

// Monad Mainnet Addresses (Chain ID: 143) - From FIRSTDEPLOYMENT.md
const MONAD_MAINNET_ADDRESSES = {
    // Infrastructure
    ERC6551_REGISTRY: '0xE74D0b9372e81037e11B4DEEe27D063C24060Ea9' as Address,
    ERC6551_IMPLEMENTATION: '0xb7160ebCd3C85189ee950570EABfA4dC22234Ec7' as Address,

    // Game Contracts (Proxies)
    KEEP_TOKEN: '0x2D1094F5CED6ba279962f9676d32BE092AFbf82E' as Address,
    INVENTORY: '0xcB11EFb6E697b5eD7841717b4C994D3edC8393b4' as Address,
    ADVENTURER: '0xb138Bf579058169e0657c12Fd9cc1267CAFcb935' as Address,
    TAVERNKEEPER: '0x56B81A60Ae343342685911bd97D1331fF4fa2d29' as Address,
    DUNGEON_GATEKEEPER: '0xf454A4A4f2F960a5d5b7583A289dCAE765d57355' as Address,

    // Treasury / Mechanics
    THE_CELLAR: '0x6c7612F44B71E5E6E2bA0FEa799A23786A537755' as Address,
    CELLAR_ZAP: '0xf7248a01051bf297Aa56F12a05e7209C60Fc5863' as Address,
    POOL_MANAGER: '0x27e98f6A0D3315F9f3ECDaFE0187a7637F41c7c2' as Address,
    // Fee recipient from env (NEXT_PUBLIC_FEE_RECIPIENT_ADDRESS), fallback to Cellar if not set
    FEE_RECIPIENT: (process.env.NEXT_PUBLIC_FEE_RECIPIENT_ADDRESS as Address | undefined) || '0x6c7612F44B71E5E6E2bA0FEa799A23786A537755' as Address,

    // Group LP Management
    TAVERN_REGULARS_MANAGER: '0x9f455Ad562e080CC745f9E97c469a86E1bBF8db8' as Address,
    TOWN_POSSE_MANAGER: '0xE46592D8185975888b4A301DBD9b24A49933CC7D' as Address,
};

// Localhost Addresses (for local development)
export const LOCALHOST_ADDRESSES = {
    // Infrastructure
    ERC6551_REGISTRY: '0xE74D0b9372e81037e11B4DEEe27D063C24060Ea9' as Address,
    ERC6551_IMPLEMENTATION: '0xb7160ebCd3C85189ee950570EABfA4dC22234Ec7' as Address,

    // Game Contracts (Proxies) - These should be from local deployment
    KEEP_TOKEN: '0x2D1094F5CED6ba279962f9676d32BE092AFbf82E' as Address,
    INVENTORY: '0xcB11EFb6E697b5eD7841717b4C994D3edC8393b4' as Address,
    ADVENTURER: '0xb138Bf579058169e0657c12Fd9cc1267CAFcb935' as Address,
    TAVERNKEEPER: '0x56B81A60Ae343342685911bd97D1331fF4fa2d29' as Address,
    DUNGEON_GATEKEEPER: '0xf454A4A4f2F960a5d5b7583A289dCAE765d57355' as Address,

    // Treasury / Mechanics
    THE_CELLAR: '0x6c7612F44B71E5E6E2bA0FEa799A23786A537755' as Address,
    CELLAR_ZAP: '0xf7248a01051bf297Aa56F12a05e7209C60Fc5863' as Address,
    POOL_MANAGER: '0x27e98f6A0D3315F9f3ECDaFE0187a7637F41c7c2' as Address,
    // Fee recipient from env (NEXT_PUBLIC_FEE_RECIPIENT_ADDRESS), fallback to Cellar if not set
    FEE_RECIPIENT: (process.env.NEXT_PUBLIC_FEE_RECIPIENT_ADDRESS as Address | undefined) || '0x6c7612F44B71E5E6E2bA0FEa799A23786A537755' as Address,

    // Group LP Management
    TAVERN_REGULARS_MANAGER: '0x9f455Ad562e080CC745f9E97c469a86E1bBF8db8' as Address,
    TOWN_POSSE_MANAGER: '0xE46592D8185975888b4A301DBD9b24A49933CC7D' as Address,
};

// Get chain ID from environment (143 = mainnet, 10143 = testnet)
const getChainId = (): number => {
    const chainId = process.env.NEXT_PUBLIC_MONAD_CHAIN_ID;
    if (!chainId) return 143; // Default to mainnet
    const parsed = parseInt(chainId, 10);
    return isNaN(parsed) ? 143 : parsed;
};

// Choose addresses based on USE_LOCALHOST flag and chain ID
const USE_LOCALHOST = process.env.NEXT_PUBLIC_USE_LOCALHOST === 'true';
const chainId = getChainId();

// CONTRACT_ADDRESSES switches based on localhost flag and chain ID
let CONTRACT_ADDRESSES: typeof MONAD_MAINNET_ADDRESSES;
if (USE_LOCALHOST) {
    CONTRACT_ADDRESSES = LOCALHOST_ADDRESSES;
} else if (chainId === 143) {
    // Mainnet
    CONTRACT_ADDRESSES = MONAD_MAINNET_ADDRESSES;
} else {
    // Testnet (10143) or fallback
    CONTRACT_ADDRESSES = MONAD_TESTNET_ADDRESSES;
}

export { CONTRACT_ADDRESSES };

// CRITICAL VALIDATION: Ensure no zero addresses in production
if (typeof window === 'undefined') {
    // Server-side validation
    for (const [key, address] of Object.entries(CONTRACT_ADDRESSES)) {
        if (address === '0x0000000000000000000000000000000000000000') {
            console.error(`🚨 CRITICAL ERROR: ${key} address is ZERO! This will break in production!`);
            console.error(`   USE_LOCALHOST=${USE_LOCALHOST}`);
            console.error(`   Chain ID=${chainId}`);
            console.error(`   Set NEXT_PUBLIC_USE_LOCALHOST=true for localhost or ensure addresses are correct`);
        }
    }
}

// Implementation Addresses (for reference/verification)
export const IMPLEMENTATION_ADDRESSES = {
    KEEP_TOKEN: '0x848750141b51C6bF0db2549b7CD6637866A6c635' as Address,
    INVENTORY: '0x54F3f6b654176914452380C9270DFB45F2985e8B' as Address,
    ADVENTURER: '0x71fb2B063569dD5B91c6241A9d6A41536894835A' as Address,
    TAVERNKEEPER: '0x48D8aeB5AD8175c701910A9Cf0aB25a9AeB048C6' as Address,
    DUNGEON_GATEKEEPER: '0x4CAC1ea1aa8ba7b7C25930CCA224AC166073DF13' as Address,
    THE_CELLAR: '0x9b08076b569b0bDB56Ae630ca3587fE5A3cF09C4' as Address, // CellarHook implementation
    CELLAR_ZAP: '0x0aE0878FB0CA0D9d64e08B861371f69C944ae418' as Address, // CellarZapV4 implementation
};
