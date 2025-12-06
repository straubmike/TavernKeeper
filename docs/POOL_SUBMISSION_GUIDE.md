# Uniswap V4 Pool Submission Guide

This guide provides information for submitting the KEEP/MON Uniswap V4 pool to DEX aggregators and other discovery services.

## Pool Information

### Mainnet (Monad Chain ID: 143)

**Pool Manager**: `0x27e98f6A0D3315F9f3ECDaFE0187a7637F41c7c2`

**Pool Key Parameters:**
- **Currency 0**: MON (Native) - `0x0000000000000000000000000000000000000000`
- **Currency 1**: KEEP Token - `0x2D1094F5CED6ba279962f9676d32BE092AFbf82E`
- **Fee**: 10000 (1.0%)
- **Tick Spacing**: 200
- **Hooks**: CellarHook - `0xe71CAf7162dd81a4A9C0c6BD25ED02C26F492DC0`

**Pool ID Calculation:**
```solidity
poolId = keccak256(abi.encodePacked(
    currency0,  // 0x0000000000000000000000000000000000000000
    currency1,  // 0x2D1094F5CED6ba279962f9676d32BE092AFbf82E
    fee,        // 10000
    tickSpacing,// 200
    hooks       // 0xe71CAf7162dd81a4A9C0c6BD25ED02C26F492DC0
))
```

### Testnet (Monad Testnet Chain ID: 10143)

**Pool Manager**: `0x8788E862023A49a77E8F27277a8b3F07B4E9A7d8`

**Pool Key Parameters:**
- **Currency 0**: MON (Native) - `0x0000000000000000000000000000000000000000`
- **Currency 1**: KEEP Token - `0x96982EC3625145f098DCe06aB34E99E7207b0520`
- **Fee**: 10000 (1.0%)
- **Tick Spacing**: 200
- **Hooks**: CellarHook - `0xA43034595E2d1c52Ab08a057B95dD38bCbFf87dC`

## Hook Information

**CellarHook** implements Uniswap V4 hooks for:
- LP token minting (ERC20 "CLP" tokens)
- Liquidity provision with custom mechanics
- Raid/auction mechanics
- Anti-sandwich protection

**Hook Implementation**: `0x3d27b2B29514Feb8B2780949579837C945003030`

## Token Information

### MON (Native)
- **Type**: Native currency (ETH equivalent on Monad)
- **Symbol**: MON
- **Decimals**: 18
- **Address**: `0x0000000000000000000000000000000000000000`

### KEEP Token
- **Type**: ERC-20
- **Symbol**: KEEP
- **Name**: Keep Token
- **Decimals**: 18
- **Mainnet Address**: `0x2D1094F5CED6ba279962f9676d32BE092AFbf82E`
- **Testnet Address**: `0x96982EC3625145f098DCe06aB34E99E7207b0520`

## Current Status

⚠️ **Important**: Uniswap V4 pools are **not automatically discovered** by standard DEX aggregators (1inch, Paraswap, Matcha, etc.) because:

1. V4 uses a different pool structure than V2/V3
2. V4 requires explicit PoolKey construction
3. Aggregators need to integrate V4 support explicitly

## Submission Process

### Option 1: Wait for Aggregator V4 Support

Most major aggregators are working on V4 support but haven't released it yet. Monitor:
- **1inch**: Check for V4 integration announcements
- **Paraswap**: Follow their development updates
- **Matcha**: Monitor for V4 support
- **Uniswap Interface**: Will support V4 pools automatically when V4 is fully deployed

### Option 2: Manual Integration Request

Contact aggregator teams directly:

1. **Provide Pool Metadata** (use the `.well-known/uniswap-v4-pool.json` file)
2. **Share Pool Key Details** (this document)
3. **Request V4 Integration** for Monad chain
4. **Provide Router Contract** (if you deploy one for easier integration)

### Option 3: Deploy Router Contract

To make swaps easier for aggregators, consider deploying a router contract that:
- Implements `IUnlockCallback`
- Handles the unlock pattern for swaps
- Provides a simpler interface (like Uniswap V2/V3 routers)

Example router pattern:
```solidity
contract SwapRouter is IUnlockCallback {
    function swapExactInputSingle(
        PoolKey calldata key,
        SwapParams calldata params,
        address recipient
    ) external payable returns (int256 delta) {
        // Handle unlock callback and swap logic
    }

    function unlockCallback(bytes calldata data) external returns (bytes memory) {
        // Implement callback logic
    }
}
```

## Metadata Endpoint

Pool metadata is available at:
- **Mainnet**: `https://tavernkeeper.gg/.well-known/uniswap-v4-pool.json`
- **Testnet**: Same endpoint (includes testnet info)

## Contract Addresses Reference

All addresses are documented in:
- `apps/web/lib/contracts/addresses.ts`
- `packages/contracts/DEPLOYMENT_TRACKER.md`

## Additional Resources

- **Uniswap V4 Documentation**: https://docs.uniswap.org/sdk/v4
- **Pool Manager Interface**: See `packages/contracts/typechain-types/@uniswap/v4-core/src/interfaces/IPoolManager.ts`
- **Project Documentation**: https://docs.tavernkeeper.gg

## Notes for Aggregators

1. **Pool Initialization**: Pool must be initialized before swaps (check via `getSlot0`)
2. **Liquidity Requirement**: Pool must have liquidity > 0
3. **Hook Behavior**: Hook implements anti-sandwich protection (one trade per block per address)
4. **Native Currency**: MON is native, not wrapped - handle transfers accordingly
5. **Fee Structure**: 1% fee (10000 basis points)

## Contact

For questions or integration support:
- **Documentation**: See project README
- **Issues**: Open a GitHub issue
- **Pool Metadata**: See `.well-known/uniswap-v4-pool.json`

