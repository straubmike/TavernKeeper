
# CRITICAL: Accidental Mainnet Deployment

**Date**: 2025-01-XX
**Network**: Monad Mainnet (Chain ID: 143)
**Script**: `deploy_localhost.ts` (accidentally run with `--network monad` instead of `--network localhost`)

## What Was Deployed

A complete set of NEW contracts was deployed to mainnet, creating duplicate/conflicting contracts:

### New Contracts Deployed

| Contract | Type | New Address | Old Mainnet Address | Status |
|----------|------|-------------|---------------------|--------|
| KeepToken | UUPS Proxy | `0x426f7c10e7D5329BB7E956e59fa19697c465daBA` | `0x2D1094F5CED6ba279962f9676d32BE092AFbf82E` | ⚠️ **DUPLICATE** |
| CellarHook | UUPS Proxy | `0xDA499a900FE25D738045CD6C299663471dE76Ae0` | `0xaDF53E062195C20DAD2E52b76550f0a266e40ac0` | ⚠️ **DUPLICATE** |
| Inventory | UUPS Proxy | `0x88f251AFD462AF1f604ACCebc22B084255f763b5` | `0xcB11EFb6E697b5eD7841717b4C994D3edC8393b4` | ⚠️ **DUPLICATE** |
| Adventurer | UUPS Proxy | `0x54911A51216824788ACea03fEE5F947b1281Cffe` | `0xb138Bf579058169e0657c12Fd9cc1267CAFcb935` | ⚠️ **DUPLICATE** |
| TavernKeeper | UUPS Proxy | `0x0FFD4b467326C6fBC5EB7ab901eC020f54970e9d` | `0x56B81A60Ae343342685911bd97D1331fF4fa2d29` | ⚠️ **DUPLICATE** |
| CellarZapV4 | UUPS Proxy | `0x335bAFEd9a8498B7779431154196d0712693827d` | `0xf7248a01051bf297Aa56F12a05e7209C60Fc5863` | ⚠️ **DUPLICATE** |
| PoolManager | Direct | `0x7e27aa2A0981CE3ef6d6DE41877DE3E19efB4cd3` | `0x27e98f6A0D3315F9f3ECDaFE0187a7637F41c7c2` | ⚠️ **DUPLICATE** |
| ERC6551Registry | Direct | `0x68AF593efD04d43994A1844e925E686C3Ec0732b` | `0xE74D0b9372e81037e11B4DEEe27D063C24060Ea9` | ⚠️ **DUPLICATE** |

## Impact Assessment

### ✅ GOOD NEWS: No Token Loss

1. **Old KEEP tokens are still valid** - They exist on the old contract (`0x2D1094F5CED6ba279962f9676d32BE092AFbf82E`)
2. **Old contracts still work** - All existing contracts continue to function
3. **No user funds lost** - All tokens remain on their original contracts

### ⚠️ CRITICAL ISSUES

1. **Token Incompatibility**:
   - Old KEEP tokens (`0x2D1094F5CED6ba279962f9676d32BE092AFbf82E`) cannot be used with new CellarHook
   - New KEEP tokens (`0x426f7c10e7D5329BB7E956e59fa19697c465daBA`) cannot be used with old CellarHook pool
   - **The two systems are completely separate**

2. **Pool Fragmentation**:
   - Old CellarHook pool (`0xaDF53E062195C20DAD2E52b76550f0a266e40ac0`) uses old KeepToken
   - New CellarHook (`0xDA499a900FE25D738045CD6C299663471dE76Ae0`) uses new KeepToken
   - **These are incompatible - users must choose one system**

3. **Contract References**:
   - All scripts and contracts reference OLD addresses
   - Frontend uses OLD addresses
   - **New contracts are orphaned unless we update everything**

4. **Configuration Issues**:
   - New CellarHook was initialized with new KeepToken
   - New CellarHook was initialized with new PoolManager
   - **Cannot use old tokens in new system**

## What Needs to Happen

### Option 1: Ignore New Contracts (Recommended)
- **Action**: Do nothing, ignore the new contracts
- **Impact**: Minimal - old system continues working
- **Risk**: Low - just wasted gas
- **Result**: New contracts sit unused on mainnet

### Option 2: Migrate to New Contracts (NOT RECOMMENDED)
- **Action**: Update all references to use new addresses
- **Impact**: **MASSIVE** - breaks all existing integrations
- **Risk**: **VERY HIGH** - users lose access to old tokens/pools
- **Result**: Complete system migration required, user confusion

### Option 3: Use New Contracts for New Features Only
- **Action**: Keep old system, use new contracts for future features
- **Impact**: Medium - two parallel systems
- **Risk**: Medium - confusion about which system to use
- **Result**: Dual system maintenance

## Recommended Action: Disable Orphaned Contracts

**DISABLE THE ORPHANED CONTRACTS** - Transfer ownership to dead address to prevent any use.

### Why:
1. Old system is working and has user funds
2. New contracts have no liquidity, no users, no integrations
3. Migration would be extremely disruptive
4. Gas cost is sunk - can't recover it anyway
5. Disabling prevents accidental use or confusion

### What to Do:
1. ✅ Run `disable_orphaned_mainnet_contracts.ts` to transfer ownership to dead address
2. ✅ **DO NOT** update any addresses to point to new contracts
3. ✅ **DO NOT** use new contracts for anything
4. ✅ Continue using old contracts as before
5. ✅ Document this as a lesson learned
6. ✅ Test fixes on localnet, then upgrade original mainnet contracts

## Contracts That Reference KeepToken

The following contracts/scripts reference the OLD KeepToken address:
- `upgrade_and_verify_mainnet.ts`: `0x2D1094F5CED6ba279962f9676d32BE092AFbf82E`
- `test_liquidity_addition.ts`: `0x2D1094F5CED6ba279962f9676d32BE092AFbf82E`
- `check_pool_state.ts`: `0x2D1094F5CED6ba279962f9676d32BE092AFbf82E`
- `deploy_new_pool_mainnet.ts`: `0x2D1094F5CED6ba279962f9676d32BE092AFbf82E`
- `MONAD_MAINNET_ADDRESSES.KEEP_TOKEN`: `0x2D1094F5CED6ba279962f9676d32BE092AFbf82E`
- Mainnet CellarHook pool: Uses `0x2D1094F5CED6ba279962f9676d32BE092AFbf82E`

**ALL OF THESE MUST CONTINUE USING THE OLD ADDRESS**

## Summary

**Damage Level**: ⚠️ **MODERATE** (wasted gas, confusion, but no fund loss)

**User Impact**: ✅ **NONE** (old system unaffected)

**Action Required**: ✅ **NONE** (just ignore new contracts)

**Old KeepToken**: ✅ **STILL VALID** - `0x2D1094F5CED6ba279962f9676d32BE092AFbf82E`

**Old CellarHook Pool**: ✅ **STILL WORKING** - `0xaDF53E062195C20DAD2E52b76550f0a266e40ac0`

**New Contracts**: ❌ **ORPHANED** - Do not use

## Disable Script

A script has been created to disable all orphaned contracts:
- **File**: `scripts/disable_orphaned_mainnet_contracts.ts`
- **Action**: Transfers ownership of all orphaned contracts to dead address (`0x000000000000000000000000000000000000dEaD`)
- **Effect**: Prevents upgrades, configuration changes, and accidental use
- **Status**: Ready to run on mainnet

### To Disable Orphaned Contracts:
```powershell
$env:NEXT_PUBLIC_MONAD_CHAIN_ID="143"
npx hardhat run scripts/disable_orphaned_mainnet_contracts.ts --network monad
```

**WARNING**: This is permanent. Once ownership is transferred to dead address, contracts cannot be recovered.

---

**Last Updated**: 2025-01-XX
**Status**: Documented, disable script created
