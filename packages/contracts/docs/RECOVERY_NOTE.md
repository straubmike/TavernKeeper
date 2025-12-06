# Recovery Note: Broken Pool Tokens

## Status: PENDING

**Date**: 2025-01-XX
**Priority**: LOW (focus on new pool first)

## Summary

The old broken pool (`0x6c7612F44B71E5E6E2bA0FEa799A23786A537755`) has stuck tokens that need recovery:

### Stuck Tokens

1. **CellarHook Contract**: 1.353 MON
   - **Recoverable**: ✅ YES (owner can recover)
   - **Method**: Need to add emergency drain function or upgrade contract
   - **Status**: Pending implementation

2. **PoolManager**: 1.999 MON, 0.299 KEEP
   - **Recoverable**: ❌ LIKELY NOT (tokens in Uniswap V4 balance system)
   - **Reason**: Pool is broken (price=0, tick=0) and Uniswap V4 pools cannot be re-initialized
   - **Status**: May need to contact Uniswap team or explore advanced recovery methods

3. **LP Tokens**: 3.9 LP total (0.9 LP held by deployer)
   - **Recoverable**: ❌ NO (pool is initialized, recovery disabled)
   - **Status**: Cannot recover via `recoverStuckTokens()` function

## Recovery Options

### Option 1: Recover from CellarHook (1.353 MON)
- Add emergency drain function to CellarHook contract
- Or upgrade contract with recovery function
- **Estimated effort**: Medium
- **Estimated recoverable**: 1.353 MON

### Option 2: Recover from PoolManager (1.999 MON, 0.299 KEEP)
- **Status**: UNKNOWN - requires investigation
- May require:
  - Uniswap V4 team assistance
  - Advanced settlement mechanisms
  - Or may be permanently lost
- **Estimated effort**: High
- **Estimated recoverable**: Unknown

## Next Steps

1. ✅ **COMPLETE**: Deploy new working pool (done)
2. ⏳ **PENDING**: Implement recovery function for CellarHook balance
3. ⏳ **PENDING**: Investigate PoolManager recovery options
4. ⏳ **PENDING**: Document final recovery status

## Notes

- New pool is working correctly with two-sided liquidity
- Focus should be on ensuring new pool works properly before recovery
- Recovery can be addressed after new pool is fully operational
