
### 1. Added `initializePool()` Function
- New owner-only function in `CellarHook.sol` for explicit, one-time pool initialization
- Checks if pool is already initialized before attempting initialization
- Provides clear error messages if pool is broken (cannot be fixed) or already initialized
- Sets initial price to tick 10986 (price = 3.0 KEEP per MON)

### 2. Modified `addLiquidity()` Function
- Removed pool initialization logic from `addLiquidity()`
- Now requires pool to be pre-initialized before adding liquidity
- Reverts with clear message if pool is not initialized
- Preserves existing "smart tick" range calculation logic for liquidity positioning

### 3. Updated Deployment Script
- `deploy_localhost.ts` now calls `initializePool()` before `addLiquidity()`
- Ensures proper two-step process: initialize first, then add liquidity

## Files Modified

1. `packages/contracts/contracts/hooks/CellarHook.sol`
   - Added `initializePool()` function (lines 283-305)
   - Modified `addLiquidity()` to require pre-initialized pool (lines 359-374)
   - Fixed `targetTick` scope issue

2. `packages/contracts/scripts/deploy_localhost.ts`
   - Added explicit `initializePool()` call before liquidity addition
   - Added error handling for initialization states

3. `packages/contracts/scripts/upgrade_cellarhook_localhost.ts` (new)
   - Script to upgrade existing localhost proxy with new implementation

4. `packages/contracts/local_test/test_pool_initialization_fix.ts` (new)
   - Test script to verify fix on existing broken pools
   - Includes path resolution for reading contract addresses

## Testing Status

- **Contract compilation**: ✅ Successful
- **Localhost testing**: ⚠️ Blocked by test script path resolution issues
- **Mainnet testing**: ⏸️ Pending localhost verification

## Known Issues

1. **Test Script Path Resolution**: The `test_pool_initialization_fix.ts` script has persistent issues reading `addresses.ts` from the correct path when executed via Hardhat. Multiple attempts to fix path resolution have been made, but the script continues to show old error messages, suggesting cached execution or path resolution problems.

2. **Accidental Mainnet Deployment**: An accidental deployment occurred when `deploy_localhost.ts` was run on mainnet, creating orphaned contracts. These need to be disabled but are lower priority than fixing the pool initialization issue.

## Next Steps

1. Verify the fix works on localhost by:
   - Upgrading existing localhost contract using `upgrade_cellarhook_localhost.ts`
   - Testing `initializePool()` on existing broken pool
   - Testing `addLiquidity()` after successful initialization

2. Once localhost is verified, apply fix to mainnet:
   - **Must use upgrade path**: Cannot redeploy because users have already minted KEEP tokens
   - Upgrade mainnet `CellarHook` proxy to new implementation
   - Test initialization on mainnet broken pool
   - **If broken pool cannot be fixed**: Must create new pool with different parameters (fee/tickSpacing) while preserving existing contracts and user tokens
   - Document results and any migration steps needed

3. Address orphaned mainnet contracts (lower priority)

## Key Learnings

- Uniswap V4 pools cannot be re-initialized once they exist, even if broken
- Pool initialization must be explicit and separate from liquidity addition
- Broken pools require different pool parameters (fee/tickSpacing) to be recreated
- Testing on existing infrastructure is critical - cannot always reset and start fresh
- **Mainnet constraints are different**: Cannot redeploy contracts when users have already minted tokens. Must use upgradeable proxy pattern to fix issues while preserving user state.
