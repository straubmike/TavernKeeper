// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {BalanceDelta} from "@uniswap/v4-core/src/types/BalanceDelta.sol";
import {PoolId, PoolIdLibrary} from "@uniswap/v4-core/src/types/PoolId.sol";
import {Currency, CurrencyLibrary} from "@uniswap/v4-core/src/types/Currency.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ModifyLiquidityParams} from "@uniswap/v4-core/src/types/PoolOperation.sol";

contract PoolModifyLiquidityTest {
    using PoolIdLibrary for PoolKey;
    using CurrencyLibrary for Currency;
    using SafeERC20 for IERC20;

    IPoolManager public immutable manager;

    constructor(IPoolManager _manager) {
        manager = _manager;
    }

    struct CallbackData {
        address sender;
        PoolKey key;
        ModifyLiquidityParams params;
        bytes hookData;
    }

    function modifyLiquidity(
        PoolKey memory key,
        ModifyLiquidityParams memory params,
        bytes memory hookData
    ) external payable returns (BalanceDelta delta) {
        // 1. Call unlock to start the interaction
        bytes memory data = manager.unlock(abi.encode(CallbackData(msg.sender, key, params, hookData)));
        // 2. Decode return data if needed (delta is returned from unlockCallback)
        delta = abi.decode(data, (BalanceDelta));
    }

    function unlockCallback(bytes calldata rawData) external returns (bytes memory) {
        require(msg.sender == address(manager));
        CallbackData memory data = abi.decode(rawData, (CallbackData));
        
        // 3. Perform actions (modifyLiquidity)
        (BalanceDelta delta0, BalanceDelta delta1) = manager.modifyLiquidity(data.key, data.params, data.hookData);
        
        // 4. Settle deltas
        if (delta0.amount0() > 0) {
            _settle(data.key.currency0, data.sender, uint128(delta0.amount0()));
        }
        if (delta0.amount1() > 0) {
            _settle(data.key.currency1, data.sender, uint128(delta0.amount1()));
        }
        if (delta0.amount0() < 0) {
            _take(data.key.currency0, data.sender, uint128(-delta0.amount0()));
        }
        if (delta0.amount1() < 0) {
            _take(data.key.currency1, data.sender, uint128(-delta0.amount1()));
        }
        
        return abi.encode(delta0);
    }

    function _settle(Currency currency, address payer, uint256 amount) internal {
        if (Currency.unwrap(currency) == address(0)) {
            manager.settle{value: amount}();
        } else {
            IERC20(Currency.unwrap(currency)).safeTransferFrom(payer, address(manager), amount);
            manager.settle();
        }
    }

    function _take(Currency currency, address recipient, uint256 amount) internal {
        manager.take(currency, recipient, amount);
    }
    
    // Allow receiving ETH
    receive() external payable {}
}
