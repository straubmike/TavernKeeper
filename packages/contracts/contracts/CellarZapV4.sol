// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {Currency, CurrencyLibrary} from "@uniswap/v4-core/src/types/Currency.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";

interface ICellarHook {
    function addLiquidity(PoolKey calldata key, uint256 amountMON, uint256 amountKEEP, int24 tickLower, int24 tickUpper) external payable;
}

contract CellarZapV4 is Initializable, OwnableUpgradeable, UUPSUpgradeable {
    using SafeERC20 for IERC20;
    using CurrencyLibrary for Currency;

    // Note: In upgradeable contracts, immutable variables must become state variables
    IPoolManager public poolManager;
    address public cellarHook;
    Currency public MON;
    Currency public KEEP;

    // We need the PoolKey to interact with the pool
    // Since the Hook is immutable, the PoolKey (with this Hook) is likely constant for our pair.
    // But we should store it or pass it.
    // For simplicity, we'll store the components.

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        IPoolManager _poolManager,
        address _cellarHook,
        Currency _mon,
        Currency _keep,
        address _owner
    ) public initializer {
        __Ownable_init(_owner);
        __UUPSUpgradeable_init();

        poolManager = _poolManager;
        cellarHook = _cellarHook;
        MON = _mon;
        KEEP = _keep;
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    receive() external payable {}

    function mintLP(uint256 amountMON, uint256 amountKEEP) external payable {
        // 1. Receive Tokens
        if (Currency.unwrap(MON) == address(0)) {
            require(msg.value == amountMON, "Incorrect MON value");
        } else {
            IERC20(Currency.unwrap(MON)).safeTransferFrom(msg.sender, address(this), amountMON);
        }
        IERC20(Currency.unwrap(KEEP)).safeTransferFrom(msg.sender, address(this), amountKEEP);

        // 2. Approve Hook
        if (Currency.unwrap(MON) != address(0)) {
            IERC20(Currency.unwrap(MON)).forceApprove(cellarHook, amountMON);
        }
        IERC20(Currency.unwrap(KEEP)).forceApprove(cellarHook, amountKEEP);

        // 3. Construct PoolKey
        // We need to sort currencies for the key
        (Currency currency0, Currency currency1) = sortCurrencies(MON, KEEP);

        PoolKey memory key = PoolKey({
            currency0: currency0,
            currency1: currency1,
            fee: 10000, // 1.0% fee (updated from 3000)
            tickSpacing: 200, // Updated from 60
            hooks: IHooks(cellarHook) // Cast address to IHooks
        });

        // 4. Call addLiquidity
        // Note: CellarHook.addLiquidity is payable if MON is native
        // Passing 0,0 for ticks will use full range automatically
        uint256 valueToSend = Currency.unwrap(MON) == address(0) ? amountMON : 0;

        ICellarHook(cellarHook).addLiquidity{value: valueToSend}(
            key,
            amountMON,
            amountKEEP,
            0, // tickLower (0 = use full range)
            0  // tickUpper (0 = use full range)
        );

        // 5. Transfer CLP (Cellar LP) to user
        // CellarHook mints to msg.sender (this contract)
        uint256 lpBalance = IERC20(cellarHook).balanceOf(address(this));
        IERC20(cellarHook).safeTransfer(msg.sender, lpBalance);
    }

    function sortCurrencies(Currency a, Currency b) internal pure returns (Currency currency0, Currency currency1) {
        if (Currency.unwrap(a) < Currency.unwrap(b)) {
            (currency0, currency1) = (a, b);
        } else {
            (currency0, currency1) = (b, a);
        }
    }
}
