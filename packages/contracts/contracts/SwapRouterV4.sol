// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {IUnlockCallback} from "@uniswap/v4-core/src/interfaces/callback/IUnlockCallback.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {BalanceDelta} from "@uniswap/v4-core/src/types/BalanceDelta.sol";
import {SwapParams} from "@uniswap/v4-core/src/types/PoolOperation.sol";
import {Currency, CurrencyLibrary} from "@uniswap/v4-core/src/types/Currency.sol";
import {BalanceDeltaLibrary} from "@uniswap/v4-core/src/types/BalanceDelta.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title SwapRouterV4
 * @notice Simple swap router for Uniswap V4 that implements IUnlockCallback
 * @dev Handles swaps between MON (native) and KEEP (ERC20) tokens
 */
contract SwapRouterV4 is IUnlockCallback {
    using SafeERC20 for IERC20;
    using CurrencyLibrary for Currency;
    using BalanceDeltaLibrary for BalanceDelta;

    IPoolManager public immutable poolManager;

    struct SwapCallbackData {
        PoolKey key;
        SwapParams params;
        Currency currencyIn;
        Currency currencyOut;
        address payer;
        address recipient;
        uint256 amountIn;
    }

    // Storage for swap data during unlock callback
    SwapCallbackData private swapData;

    constructor(IPoolManager _poolManager) {
        poolManager = _poolManager;
    }

    /**
     * @notice Execute a swap with exact input amount
     * @param key The pool key
     * @param params Swap parameters (amountSpecified must be positive for exact input)
     * @param recipient Address to receive output tokens
     * @return delta The balance delta from the swap
     */
    function swapExactInput(
        PoolKey calldata key,
        SwapParams calldata params,
        address recipient
    ) external payable returns (BalanceDelta delta) {
        // Determine input and output currencies
        Currency currencyIn = params.zeroForOne ? key.currency0 : key.currency1;
        Currency currencyOut = params.zeroForOne ? key.currency1 : key.currency0;

        // Get amount in (must be positive for exact input)
        require(params.amountSpecified > 0, "Amount must be positive for exact input");
        uint256 amountIn = uint256(int256(params.amountSpecified));

        // Transfer input tokens from user to this contract BEFORE swap
        if (Currency.unwrap(currencyIn) == address(0)) {
            // Native currency (MON) - must be sent with transaction
            require(msg.value >= amountIn, "Insufficient native tokens sent");
        } else {
            // ERC20 token (KEEP) - transfer from user
            IERC20(Currency.unwrap(currencyIn)).safeTransferFrom(msg.sender, address(this), amountIn);
        }

        // Prepare callback data
        SwapCallbackData memory callbackData = SwapCallbackData({
            key: key,
            params: params,
            currencyIn: currencyIn,
            currencyOut: currencyOut,
            payer: msg.sender,
            recipient: recipient,
            amountIn: amountIn
        });

        // Store swap data for unlock callback
        swapData = callbackData;

        // Encode callback data
        bytes memory hookData = abi.encode(callbackData);

        // Execute swap via unlock (unlock calls unlockCallback which calls swap)
        poolManager.unlock(hookData);

        // Delta is handled in unlockCallback, return 0
        return BalanceDelta.wrap(0);
    }

    /**
     * @notice Unlock callback - called by PoolManager during unlock
     * @param data Encoded SwapCallbackData
     * @return bytes Empty bytes (not used)
     */
    function unlockCallback(bytes calldata data) external returns (bytes memory) {
        require(msg.sender == address(poolManager), "Only PoolManager");

        SwapCallbackData memory callbackData = abi.decode(data, (SwapCallbackData));

        // Execute the swap (this happens inside unlock callback)
        // Create new structs to pass to swap (which expects calldata)
        PoolKey memory key = callbackData.key;
        SwapParams memory swapParams = callbackData.params;
        BalanceDelta delta = poolManager.swap(key, swapParams, "");

        // Settle the balance delta
        _settleSwap(key, delta, callbackData);

        return "";
    }

    /**
     * @notice Settle the balance delta after swap
     * @param key The pool key
     * @param delta The balance delta from the swap
     * @param callbackData The callback data with payer/recipient info
     */
    function _settleSwap(
        PoolKey memory key,
        BalanceDelta delta,
        SwapCallbackData memory callbackData
    ) internal {
        int128 amount0 = BalanceDeltaLibrary.amount0(delta);
        int128 amount1 = BalanceDeltaLibrary.amount1(delta);

        Currency currency0 = key.currency0;
        Currency currency1 = key.currency1;

        // Handle currency0 (MON - native)
        if (amount0 < 0) {
            // We owe currency0 to PoolManager
            uint256 amountToSettle = uint256(uint128(-amount0));
            if (Currency.unwrap(currency0) == address(0)) {
                // Native currency
                poolManager.sync(currency0);
                poolManager.settle{value: amountToSettle}();
            } else {
                // ERC20
                IERC20(Currency.unwrap(currency0)).safeTransfer(address(poolManager), amountToSettle);
                poolManager.sync(currency0);
                poolManager.settle();
            }
        } else if (amount0 > 0) {
            // PoolManager owes us currency0
            uint256 amountToTake = uint256(uint128(amount0));
            poolManager.take(currency0, callbackData.recipient, amountToTake);
        }

        // Handle currency1 (KEEP - ERC20)
        if (amount1 < 0) {
            // We owe currency1 to PoolManager
            uint256 amountToSettle = uint256(uint128(-amount1));
            IERC20(Currency.unwrap(currency1)).safeTransfer(address(poolManager), amountToSettle);
            poolManager.sync(currency1);
            poolManager.settle();
        } else if (amount1 > 0) {
            // PoolManager owes us currency1
            uint256 amountToTake = uint256(uint128(amount1));
            poolManager.take(currency1, callbackData.recipient, amountToTake);
        }
    }

    // Allow receiving native tokens
    receive() external payable {}
}

