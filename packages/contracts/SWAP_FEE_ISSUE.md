# Swap Fee Collection Issue - Root Cause Analysis

## Problem
The pot balance is 0 despite swaps happening. A 2,356 MON swap should have generated ~23.56 MON in fees (1%), but the pot shows 0.

## Root Cause

### Uniswap V4 Fee Structure
In Uniswap V4, there are TWO types of fees:

1. **LP Fees** (1% = 10000 bps)
   - These automatically accrue to liquidity providers
   - They increase the value of LP tokens
   - They do NOT go to a separate "pot"
   - They accumulate in the PoolManager but belong to LPs

2. **Protocol Fees** (optional, separate)
   - These are collected separately via `collectProtocolFees()`
   - Must be explicitly set using `setProtocolFee()`
   - Default is 0 (no protocol fees)

### Current Implementation Issue
The `afterSwap()` hook currently does NOTHING:
```solidity
function afterSwap(...) external onlyPoolManager returns (bytes4, int128) {
    // Fee collection can be implemented here if needed
    // For now, return no delta
    return (this.afterSwap.selector, 0);
}
```

### Why Pot is Empty
1. Swaps happen → 1% LP fee is taken
2. LP fees go to PoolManager (belong to LPs, not pot)
3. No protocol fees are set (default = 0)
4. `afterSwap()` does nothing
5. Pot stays at 0

## Solutions

### Option 1: Set Protocol Fee (Recommended)
Set a protocol fee (e.g., 10% of LP fee = 0.1% of swap) and collect it:

```solidity
// Set protocol fee to 10% of LP fee (1000 bps of protocol fee on 10000 bps LP fee)
poolManager.setProtocolFee(poolKey, 1000); // 10% of 1% = 0.1% of swap

// Collect in afterSwap
function afterSwap(...) external onlyPoolManager returns (bytes4, int128) {
    _collectProtocolFeesToPot(key);
    return (this.afterSwap.selector, 0);
}
```

### Option 2: Extract Fees from Swap Amount
Calculate fee from swap params and extract it (more complex, requires understanding swap mechanics).

### Option 3: Take Fee from BalanceDelta
Extract fee from the BalanceDelta (complex, may not be possible).

## Current PoolManager Balance
PoolManager has 7.6 MON - this is LP fees that belong to LPs, NOT the pot. These cannot be taken without stealing from LPs.

## Next Steps
1. ✅ Implemented `_collectProtocolFeesToPot()` in afterSwap
2. ⚠️ Need to SET protocol fee first: `poolManager.setProtocolFee(poolKey, protocolFeeBps)`
3. ⚠️ Need to ensure hook has permission to collect protocol fees
4. ⚠️ May need to set protocol fee controller

## Important Note
The 1% swap fee (LP fee) belongs to liquidity providers. We cannot take it for the pot without:
- Setting a separate protocol fee
- Or implementing a different fee mechanism

The PoolManager balance of 7.6 MON is LP fees that belong to LPs, not available for the pot.

