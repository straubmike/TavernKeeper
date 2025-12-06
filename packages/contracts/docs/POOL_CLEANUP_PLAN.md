# Pool Cleanup and Recovery Plan

## Status: READY TO EXECUTE

**Date**: 2025-01-XX
**Priority**: HIGH - Clean up old pool and ensure only new pool is used

## Overview

This document outlines the complete cleanup process to:
1. Recover funds from the old broken pool
2. Disable the old broken pool permanently
3. Disable orphaned contracts
4. Verify everything is correctly configured

## Current State

### Old Broken Pool (`0x6c7612F44B71E5E6E2bA0FEa799A23786A537755`)
- **Status**: Broken (price=0, tick=0)
- **Funds**: 1.503 MON (recoverable)
- **Owner**: Deployer (can recover)
- **Action**: Recover funds and disable

### New Working Pool (`0xe71CAf7162dd81a4A9C0c6BD25ED02C26F492DC0`)
- **Status**: ✅ Active and working
- **Funds**: 0.0 MON (fresh start)
- **Owner**: Deployer
- **Action**: Keep active (this is the only pool users should use)

### Frontend Configuration
- **Status**: ✅ Correctly configured
- **THE_CELLAR**: Points to new pool (`0xe71CAf7162dd81a4A9C0c6BD25ED02C26F492DC0`)
- **No references to old pool**: ✅ Verified

## Recovery Plan

### Step 1: Recover Old Pool Funds

**Script**: `scripts/recover_and_cleanup_old_pool.ts`

**What it does**:
1. Upgrades old pool to `CellarHookRecovery` version
2. Calls `emergencyDrainMon()` to recover 1.503 MON
3. Calls `emergencyDrainKeep()` to recover any KEEP tokens
4. Transfers ownership to dead address (disables pool)

**Expected recovery**: ~1.503 MON

### Step 2: Disable Old Pool

**What it does**:
- Transfers ownership to `0x000000000000000000000000000000000000dEaD`
- This permanently disables the pool (cannot be upgraded or modified)
- Pool becomes unusable

### Step 3: Disable Orphaned Contracts

**Script**: `scripts/disable_orphaned_mainnet_contracts.ts` (already exists)

**Orphaned contracts to disable**:
- KeepToken: `0x426f7c10e7D5329BB7E956e59fa19697c465daBA`
- CellarHook: `0xDA499a900FE25D738045CD6C299663471dE76Ae0`
- Inventory: `0x88f251AFD462AF1f604ACCebc22B084255f763b5`
- Adventurer: `0x54911A51216824788ACea03fEE5F947b1281Cffe`
- TavernKeeper: `0x0FFD4b467326C6fBC5EB7ab901eC020f54970e9d`
- CellarZapV4: `0x335bAFEd9a8498B7779431154196d0712693827d`
- DungeonGatekeeper: `0xAE1e8194663450073bB6024199eBa65886774A26`
- TavernRegularsManager: `0xd9E80273467f0f1786F5A4565c154eF814D77e70`
- TownPosseManager: `0xe4eaAf93D5c3f693a69D6BEb5F8a53ECfb2857a8`

**Action**: Transfer ownership to dead address

## Execution Steps

### Option 1: Complete Cleanup (Recommended)

Run the comprehensive cleanup script:

```powershell
cd packages/contracts
npx hardhat run scripts/complete_pool_cleanup.ts --network monad
```

This script does everything:
- ✅ Recovers old pool funds
- ✅ Disables old pool
- ✅ Disables orphaned contracts
- ✅ Verifies frontend
- ✅ Verifies new pool

### Option 2: Step-by-Step

If you prefer to run steps separately:

1. **Recover and disable old pool**:
```powershell
npx hardhat run scripts/recover_and_cleanup_old_pool.ts --network monad
```

2. **Disable orphaned contracts**:
```powershell
npx hardhat run scripts/disable_orphaned_mainnet_contracts.ts --network monad
```

3. **Verify final state**:
```powershell
npx hardhat run scripts/verify_final_state.ts --network monad
```

## Verification

After cleanup, verify everything:

```powershell
npx hardhat run scripts/verify_final_state.ts --network monad
```

**Expected results**:
- ✅ Old pool is disabled (ownership = dead address)
- ✅ Old pool has 0 funds
- ✅ New pool is active
- ✅ Frontend uses new pool
- ✅ Dependent contracts use new pool

## Important Notes

1. **PoolManager funds are NOT recoverable**
   - The 1.639 MON and 0.599 KEEP in PoolManager are from the NEW working pool
   - These are NOT stuck - they're the actual liquidity
   - Do NOT attempt to recover these

2. **Old pool LP tokens are NOT recoverable**
   - 3.9 LP tokens were minted for the broken pool
   - These cannot be recovered (pool is initialized)

3. **Frontend is already correct**
   - Frontend points to new pool
   - No changes needed

4. **Dependent contracts are already updated**
   - TownPosseManager, TavernRegularsManager, and TavernKeeper all use new pool
   - No changes needed

## Recovery Summary

| Source | Amount | Recoverable | Status |
|--------|--------|-------------|--------|
| Old Pool (CellarHook) | 1.503 MON | ✅ YES | Ready to recover |
| Old Pool (KEEP) | 0 KEEP | ✅ YES | Check during recovery |
| PoolManager (NEW pool) | 1.639 MON, 0.599 KEEP | ❌ NO | This is working liquidity |
| Old Pool LP tokens | 3.9 LP | ❌ NO | Cannot recover |

**Total Recoverable**: ~1.503 MON

## After Cleanup

Once cleanup is complete:

1. ✅ Old pool is permanently disabled
2. ✅ All recoverable funds are recovered
3. ✅ Only new pool is active
4. ✅ Frontend uses new pool
5. ✅ All dependent contracts use new pool
6. ✅ Orphaned contracts are disabled

**Result**: Clean system with only the new working pool active.

