# Contract Deployment Tracker

**CRITICAL: DO NOT REDEPLOY CONTRACTS WITHOUT UPDATING THIS FILE**

This file tracks all contract deployments. **ALWAYS** update this file when deploying contracts.

## Current Status: ✅ DEPLOYED TO MONAD TESTNET

**All contracts have been deployed to Monad Testnet as UUPS upgradeable proxies.**

---

## Contract Inventory

### 1. ERC-6551 Infrastructure (Not Upgradeable)

#### ERC6551Registry
- **Status**: ✅ **DEPLOYED** (infrastructure contract, not upgradeable)
- **Type**: Direct implementation
- **Purpose**: Registry for creating Token Bound Accounts (TBAs)
- **Upgradeable**: No (infrastructure contract)
- **Deployed Address**: `0xE8D519d1C3972Fb8833262333D3152739f9e960b`
- **Network**: Monad Testnet
- **Deployment Date**: 2025-01-XX
- **Deployment TX**: See deployment output
- **Notes**: Standard ERC-6551 registry implementation

#### ERC6551Account (Implementation)
- **Status**: ✅ **DEPLOYED** (implementation contract, not upgradeable)
- **Type**: Direct implementation
- **Purpose**: TBA account implementation (deployed via CREATE2)
- **Upgradeable**: No (implementation contract)
- **Deployed Address**: `0x0C829384eDb3E2A79Af1405aE6A43A0292e30548`
- **Network**: Monad Testnet
- **Deployment Date**: 2025-01-XX
- **Deployment TX**: See deployment output
- **Notes**: Each NFT gets a unique TBA address via CREATE2

---

### 2. Game Contracts (Need Proxy Conversion)

#### KeepToken (ERC-20)
- **Status**: ✅ **DEPLOYED** - UUPS upgradeable proxy
- **Current Type**: UUPS Upgradeable Proxy ✅
- **Purpose**: In-game currency token
- **Upgradeable**: Yes ✅
- **Proxy Address**: `0x53f7C41787bc45700F2450CAC956F5649f3d986A`
- **Implementation Address**: `0x5EA8Edb99E9a070c8f4358e0904b7cE63e7d5866`
- **Network**: Monad Testnet
- **Deployment Date**: 2025-01-XX
- **Deployment TX**: See deployment output
- **Notes**: Successfully deployed as UUPS proxy. Minting controlled by TavernKeeper contract.
<<<<<<< HEAD
=======

#### Inventory (ERC-1155)
- **Status**: ✅ **DEPLOYED** - UUPS upgradeable proxy
- **Current Type**: UUPS Upgradeable Proxy ✅
- **Purpose**: ERC-1155 items/inventory contract
- **Upgradeable**: Yes ✅
- **Proxy Address**: `0xE75948afaAc46E3C456C1023d4c7F00392a92344`
- **Implementation Address**: `0xc03bC9D0BD59b98535aEBD2102221AeD87c820A6`
- **Network**: Monad Testnet
- **Deployment Date**: 2025-01-XX
- **Deployment TX**: See deployment output
- **Fee Recipient**: `0xEC4bc7451B9058D42Ea159464C6dA14a322946fD` (deployer)
- **Notes**:
  - Successfully deployed as UUPS proxy
  - Has fee collection built-in via `claimLootWithFee()`
  - Fees go back to deployer wallet

>>>>>>> d9c80166f06c3f6075f2ba2e63c2d068690df2ca
#### Adventurer (ERC-721)
- **Status**: ✅ **DEPLOYED** - UUPS upgradeable proxy
- **Current Type**: UUPS Upgradeable Proxy ✅
- **Purpose**: Adventurer NFT contract
- **Upgradeable**: Yes ✅
- **Proxy Address (Mainnet)**: `0xb138Bf579058169e0657c12Fd9cc1267CAFcb935`
- **Implementation Address (Mainnet)**: `0x961F7b389ebe40C61aE1b64425F23CFEA79a4458` (v4.1.0 - Payment Fix + Whitelist)
- **Proxy Address (Testnet)**: `0x67e27a22B64385e0110e69Dceae7d394D2C87B06`
- **Implementation Address (Testnet)**: `0xAEc92D70Db9B5516546c27E8fa0Cb309C4660Fe1` (v4.0.0 - Signature-Based Pricing)
- **Network**: Monad Mainnet & Testnet
- **Deployment Date**: 2025-01-XX
- **Deployment TX**: See deployment output
- **Notes**: Successfully deployed as UUPS proxy. Upgraded to signature-based pricing (v4.0.0). Latest upgrade (v4.1.0) fixes payment transfer to treasury, adds treasury support, and adds whitelist functionality.

#### TavernKeeper (ERC-721)
- **Status**: ✅ **DEPLOYED** - UUPS upgradeable proxy
- **Current Type**: UUPS Upgradeable Proxy ✅
- **Purpose**: TavernKeeper NFT contract
- **Upgradeable**: Yes ✅
- **Proxy Address (Mainnet)**: `0x56B81A60Ae343342685911bd97D1331fF4fa2d29`
- **Implementation Address (Mainnet)**: `0x81146F855f5B0C567e9F0d3a2A082Aed81F34762` (v4.2.0 - Office timer fix: startTime no longer resets on claim)
- **Proxy Address (Testnet)**: `0x311d8722A5cE11DF157D7a9d414bbeC2640c5Fb2`
- **Implementation Address (Testnet)**: `0x10ee72aB13747447FE62CE07e2f1fc3d40114Ee7` (v4.0.0 - Signature-Based Pricing)
- **Network**: Monad Mainnet & Testnet
- **Deployment Date**: 2025-01-XX
- **Deployment TX**: See deployment output
- **Notes**: Successfully deployed as UUPS proxy. Mints KeepToken to office holders. Upgraded to signature-based pricing (v4.0.0). Latest upgrade (v4.1.0) fixes payment transfer to treasury and adds whitelist functionality.

#### The Cellar (CellarHook)
- **Status**: ✅ **DEPLOYED** - UUPS upgradeable proxy
- **Current Type**: UUPS Upgradeable Proxy ✅
- **Purpose**: Uniswap v4 hook for cellar mechanics, LP token minting, and raid functionality
- **Upgradeable**: Yes ✅
- **Proxy Address**: `0x297434683Feb6F7ca16Ab4947eDf547e2c67dB44`
- **Implementation Address**: `0xCE16E1617e344A4786971e3fFD0009f15020C503`
- **Network**: Monad Testnet
- **Deployment Date**: 2025-12-01
- **Deployment TX**: `0xc545f324ed3e4e41b76ebc4c0947b37d8c0166b303fe8db17d831bb9ab3ed823` (Treasury update)
- **Notes**:
  - ✅ Fixed critical `potBalance` bug - now updates when fees are received
  - ✅ Converted from non-upgradeable to UUPS proxy pattern
  - ✅ Removed `BaseHook` inheritance (incompatible with UUPS), now implements `IHooks` directly
  - ✅ TavernKeeper treasury updated to new proxy address
  - ⚠️ Old non-upgradeable contract still exists at `0x41ceC2cE651D37830af8FD94a35d23d428F80aC0` with ~0.15 MON

#### CellarZapV4
- **Status**: ✅ **DEPLOYED** - UUPS upgradeable proxy
- **Current Type**: UUPS Upgradeable Proxy ✅
- **Purpose**: Facilitates LP minting for CellarHook
- **Upgradeable**: Yes ✅
- **Proxy Address**: `0xEb2e080453f70637E29C0D78158Ef88B3b20548c`
- **Implementation Address**: `0x3c25cCAfDb2448bB5Dc33818b37c3ECD8c10AfC3`
- **Network**: Monad Testnet
- **Deployment Date**: 2025-12-01
- **Deployment TX**: See deployment output
- **Notes**:
  - ✅ Converted from non-upgradeable to UUPS proxy pattern
  - ✅ Initialized with new CellarHook proxy address
  - ✅ Frontend addresses updated automatically
=======
- **Proxy Address**: `0x0A773ACfb23f2d6CC919235c134625bAF515c6F8`
- **Implementation Address**: `0x9A0502c275c807F1B695Ce0266DEabE42b695448`
- **Network**: Monad Testnet
- **Deployment Date**: 2025-01-XX
- **Deployment TX**: See deployment output
- **Notes**: Successfully deployed as UUPS proxy. Mints KeepToken to office holders.
>>>>>>> d9c80166f06c3f6075f2ba2e63c2d068690df2ca

---

## Deployment Checklist

### Before Deployment

- [x] Convert all game contracts to UUPS upgradeable pattern ✅
- [ ] Test proxy deployment locally
- [ ] Verify proxy initialization
- [ ] Test upgrade functionality
- [ ] Set fee recipient address for Inventory contract
- [x] Prepare deployment script with proxy pattern ✅

### Deployment Steps

1. **Deploy ERC-6551 Infrastructure:**
   - [ ] Deploy ERC6551Registry
   - [ ] Deploy ERC6551Account (implementation)
   - [ ] Verify deployments
   - [ ] Update this file with addresses

2. **Deploy Game Contracts (as Proxies):**
   - [ ] Deploy KeepToken implementation
   - [ ] Deploy KeepToken proxy
   - [ ] Initialize KeepToken proxy (with treasury and TavernKeeper address)
   - [ ] Update this file

   - [ ] Deploy Inventory implementation
   - [ ] Deploy Inventory proxy
   - [ ] Initialize Inventory proxy (with fee recipient)
   - [ ] Update this file

   - [ ] Deploy Adventurer implementation
   - [ ] Deploy Adventurer proxy
   - [ ] Initialize Adventurer proxy
   - [ ] Update this file

   - [ ] Deploy TavernKeeper implementation
   - [ ] Deploy TavernKeeper proxy
   - [ ] Initialize TavernKeeper proxy
   - [ ] Update this file

3. **Post-Deployment:**
   - [ ] Verify all contracts on block explorer
   - [ ] Update `.env` files with addresses
   - [ ] Update `lib/contracts/registry.ts` with addresses
   - [ ] Run contract validation tests
   - [ ] Document proxy admin addresses

---

## Deployment History

### Monad Testnet

| Contract | Type | Address | Deployed | TX Hash | Notes |
|----------|------|---------|----------|---------|-------|
<<<<<<< HEAD
| ERC6551Registry | Direct | `0xF53245E95FAc1286b42Fd2231018fd8e62c4B126` | ✅ 2025-01-XX | See output | |
| ERC6551Account | Direct | `0x13400f8A9E3Cc2b973538acB6527E3425D2AaF6c` | ✅ 2025-01-XX | See output | |
| KeepToken | Proxy | `0x1d00b6Dbb2f141cf6A8c1bCf70324ec1907E82B1` | ✅ 2025-12-01 | See output | **USE THIS** |
| KeepToken | Impl | `0x5EA8Edb99E9a070c8f4358e0904b7cE63e7d5866` | ✅ 2025-01-XX | See output | |
| Inventory | Proxy | `0x777b17Bda9B9438e67bd155fEfC04Dc184F004C7` | ✅ 2025-01-XX | See output | **USE THIS** |
| Inventory | Impl | `0xc03bC9D0BD59b98535aEBD2102221AeD87c820A6` | ✅ 2025-01-XX | See output | |
| Adventurer | Proxy | `0x67e27a22B64385e0110e69Dceae7d394D2C87B06` | ✅ 2025-01-XX | See output | **USE THIS** |
| Adventurer | Impl | `0xAEc92D70Db9B5516546c27E8fa0Cb309C4660Fe1` | ✅ 2025-01-XX | See output | v4.0.0 - Signature-Based Pricing |
| TavernKeeper | Proxy | `0x311d8722A5cE11DF157D7a9d414bbeC2640c5Fb2` | ✅ 2025-12-01 | See output | **USE THIS** |
| TavernKeeper | Impl | `0x10ee72aB13747447FE62CE07e2f1fc3d40114Ee7` | ✅ 2025-01-XX | See output | v4.0.0 - Signature-Based Pricing |
| The Cellar | Proxy | `0x297434683Feb6F7ca16Ab4947eDf547e2c67dB44` | ✅ 2025-12-01 | See output | **USE THIS** - UUPS Proxy (v2.0.0 - potBalance fix) |
| The Cellar | Impl | `0xCE16E1617e344A4786971e3fFD0009f15020C503` | ✅ 2025-12-01 | See output | v2.0.0 - UUPS upgradeable, potBalance fix |
| DungeonGatekeeper | Proxy | `0x1548b5DbCa42C016873fE60Ed0797985127Ea93c` | ✅ 2025-12-01 | See output | **USE THIS** |
| CellarZapV4 | Proxy | `0xEb2e080453f70637E29C0D78158Ef88B3b20548c` | ✅ 2025-12-01 | See output | **USE THIS** - UUPS Proxy (v2.0.0) |
| CellarZapV4 | Impl | `0x3c25cCAfDb2448bB5Dc33818b37c3ECD8c10AfC3` | ✅ 2025-12-01 | See output | v2.0.0 - UUPS upgradeable |
| PoolManager | Contract | `0xa0b790f6A9397c3Fa981CA4443b16C59A920a9da` | ✅ 2025-12-01 | See output | **USE THIS** |
=======
| ERC6551Registry | Direct | `0xE8D519d1C3972Fb8833262333D3152739f9e960b` | ✅ 2025-01-XX | See output | |
| ERC6551Account | Direct | `0x0C829384eDb3E2A79Af1405aE6A43A0292e30548` | ✅ 2025-01-XX | See output | |
| KeepToken | Proxy | `0x53f7C41787bc45700F2450CAC956F5649f3d986A` | ✅ 2025-01-XX | See output | **USE THIS** |
| KeepToken | Impl | `0x5EA8Edb99E9a070c8f4358e0904b7cE63e7d5866` | ✅ 2025-01-XX | See output | |
| Inventory | Proxy | `0xE75948afaAc46E3C456C1023d4c7F00392a92344` | ✅ 2025-01-XX | See output | **USE THIS** |
| Inventory | Impl | `0xc03bC9D0BD59b98535aEBD2102221AeD87c820A6` | ✅ 2025-01-XX | See output | |
| Adventurer | Proxy | `0x3F7BBD9373AF9eDdB6b170FFc86479bEaE548407` | ✅ 2025-01-XX | See output | **USE THIS** |
| Adventurer | Impl | `0x582bDC81df3c6c78B85D9409987Ab9885A24A2f6` | ✅ 2025-01-XX | See output | |
| TavernKeeper | Proxy | `0x0A773ACfb23f2d6CC919235c134625bAF515c6F8` | ✅ 2025-01-XX | See output | **USE THIS** |
| TavernKeeper | Impl | `0xb35B41522abb7ff2318772dce24BbE37a5734Ad9` | ✅ 2025-01-XX | See output | Upgraded to V2.2 (Fee Split + Cellar) |
| The Cellar | Contract | `0x93A9Ee179171b4C6EDB6ecCCFC34a2d0BF66EAAB` | ✅ 2025-01-XX | See output | Treasury / Second Dutch Auction |
| Mock LP | Contract | `0xC15694058429884Fd97a668cd84a515d407Af8fF` | ✅ 2025-01-XX | See output | Mock KEEP-MON LP |
>>>>>>> d9c80166f06c3f6075f2ba2e63c2d068690df2ca

### Monad Mainnet

| Contract | Type | Address | Deployed | TX Hash | Notes |
|----------|------|---------|----------|---------|-------|
| TheCellarV3 | Proxy | `0x32A920be00dfCE1105De0415ba1d4f06942E9ed0` | ✅ 2025-12-07 | ... | V3 Migration - UUPS Proxy |
| TheCellarV3 | Impl | `TBD` | ⏳ Pending | See upgrade tx | v1.6.0 - Pot-Based Pricing (stable value model) |
| TheCellarV3 | Impl | `0x85d081275254f39d31ebC7b5b5DCBD7276C4E9dF` | ✅ 2025-01-XX | See upgrade tx | v1.5.0 - Price Calculation Fix (use currentPrice not initPrice) |
| TheCellarV3 | Impl | `0x3Ae6fe0eD190Bd31bBE3fe7f91b310f9C8f45D5C` | ✅ 2025-01-XX | See upgrade tx | v1.4.0 - Withdrawal Fix (position liquidity checks) |
| TheCellarV3 | Impl | `0x296d8B63c95013a6c972b3f08b0D52c859D37066` | ✅ 2025-12-07 | ... | v1.3.0 - Logic Fix (harvest/withdraw) |
| CellarToken | Contract | `0x6eF142a2203102F6c58b0C15006BF9F6F5CFe39E` | ✅ 2025-12-06 | 0x... | Migrated V3 LP Token |
| The Cellar (OLD - Broken Pool) | Proxy | `0x6c7612F44B71E5E6E2bA0FEa799A23786A537755` | ✅ 2025-01-XX | See upgrade tx | **DEPRECATED** - Broken pool (price=0), replaced by new pool |
| The Cellar (OLD - Broken Pool) | Impl | `0xA349006F388DA608052395755d08E765b1960ecC` | ✅ 2025-01-XX | See upgrade tx | v3.0.0 - Broken pool, do not use |
| KeepToken | Proxy | `0x2D1094F5CED6ba279962f9676d32BE092AFbf82E` | ✅ 2025-01-XX | See FIRSTDEPLOYMENT.md | **USE THIS** - Mainnet KeepToken |
| TavernKeeper | Proxy | `0x56B81A60Ae343342685911bd97D1331fF4fa2d29` | ✅ 2025-01-XX | See upgrade tx | **USE THIS** - Mainnet TavernKeeper |
| TavernKeeper | Impl | `0x81146F855f5B0C567e9F0d3a2A082Aed81F34762` | ✅ 2025-12-08 | See upgrade tx | v4.2.0 - Office timer fix: startTime no longer resets on claim |
| Adventurer | Proxy | `0xb138Bf579058169e0657c12Fd9cc1267CAFcb935` | ✅ 2025-01-XX | See upgrade tx | **USE THIS** - Mainnet Adventurer |
| Adventurer | Impl | `0x961F7b389ebe40C61aE1b64425F23CFEA79a4458` | ✅ 2025-01-XX | See upgrade tx | v4.1.0 - Payment Fix + Whitelist |

---

## Proxy Admin Addresses

**CRITICAL: Keep these secure!**

| Contract | Proxy Admin | Multisig? | Notes |
|----------|-------------|-----------|-------|
| KeepToken | `TBD` | `TBD` | |
| Inventory | `TBD` | `TBD` | |
| Adventurer | `TBD` | `TBD` | |
| TavernKeeper | `TBD` | `TBD` | |

---

## Upgrade History

### TheCellarV3 (V3 Migration)
- **v1.0.0** - `0x32A920be00dfCE1105De0415ba1d4f06942E9ed0` - Initial V3 Migration Deployment
  - Migrated from V4 Hook to Standalone V3-wrapper
  - Uses Uniswap V3 NonfungiblePositionManager
  - `CellarToken` (ERC20) minted for positions
  - `raid()` uses `CellarToken` bid to claim fees from dual pots (MON/KEEP)
  - **Network**: Monad Mainnet (Chain 143)
  - **Date**: 2025-12-06

- **v1.1.0** - `0x32A920be00dfCE1105De0415ba1d4f06942E9ed0` (Proxy Unchanged) - Config Fix
  - **Reason**: Initial deployment used Testnet WMON/KEEP addresses.
  - **Action**: Upgraded implementation to add `setConfig` and updated storage to use correct Mainnet WMON (`0x3bd3...`) and KEEP (`0x2D10...`).
  - **Pool**: Initialized correct V3 Pool (WMON/KEEP 1%).

- **v1.2.0** - `0x32A920be00dfCE1105De0415ba1d4f06942E9ed0` (Proxy Unchanged) - Logic Fix
  - **Reason**: Fix `addLiquidity` revert on Mainnet where `KEEP < WMON`.
  - **Action**: updated `TheCellarV3` to dynamically sort tokens for V3 interactions (`token0` vs `token1`) and map amounts correctly. Matches V3 Pool (KEEP=Token0).

- **v1.3.0** - `0x296d8B63c95013a6c972b3f08b0D52c859D37066` (Impl) - Fee Logic Fix
  - **Reason**: `raid()` calling `harvest()` was draining swap fees from LPs.
  - **Action**: Removed `harvest()` from `raid()`. Restricted `harvest()` to `onlyOwner`. Verified `withdraw()` correctly calculates user fee share without relying on `harvest()` clearing the slate.

- **v1.4.0** - `0xAf3353c5f417d5906D170B304869040eb28E7B45` (Impl) - Pot Logic Fix (Receive/Sweeten)
  - **Reason**: `potBalance` remained 0 because contract lacked `receive()` handler for Native MON. Funds were reverting.
  - **Action**: Added `receive()` to accept and wrap Native MON to WMON. Added `sweetenPot()` for manual contributions.
  - **Result**: "Take Office" now triggers fee deposits correctly.

- **v1.5.0** - `0x85d081275254f39d31ebC7b5b5DCBD7276C4E9dF` (Impl) - Price Calculation Fix
  - **Reason**: `raid()` was using `initPrice` (old init price) instead of `currentPrice` (price paid) to calculate next epoch price, causing unbounded price growth.
  - **Action**: Changed `raid()` to use `currentPrice * priceMultiplier` instead of `initPrice * priceMultiplier`. Matches Office Manager behavior.
  - **Result**: Price is now bounded by actual payments, preventing huge numbers. New init price = current price paid × multiplier.
  - **Network**: Monad Mainnet (Chain 143)
  - **Date**: 2025-01-XX

- **v1.6.0** - `TBD` (Impl) - Pot-Based Pricing (Stable Value Model)
  - **Reason**: Exponential growth from multiplier-based pricing (2x per epoch) would cause prices to reach trillions. Need stable, value-aligned pricing.
  - **Action**: Changed `raid()` to use `potBalanceMON * potPriceCoefficient / 100` instead of `currentPrice * multiplier`. Added `potPriceCoefficient` state variable (10-50%).
  - **Result**: Price is now tied to pot value. Price grows smoothly with pot, cannot exceed pot, prevents exponential growth. Self-correcting model.
  - **Network**: Monad Mainnet (Chain 143)
  - **Date**: 2025-01-XX
  - **Formula**: `newInitPrice = potBalanceMON * coefficient / 100` (e.g., 30% of pot value)



---

## Last Updated

- **Date**: 2025-12-06
- **Updated By**: V3 Migration Deployment
- **Reason**: Migrated core mechanics to use Uniswap V3 instead of custom V4 Hook. Deployed `CellarToken` and `TheCellarV3` wrapper.

