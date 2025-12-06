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
<<<<<<< HEAD
- **Proxy Address**: `0x67e27a22B64385e0110e69Dceae7d394D2C87B06`
- **Implementation Address**: `0xAEc92D70Db9B5516546c27E8fa0Cb309C4660Fe1` (v4.0.0 - Signature-Based Pricing)
=======
- **Proxy Address**: `0x3F7BBD9373AF9eDdB6b170FFc86479bEaE548407`
- **Implementation Address**: `0x582bDC81df3c6c78B85D9409987Ab9885A24A2f6`
>>>>>>> d9c80166f06c3f6075f2ba2e63c2d068690df2ca
- **Network**: Monad Testnet
- **Deployment Date**: 2025-01-XX
- **Deployment TX**: See deployment output
- **Notes**: Successfully deployed as UUPS proxy. Upgraded to signature-based pricing (v4.0.0)

#### TavernKeeper (ERC-721)
- **Status**: ✅ **DEPLOYED** - UUPS upgradeable proxy
- **Current Type**: UUPS Upgradeable Proxy ✅
- **Purpose**: TavernKeeper NFT contract
- **Upgradeable**: Yes ✅
<<<<<<< HEAD
- **Proxy Address**: `0x311d8722A5cE11DF157D7a9d414bbeC2640c5Fb2`
- **Implementation Address**: `0x10ee72aB13747447FE62CE07e2f1fc3d40114Ee7` (v4.0.0 - Signature-Based Pricing)
- **Network**: Monad Testnet
- **Deployment Date**: 2025-01-XX
- **Deployment TX**: See deployment output
- **Notes**: Successfully deployed as UUPS proxy. Mints KeepToken to office holders. Upgraded to signature-based pricing (v4.0.0)

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
| The Cellar (OLD - Broken Pool) | Proxy | `0x6c7612F44B71E5E6E2bA0FEa799A23786A537755` | ✅ 2025-01-XX | See upgrade tx | **DEPRECATED** - Broken pool (price=0), replaced by new pool |
| The Cellar (OLD - Broken Pool) | Impl | `0xA349006F388DA608052395755d08E765b1960ecC` | ✅ 2025-01-XX | See upgrade tx | v3.0.0 - Broken pool, do not use |
| The Cellar (NEW - Working Pool v1) | Proxy | `0xaDF53E062195C20DAD2E52b76550f0a266e40ac0` | ✅ 2025-01-XX | See deploy_new_pool_mainnet.ts | **DEPRECATED** - Replaced by v2 |
| The Cellar (NEW - Working Pool v1) | Impl | `0x8a2fD83393c7D0dba8EDd5C9Fde525c93Fe8e1A4` | ✅ 2025-01-XX | See deploy_new_pool_mainnet.ts | v4.0.0 - New pool deployment |
| The Cellar (NEW - Working Pool v2) | Proxy | `0xe71CAf7162dd81a4A9C0c6BD25ED02C26F492DC0` | ✅ 2025-01-XX | See deploy_new_pool_mainnet.ts | **USE THIS** - New pool (fee=10000, tickSpacing=200), ERC1967Proxy |
| The Cellar (NEW - Working Pool v2) | Impl | `0x3d27b2B29514Feb8B2780949579837C945003030` | ✅ 2025-01-XX | See deploy_new_pool_mainnet.ts | v4.1.0 - Latest pool deployment |
| KeepToken | Proxy | `0x2D1094F5CED6ba279962f9676d32BE092AFbf82E` | ✅ 2025-01-XX | See FIRSTDEPLOYMENT.md | **USE THIS** - Mainnet KeepToken |
| KeepToken (ACCIDENTAL) | Proxy | `0x426f7c10e7D5329BB7E956e59fa19697c465daBA` | ⚠️ 2025-01-XX | Accidental deploy | **DO NOT USE** - Orphaned, see ACCIDENTAL_MAINNET_DEPLOYMENT.md |
| CellarHook (ACCIDENTAL) | Proxy | `0xDA499a900FE25D738045CD6C299663471dE76Ae0` | ⚠️ 2025-01-XX | Accidental deploy | **DO NOT USE** - Orphaned, incompatible with mainnet KeepToken |

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

### KeepToken
- **v1.0.0** - `TBD` - Initial deployment

### Inventory
- **v1.0.0** - `TBD` - Initial deployment (with fee collection)

### Adventurer
- **v1.0.0** - `TBD` - Initial deployment
- **v4.0.0** - `0xAEc92D70Db9B5516546c27E8fa0Cb309C4660Fe1` - Signature-based pricing (USD-based, no hardcoded MON prices)
  - Added `signer` address for price verification
  - Added `nonces` mapping for replay protection
  - Modified `mintHero()` to accept signature parameters
  - Pricing: Tier 1 = $1, Tier 2 = $5, Tier 3 = $10 (calculated from real-time MON/USD rate)
  - **Signer Address**: `0xEC4bc7451B9058D42Ea159464C6dA14a322946fD`

### TavernKeeper
- **v1.0.0** - `TBD` - Initial deployment
- **v2.0.0** - `0x5B7d11a5b4EF317c0A3332F9E1452Ad9d790B833` - Ported Donut Miner mechanics (Dutch Auction, Halving)
<<<<<<< HEAD
- **v4.0.0** - `0x10ee72aB13747447FE62CE07e2f1fc3d40114Ee7` - Signature-based pricing (USD-based, no hardcoded MON prices)
  - Added `signer` address for price verification
  - Added `nonces` mapping for replay protection
  - Modified `mintTavernKeeper()` to accept signature parameters
  - Pricing: Tier 1 = $1, Tier 2 = $5, Tier 3 = $10 (calculated from real-time MON/USD rate)
  - **Signer Address**: `0xEC4bc7451B9058D42Ea159464C6dA14a322946fD`

### The Cellar (CellarHook)
- **v1.0.0** - `0x41ceC2cE651D37830af8FD94a35d23d428F80aC0` - Initial deployment (non-upgradeable, Create2Factory)
  - Deployed via Create2Factory for deterministic address (hook flags requirement)
  - **BUG**: Empty `receive()` function - `potBalance` never updated when fees received
- **v2.0.0** - `0xCE16E1617e344A4786971e3fFD0009f15020C503` - UUPS upgradeable proxy (2025-12-01)
  - ✅ Fixed critical `potBalance` bug - `receive()` now updates `potBalance` when MON received
  - ✅ Converted from non-upgradeable to UUPS proxy pattern
  - ✅ Removed `BaseHook` inheritance (incompatible with UUPS), now implements `IHooks` directly
  - ✅ Converted all `immutable` variables to state variables
  - ✅ Added `_authorizeUpgrade()` for upgrade authorization
  - **Proxy Address**: `0x297434683Feb6F7ca16Ab4947eDf547e2c67dB44`
  - **Deployment Date**: 2025-12-01
- **v3.0.0** - `0xA349006F388DA608052395755d08E765b1960ecC` - Mainnet upgrade (2025-01-XX)
  - ✅ Fixed sqrtPriceX96 calculation: Uses `TickMath.getSqrtPriceAtTick(10986)` for correct price = 3.0
  - ✅ Fixed settlement: Added `poolManager.sync()` calls before settling currencies to prevent `CurrencyNotSettled()` errors
  - ✅ Fixed pool initialization: Handles already-initialized pools gracefully (silent catch instead of reverting)
  - ✅ **Pool price fix**: Reads actual pool price using `StateLibrary.getSlot0()` instead of hardcoded value - enables normal AMM behavior where price changes as people trade
  - ✅ Improved balance handling: Allows `msg.value >= amountMON` for rounding buffer, improved error messages, enhanced refund logic
  - **Proxy Address**: `0x6c7612F44B71E5E6E2bA0FEa799A23786A537755` (unchanged)
  - **Network**: Monad Mainnet (Chain ID 143)
  - **Deployment Date**: 2025-01-XX
- **v3.1.0** - `0xc84E7d5C75a89eBB3322bEb004c9351c25fc0092` - Mainnet upgrade (2025-01-XX)
  - ✅ Broken pool detection: Detects pools with price=0 and prevents adding liquidity
  - ✅ Two-sided liquidity enforcement: Ensures current price is within liquidity range
  - ✅ Dynamic tick range: Calculates range around actual pool price
  - **Proxy Address**: `0x6c7612F44B71E5E6E2bA0FEa799A23786A537755` (unchanged)
  - **Network**: Monad Mainnet (Chain ID 143)
- **v3.2.0** - `0xc7042Aa8955F1424A95Ba0944386d1593d0448eB` - Mainnet upgrade (2025-01-XX)
  - ✅ **Two-sided liquidity verification**: Added `_getAmount0ForLiquidity` and `_getAmount1ForLiquidity` helper functions
  - ✅ **Liquidity validation**: Verifies that calculated liquidity will actually use both tokens before proceeding
  - ✅ Prevents single-sided liquidity even when pool price is slightly off
  - ✅ Removed price check that only reverted - now validates actual token usage
  - **Proxy Address**: `0x6c7612F44B71E5E6E2bA0FEa799A23786A537755` (unchanged)
  - **Network**: Monad Mainnet (Chain ID 143)
- **v4.0.0** - `0x8a2fD83393c7D0dba8EDd5C9Fde525c93Fe8e1A4` - **NEW POOL DEPLOYMENT** (2025-01-XX)
  - ✅ **New pool with different parameters**: Deployed new CellarHook to create a new Uniswap V4 pool
  - ✅ **Hook address validation**: Validates hook address has correct flags (0xAC0) before pool creation
  - ✅ **PoolKey construction fix**: Properly constructs PoolKey with validated hook address
  - ✅ **Two-sided liquidity verified**: Pool successfully initialized with both MON and KEEP
  - **New Hook Address**: `0xaDF53E062195C20DAD2E52b76550f0a266e40ac0` (different from old broken pool)
  - **Pool Parameters**: Fee=10000 (1.0%), TickSpacing=200 (different from old pool: fee=3000, tickSpacing=60)
  - **Network**: Monad Mainnet (Chain ID 143)
  - **Status**: ✅ **WORKING** - Pool initialized with two-sided liquidity (1.999 MON, 0.299 KEEP)
  - **Note**: Old pool (`0x6c7612F44B71E5E6E2bA0FEa799A23786A537755`) is broken (price=0) and cannot be fixed
- **v4.1.0** - `0x3d27b2B29514Feb8B2780949579837C945003030` - **LATEST POOL DEPLOYMENT** (2025-01-XX)
  - ✅ **New pool deployment with ERC1967Proxy**: Deployed new CellarHook using ERC1967Proxy pattern
  - ✅ **Hook address validation**: Validates hook address has correct flags (0x2DC0) before pool creation
  - ✅ **All dependent contracts upgraded**: TownPosseManager, TavernRegularsManager, and TavernKeeper updated
  - ✅ **Two-sided liquidity verified**: Pool successfully initialized with both MON and KEEP
  - **New Hook Address**: `0xe71CAf7162dd81a4A9C0c6BD25ED02C26F492DC0` (ERC1967Proxy with flags 0x2DC0)
  - **Pool Parameters**: Fee=10000 (1.0%), TickSpacing=200
  - **Network**: Monad Mainnet (Chain ID 143)
  - **Status**: ✅ **ACTIVE** - Pool initialized and all dependent contracts updated
  - **Deployment TX**: Pool init: `0x9abebd9be786ae360f29f7ef0da53d2ab4eac7960fd8ad782735ef1cb02c01f2`, Liquidity: `0x88dad9f627ec1a780017ae788906dd2c46fd8df89ee691f67b0606bc7c98cb9c`

### CellarZapV4
- **v1.0.0** - `0x05E67f9e58CE0FFF67EF916DA2dDFe7A856155d5` - Initial deployment (non-upgradeable)
  - Direct deployment, not upgradeable
- **v2.0.0** - `0x3c25cCAfDb2448bB5Dc33818b37c3ECD8c10AfC3` - UUPS upgradeable proxy (2025-12-01)
  - ✅ Converted from non-upgradeable to UUPS proxy pattern
  - ✅ Converted all `immutable` variables to state variables
  - ✅ Added `_authorizeUpgrade()` for upgrade authorization
  - ✅ Initialized with new CellarHook proxy address
  - **Proxy Address**: `0xEb2e080453f70637E29C0D78158Ef88B3b20548c`
  - **Deployment Date**: 2025-12-01
=======
>>>>>>> d9c80166f06c3f6075f2ba2e63c2d068690df2ca

---

## Required Changes Before Deployment

### 1. Convert Contracts to UUPS ✅ COMPLETE

All game contracts have been converted:
- ✅ Import `@openzeppelin/contracts-upgradeable`
- ✅ Extend upgradeable base contracts
- ✅ Use `initialize()` instead of `constructor()`
- ✅ Include `_authorizeUpgrade()` for UUPS
- ✅ All contracts use UUPS pattern

### 2. Update Deployment Script ✅ COMPLETE

The deployment script has been updated:
- ✅ Deploys implementation contracts
- ✅ Deploys UUPS proxy contracts using `upgrades.deployProxy()`
- ✅ Initializes proxies with `initialize()` function
- ✅ Gets implementation addresses for tracking
- ✅ Includes upgrade script for future upgrades

### 3. Update Contract Registry

After deployment:
- [ ] Update `apps/web/lib/contracts/registry.ts` with addresses
- [ ] Update `.env` files
- [ ] Run validation tests

---

## Environment Variables to Update After Deployment

```env
# ERC-6551
NEXT_PUBLIC_ERC6551_REGISTRY_ADDRESS=0x...
NEXT_PUBLIC_ERC6551_IMPLEMENTATION_ADDRESS=0x...

# Game Contracts (Proxy Addresses)
NEXT_PUBLIC_KEEP_TOKEN_ADDRESS=0x...               # KeepToken proxy
NEXT_PUBLIC_INVENTORY_CONTRACT_ADDRESS=0x...       # Inventory proxy
NEXT_PUBLIC_ADVENTURER_CONTRACT_ADDRESS=0x...      # Adventurer proxy
NEXT_PUBLIC_TAVERNKEEPER_CONTRACT_ADDRESS=0x...    # TavernKeeper proxy

# Implementation Addresses (for validation)
NEXT_PUBLIC_KEEP_TOKEN_IMPLEMENTATION_ADDRESS=0x...
NEXT_PUBLIC_INVENTORY_IMPLEMENTATION_ADDRESS=0x...
NEXT_PUBLIC_ADVENTURER_IMPLEMENTATION_ADDRESS=0x...
NEXT_PUBLIC_TAVERNKEEPER_IMPLEMENTATION_ADDRESS=0x...

# Fee Recipient
NEXT_PUBLIC_FEE_RECIPIENT_ADDRESS=0x...
```

---

## Important Notes

1. **NEVER redeploy contracts without updating this file**
2. **ALWAYS verify addresses on block explorer after deployment**
3. **Keep proxy admin keys secure** - use multisig for production
4. **Test upgrades on testnet before mainnet**
5. **Document all upgrades in the Upgrade History section**

---

## Test Wallets

**Deployer**: `0xEC4bc7451B9058D42Ea159464C6dA14a322946fD`
- This is the main deployer wallet
- Fee recipient is set to this address
- All fees collected go back to this wallet

**Test Wallets** (10 wallets, each funded with 1 MON):
1. `0xfAb9905E2238f1eDADB1a7F94C417555C43dA460`
2. `0x56A0C1061812CDA3a3e22EE42b974d0D4ECAD55F`
3. `0x373BC31d3b27061F86C530908307f238f09e7023`
4. `0xb60fDCA53aba16CF148FDA5c2F20E6538944d024`
5. `0x5CEa37b7b5C1A4A1321c5fa1138D46A333EF648b`
6. `0x67b10d3b2BB6cc64cb674cF4acCdfFCAfE9C4541`
7. `0x1a19C1C7447d761B9B291c7d49f0965de9CA8204`
8. `0x3509a95e78eBa980C247F5A05B787dC2ba70Ba61`
9. `0x8f461F731dfc965e2214c7D6700e9B5E24dE35c8`
10. `0xC8D9cA8Bc169875760848c5268a0fE006077A3dD`

**Wallet Management**:
- Private keys stored in `packages/contracts/wallets/testnet-keys.json` (gitignored)
- Wallet addresses in `packages/contracts/wallets/testnet-wallets.json`
- All wallets funded with 1 MON each for testing

## Last Updated

<<<<<<< HEAD
- **Date**: 2025-12-01
- **Updated By**: UUPS Conversion Deployment
- **Reason**: Completed UUPS conversion for CellarHook and CellarZapV4
  - **CellarHook**:
    - ✅ Fixed critical `potBalance` bug (now updates when fees received)
    - ✅ Converted from non-upgradeable to UUPS proxy pattern
    - ✅ Removed `BaseHook` inheritance, implements `IHooks` directly
    - ✅ Updated TavernKeeper treasury to new proxy address
    - ✅ Proxy: `0x297434683Feb6F7ca16Ab4947eDf547e2c67dB44`
    - ✅ Implementation: `0xCE16E1617e344A4786971e3fFD0009f15020C503`
  - **CellarZapV4**:
    - ✅ Converted from non-upgradeable to UUPS proxy pattern
    - ✅ Initialized with new CellarHook proxy address
    - ✅ Proxy: `0xEb2e080453f70637E29C0D78158Ef88B3b20548c`
    - ✅ Implementation: `0x3c25cCAfDb2448bB5Dc33818b37c3ECD8c10AfC3`
  - ✅ Frontend addresses updated automatically
  - ✅ All contracts now upgradeable via UUPS proxy pattern
=======
- **Date**: 2025-01-XX
- **Updated By**: Deployment Script
- **Reason**: Latest deployment to Monad Testnet - All contracts deployed as UUPS proxies with KeepToken integration
>>>>>>> d9c80166f06c3f6075f2ba2e63c2d068690df2ca

