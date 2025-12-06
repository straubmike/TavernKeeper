# Local Testnet Testing

This directory contains scripts to test contract fixes on a local Hardhat testnet before deploying to mainnet.

## Quick Start

### 1. Start a Local Hardhat Node

In a separate terminal, start a Hardhat node:

```powershell
cd packages/contracts
npx hardhat node
```

Keep this terminal running. The node will start on `http://127.0.0.1:8545`.

### 2. Run Tests

You have two options:

#### Option A: Use the Test Runner (Recommended)

```powershell
cd packages/contracts
.\local_test\run_local_tests.ps1
```

This interactive script will:
- Check if the Hardhat node is running
- Let you choose which test to run
- Option to run all tests in sequence

#### Option B: Run Tests Manually

```powershell
cd packages/contracts

# Fund the deployer account first
npx hardhat run local_test/fund_deployer.ts --network localhost

# Test the overflow fix
npx hardhat run local_test/verify_fix.ts --network localhost

# Test refund logic
npx hardhat run local_test/verify_refund.ts --network localhost
```

## Test Scripts

### `fund_deployer.ts`
Funds the deployer account with ETH from the default Hardhat account #0. This is needed because the deployer account (from your `.env`) may not have funds on a fresh local node.

### `verify_fix.ts`
Tests the overflow fix by:
1. Deploying PoolManager, KeepToken, and CellarHook
2. Adding liquidity with 0,0 ticks (triggers automatic range calculation)
3. Verifying the pool was initialized correctly
4. Checking balances to ensure two-sided liquidity

**Expected Result**: Transaction succeeds, pool is initialized, both MON and KEEP are in the pool.

### `verify_refund.ts`
Tests the refund logic by:
1. Deploying all contracts
2. Adding liquidity
3. Verifying that unused tokens are refunded properly
4. Checking that no tokens are stuck in the Hook contract

**Expected Result**: Unused tokens are refunded, Hook balance is 0.

### Utility Scripts

- `calc_price.ts` - Calculate price conversions and tick values
- `decode_selectors.ts` - Decode error selectors from contracts
- `inspect_interface.ts` - Inspect contract interfaces

## What Gets Tested

The tests verify:
- ✅ Overflow fix works (no arithmetic overflow with automatic tick range)
- ✅ Pool initialization succeeds
- ✅ Two-sided liquidity is created
- ✅ Refund logic works correctly
- ✅ No tokens get stuck in the Hook contract

## Troubleshooting

### "Hardhat node is NOT running"
Make sure you started `npx hardhat node` in a separate terminal and it's still running.

### "Insufficient funds" or "insufficient balance"
Run `fund_deployer.ts` first to fund your deployer account.

### "Contract deployment failed"
- Make sure contracts are compiled: `npx hardhat compile`
- Check that the Hardhat node is running and responsive
- Verify your `.env` file has the correct `PRIVATE_KEY` set

### Tests pass but you want to verify manually
After running tests, you can interact with the deployed contracts using Hardhat console:
```powershell
npx hardhat console --network localhost
```

## Next Steps

Once local tests pass:
1. Deploy the fix to mainnet using `scripts/upgrade_overflow_fix.ts`
2. Verify the contract on the block explorer
3. Test on mainnet with small amounts
4. Re-enable the frontend UI

See `NEXT_STEPS.md` in the contracts directory for the full deployment process.
