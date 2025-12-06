// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {Currency, CurrencyLibrary} from "@uniswap/v4-core/src/types/Currency.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuardUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

interface ICellarHook {
    function addLiquidity(PoolKey calldata key, uint256 amountMON, uint256 amountKEEP, int24 tickLower, int24 tickUpper) external payable;
    function contributeToPot() external payable;
    function contributeToPotERC20(uint256 amount) external;
}

contract TavernRegularsManager is Initializable, OwnableUpgradeable, UUPSUpgradeable, ReentrancyGuardUpgradeable {
    using SafeERC20 for IERC20;
    using CurrencyLibrary for Currency;

    // Constants
    uint256 public constant MAX_MEMBERS = 10;
    uint256 public constant CONTRIBUTION_TAX_BPS = 100; // 1% = 100 basis points
    uint256 public constant BPS_DENOMINATOR = 10000;

    // Configurable fee splits (changeable by owner)
    uint256 public memberShareBps; // 75% to members
    uint256 public flywheelFeeBps; // 20% to pot
    uint256 public treasuryFeeBps; // 5% to treasury
    uint256 public ownerTaxBps; // Owner tax percentage (applied to total fees)

    // Dependencies
    address public cellarHook;
    address public cellarZap;
    address public treasury; // Treasury address for fee collection
    IPoolManager public poolManager;
    Currency public MON;
    Currency public KEEP;

    // Group data structure
    struct TavernRegularsGroup {
        uint256 groupId;
        address creator;
        address[] members;
        uint256 totalContribution; // Total MON contributed
        mapping(address => uint256) contributions; // Per-member contributions
        uint256 lpTokenBalance; // Total LP tokens held
        mapping(address => uint256) memberShares; // LP tokens per member
        uint256 createdAt;
        bool active;
        string groupName;
        mapping(address => uint256) pendingFees; // Fees earned but not yet claimed
    }

    // State variables
    mapping(uint256 => TavernRegularsGroup) public groups;
    mapping(address => uint256[]) public userGroups;
    uint256 public nextGroupId;

    // Events
    event GroupCreated(uint256 indexed groupId, address indexed creator, string groupName);
    event MemberJoined(uint256 indexed groupId, address indexed member);
    event GroupContributed(uint256 indexed groupId, address indexed member, uint256 amountMON, uint256 lpTokensReceived);
    event GroupWithdrawn(uint256 indexed groupId, address indexed member, uint256 lpTokenAmount);
    event FeesDistributed(uint256 indexed groupId, uint256 toMembers, uint256 toPot);
    event FeesClaimed(uint256 indexed groupId, address indexed member, uint256 amount);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        address _cellarHook,
        address _cellarZap,
        IPoolManager _poolManager,
        Currency _mon,
        Currency _keep,
        address _treasury,
        address _owner
    ) public initializer {
        __Ownable_init(_owner);
        __UUPSUpgradeable_init();
        __ReentrancyGuard_init();

        cellarHook = _cellarHook;
        cellarZap = _cellarZap;
        poolManager = _poolManager;
        MON = _mon;
        KEEP = _keep;
        treasury = _treasury;
        nextGroupId = 1;
        memberShareBps = 7500;
        flywheelFeeBps = 2000;
        treasuryFeeBps = 500;
        ownerTaxBps = 0;
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    // ============ Group Management ============

    /**
     * @notice Create a new Tavern Regulars group
     * @param groupName Name of the group
     * @return groupId The ID of the newly created group
     */
    function createTavernRegularsGroup(string memory groupName) external returns (uint256 groupId) {
        groupId = nextGroupId++;

        TavernRegularsGroup storage group = groups[groupId];
        group.groupId = groupId;
        group.creator = msg.sender;
        group.members.push(msg.sender);
        group.createdAt = block.timestamp;
        group.active = true;
        group.groupName = groupName;
        group.memberShares[msg.sender] = 0;

        userGroups[msg.sender].push(groupId);

        emit GroupCreated(groupId, msg.sender, groupName);
        return groupId;
    }

    /**
     * @notice Join an existing Tavern Regulars group
     * @param groupId The ID of the group to join
     */
    function joinTavernRegularsGroup(uint256 groupId) external {
        TavernRegularsGroup storage group = groups[groupId];
        require(group.active, "Group not active");
        require(group.members.length < MAX_MEMBERS, "Group full");

        // Check if already a member
        bool isMember = false;
        for (uint256 i = 0; i < group.members.length; i++) {
            if (group.members[i] == msg.sender) {
                isMember = true;
                break;
            }
        }
        require(!isMember, "Already a member");

        group.members.push(msg.sender);
        group.memberShares[msg.sender] = 0;
        userGroups[msg.sender].push(groupId);

        emit MemberJoined(groupId, msg.sender);
    }

    // ============ Liquidity Management ============

    /**
     * @notice Contribute liquidity to a Tavern Regulars group
     * @param groupId The ID of the group
     * @param amountMON Amount of MON to contribute
     * @param amountKEEP Amount of KEEP to contribute
     * @return lpTokensReceived Amount of LP tokens received
     */
    function contributeToTavernRegularsGroup(
        uint256 groupId,
        uint256 amountMON,
        uint256 amountKEEP
    ) external payable nonReentrant returns (uint256 lpTokensReceived) {
        TavernRegularsGroup storage group = groups[groupId];
        require(group.active, "Group not active");

        // Verify caller is a member
        bool isMember = false;
        for (uint256 i = 0; i < group.members.length; i++) {
            if (group.members[i] == msg.sender) {
                isMember = true;
                break;
            }
        }
        require(isMember, "Not a member");
        require(amountMON > 0 && amountKEEP > 0, "Amounts must be > 0");

        // Calculate 1% contribution tax
        uint256 taxAmount = (amountMON * CONTRIBUTION_TAX_BPS) / BPS_DENOMINATOR;
        uint256 contributionAmount = amountMON - taxAmount;

        // Transfer tokens from caller
        if (Currency.unwrap(MON) == address(0)) {
            require(msg.value == amountMON, "Incorrect MON value");
        } else {
            IERC20(Currency.unwrap(MON)).safeTransferFrom(msg.sender, address(this), amountMON);
        }
        IERC20(Currency.unwrap(KEEP)).safeTransferFrom(msg.sender, address(this), amountKEEP);

        // Send tax to CellarHook pot
        if (Currency.unwrap(MON) == address(0)) {
            // Native MON
            ICellarHook(cellarHook).contributeToPot{value: taxAmount}();
        } else {
            // ERC20 MON
            IERC20(Currency.unwrap(MON)).forceApprove(cellarHook, taxAmount);
            ICellarHook(cellarHook).contributeToPotERC20(taxAmount);
        }

        // Approve CellarHook for remaining tokens
        if (Currency.unwrap(MON) != address(0)) {
            IERC20(Currency.unwrap(MON)).forceApprove(cellarHook, contributionAmount);
        }
        IERC20(Currency.unwrap(KEEP)).forceApprove(cellarHook, amountKEEP);

        // Construct PoolKey
        (Currency currency0, Currency currency1) = sortCurrencies(MON, KEEP);
        PoolKey memory key = PoolKey({
            currency0: currency0,
            currency1: currency1,
            fee: 10000, // 1.0% fee (updated from 3000)
            tickSpacing: 200, // Updated from 60
            hooks: IHooks(cellarHook)
        });

        // Add liquidity via CellarHook
        uint256 valueToSend = Currency.unwrap(MON) == address(0) ? contributionAmount : 0;
        uint256 lpBalanceBefore = IERC20(cellarHook).balanceOf(address(this));

        ICellarHook(cellarHook).addLiquidity{value: valueToSend}(
            key,
            contributionAmount,
            amountKEEP,
            0, // tickLower
            0  // tickUpper
        );

        uint256 lpBalanceAfter = IERC20(cellarHook).balanceOf(address(this));
        lpTokensReceived = lpBalanceAfter - lpBalanceBefore;

        // Update group state
        group.totalContribution += contributionAmount;
        group.contributions[msg.sender] += contributionAmount;
        group.lpTokenBalance += lpTokensReceived;
        group.memberShares[msg.sender] += lpTokensReceived;

        emit GroupContributed(groupId, msg.sender, contributionAmount, lpTokensReceived);
        return lpTokensReceived;
    }

    /**
     * @notice Withdraw liquidity from a Tavern Regulars group
     * @param groupId The ID of the group
     * @param lpTokenAmount Amount of LP tokens to withdraw
     */
    function withdrawFromTavernRegularsGroup(uint256 groupId, uint256 lpTokenAmount) external nonReentrant {
        TavernRegularsGroup storage group = groups[groupId];
        require(group.active, "Group not active");
        require(group.memberShares[msg.sender] >= lpTokenAmount, "Insufficient shares");

        // Update group state
        group.lpTokenBalance -= lpTokenAmount;
        group.memberShares[msg.sender] -= lpTokenAmount;

        // Transfer LP tokens back to member
        IERC20(cellarHook).safeTransfer(msg.sender, lpTokenAmount);

        emit GroupWithdrawn(groupId, msg.sender, lpTokenAmount);
    }

    // ============ Fee Distribution ============

    /**
     * @notice Distribute fees earned by the group's LP position
     * @param groupId The ID of the group
     * @param totalFees Total fees earned (in MON)
     * @dev For native MON, send value with call. For ERC20 MON, transfer fees to contract first.
     */
    function distributeGroupFees(uint256 groupId, uint256 totalFees) external payable {
        TavernRegularsGroup storage group = groups[groupId];
        require(group.active, "Group not active");
        require(totalFees > 0, "No fees to distribute");

        // For native MON, verify msg.value matches totalFees
        if (Currency.unwrap(MON) == address(0)) {
            require(msg.value == totalFees, "Incorrect native MON amount");
        } else {
            // For ERC20, fees should already be in contract (transferred beforehand)
            require(IERC20(Currency.unwrap(MON)).balanceOf(address(this)) >= totalFees, "Insufficient fees in contract");
        }

        // Calculate owner tax first (applied to total fees)
        uint256 ownerTax = (totalFees * ownerTaxBps) / BPS_DENOMINATOR;
        uint256 feesAfterTax = totalFees - ownerTax;

        // Calculate splits: 75% to members, 20% to pot, 5% to treasury
        uint256 toMembers = (feesAfterTax * memberShareBps) / BPS_DENOMINATOR;
        uint256 toPot = (feesAfterTax * flywheelFeeBps) / BPS_DENOMINATOR;
        uint256 toTreasury = (feesAfterTax * treasuryFeeBps) / BPS_DENOMINATOR;

        // Distribute to members proportionally based on shares
        uint256 totalShares = group.lpTokenBalance;
        if (totalShares > 0) {
            for (uint256 i = 0; i < group.members.length; i++) {
                address member = group.members[i];
                uint256 memberShare = group.memberShares[member];
                if (memberShare > 0) {
                    uint256 memberFee = (toMembers * memberShare) / totalShares;
                    group.pendingFees[member] += memberFee;
                }
            }
        }

        // Send owner tax
        if (ownerTax > 0) {
            if (Currency.unwrap(MON) == address(0)) {
                (bool success, ) = owner().call{value: ownerTax}("");
                require(success, "Owner tax transfer failed");
            } else {
                IERC20(Currency.unwrap(MON)).safeTransfer(owner(), ownerTax);
            }
        }

        // Send 20% to CellarHook pot
        if (Currency.unwrap(MON) == address(0)) {
            ICellarHook(cellarHook).contributeToPot{value: toPot}();
        } else {
            IERC20(Currency.unwrap(MON)).forceApprove(cellarHook, toPot);
            ICellarHook(cellarHook).contributeToPotERC20(toPot);
        }

        // Send 5% to treasury
        if (toTreasury > 0) {
            if (Currency.unwrap(MON) == address(0)) {
                (bool success, ) = treasury.call{value: toTreasury}("");
                require(success, "Treasury transfer failed");
            } else {
                IERC20(Currency.unwrap(MON)).safeTransfer(treasury, toTreasury);
            }
        }

        emit FeesDistributed(groupId, toMembers, toPot);
    }

    /**
     * @notice Claim pending fees for a member
     * @param groupId The ID of the group
     */
    function claimTavernRegularsFees(uint256 groupId) external nonReentrant {
        TavernRegularsGroup storage group = groups[groupId];
        uint256 amount = group.pendingFees[msg.sender];
        require(amount > 0, "No fees to claim");

        group.pendingFees[msg.sender] = 0;

        if (Currency.unwrap(MON) == address(0)) {
            (bool success, ) = msg.sender.call{value: amount}("");
            require(success, "Transfer failed");
        } else {
            IERC20(Currency.unwrap(MON)).safeTransfer(msg.sender, amount);
        }

        emit FeesClaimed(groupId, msg.sender, amount);
    }

    // ============ View Functions ============

    /**
     * @notice Get group members
     * @param groupId The ID of the group
     * @return Array of member addresses
     */
    function getGroupMembers(uint256 groupId) external view returns (address[] memory) {
        return groups[groupId].members;
    }

    /**
     * @notice Get member's share in a group
     * @param groupId The ID of the group
     * @param member Member address
     * @return Share amount
     */
    function getMemberShare(uint256 groupId, address member) external view returns (uint256) {
        return groups[groupId].memberShares[member];
    }

    /**
     * @notice Get member's pending fees
     * @param groupId The ID of the group
     * @param member Member address
     * @return Pending fee amount
     */
    function getPendingFees(uint256 groupId, address member) external view returns (uint256) {
        return groups[groupId].pendingFees[member];
    }

    /**
     * @notice Get user's groups
     * @param user User address
     * @return Array of group IDs
     */
    function getUserGroups(address user) external view returns (uint256[] memory) {
        return userGroups[user];
    }

    // ============ Owner Configuration Functions ============

    /**
     * @notice Set fee distribution percentages (only owner)
     * @param _memberShareBps Member share in basis points
     * @param _flywheelFeeBps Pot share in basis points
     * @param _treasuryFeeBps Treasury share in basis points
     */
    function setFeeSplits(
        uint256 _memberShareBps,
        uint256 _flywheelFeeBps,
        uint256 _treasuryFeeBps
    ) external onlyOwner {
        require(
            _memberShareBps + _flywheelFeeBps + _treasuryFeeBps == BPS_DENOMINATOR,
            "Fee splits must sum to 100%"
        );
        memberShareBps = _memberShareBps;
        flywheelFeeBps = _flywheelFeeBps;
        treasuryFeeBps = _treasuryFeeBps;
    }

    /**
     * @notice Set owner tax percentage (only owner)
     * @param _ownerTaxBps Owner tax in basis points
     */
    function setOwnerTax(uint256 _ownerTaxBps) external onlyOwner {
        require(_ownerTaxBps <= 1000, "Owner tax cannot exceed 10%");
        ownerTaxBps = _ownerTaxBps;
    }

    /**
     * @notice Set treasury address (only owner)
     * @param _treasury New treasury address
     */
    function setTreasury(address _treasury) external onlyOwner {
        require(_treasury != address(0), "Treasury cannot be zero address");
        treasury = _treasury;
    }

    /**
     * @notice Set CellarHook address (only owner)
     * @param _cellarHook New CellarHook address
     */
    function setCellarHook(address _cellarHook) external onlyOwner {
        require(_cellarHook != address(0), "CellarHook cannot be zero address");
        cellarHook = _cellarHook;
    }

    // ============ Helper Functions ============

    function sortCurrencies(Currency a, Currency b) internal pure returns (Currency currency0, Currency currency1) {
        if (Currency.unwrap(a) < Currency.unwrap(b)) {
            (currency0, currency1) = (a, b);
        } else {
            (currency0, currency1) = (b, a);
        }
    }
}
