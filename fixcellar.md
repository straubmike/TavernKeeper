# The Cellar V3 Fixes (Applied)
1. **`raid()` Fixed**: Removed the `harvest()` call. Raiding the pot now ONLY payouts out `potBalanceMON` and `potBalanceKEEP` (which accumulate from Office and Group taxes). It no longer touches Uniswap swap fees.
2. **`harvest()` Restricted**: Made `onlyOwner`. This prevents accidental draining of swap fees to the deployer. It is now a manual admin function only.
3. **`withdraw()` Verified**: The logic correctly calculates the user's proportional share of uncollected fees based on their liquidity share. Since `harvest()` no longer clears these fees automatically, `withdraw()` will now correctly payout swap fees to LPs.
