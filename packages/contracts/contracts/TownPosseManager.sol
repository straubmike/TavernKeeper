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

contract TownPosseManager is Initializable, OwnableUpgradeable, UUPSUpgradeable, ReentrancyGuardUpgradeable {
    using SafeERC20 for IERC20;
    using CurrencyLibrary for Currency;

    // Constants
    uint256 public constant MIN_MEMBERS = 10;
    uint256 public constant MAX_MEMBERS = 100;
    uint256 public constant CONTRIBUTION_TAX_BPS = 100; // 1% = 100 basis points
    uint256 public constant BPS_DENOMINATOR = 10000;
    uint256 public constant VOTING_PERIOD = 7 days;
    uint256 public constant QUORUM_BPS = 5000; // 50% quorum

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

    // Tier thresholds
    uint256 public bronzeThreshold;
    uint256 public silverThreshold;
    uint256 public goldThreshold;

    // Posse data structure
    struct TownPosseGroup {
        uint256 posseId;
        address creator;
        address[] members;
        uint256 maxMembers;
        uint256 minContribution;
        mapping(address => uint256) tier; // 1=Bronze, 2=Silver, 3=Gold
        uint256 totalContribution;
        mapping(address => uint256) contributions;
        uint256 lpTokenBalance;
        mapping(address => uint256) memberShares;
        bool openMembership;
        uint256 createdAt;
        bool active;
        string posseName;
        mapping(address => uint256) pendingFees;
        mapping(address => bool) joinRequests; // Track join requests for permissioned groups
    }

    // Proposal data structure
    struct Proposal {
        uint256 proposalId;
        address proposer;
        string description;
        bytes data;
        uint256 votesFor;
        uint256 votesAgainst;
        uint256 deadline;
        bool executed;
        mapping(address => bool) voted;
    }

    // State variables
    mapping(uint256 => TownPosseGroup) public posses;
    mapping(address => uint256[]) public userPosses;
    mapping(uint256 => mapping(uint256 => Proposal)) public proposals; // posseId => proposalId => Proposal
    mapping(uint256 => uint256) public nextProposalId; // posseId => next proposal ID
    uint256 public nextPosseId;

    // Events
    event PosseCreated(uint256 indexed posseId, address indexed creator, string name);
    event MemberJoined(uint256 indexed posseId, address indexed member);
    event JoinRequested(uint256 indexed posseId, address indexed requester);
    event MemberApproved(uint256 indexed posseId, address indexed member);
    event TierUpdated(uint256 indexed posseId, address indexed member, uint256 tier);
    event PosseContributed(uint256 indexed posseId, address indexed member, uint256 amountMON, uint256 lpTokensReceived);
    event PosseWithdrawn(uint256 indexed posseId, address indexed member, uint256 lpTokenAmount);
    event ProposalCreated(uint256 indexed posseId, uint256 indexed proposalId, address indexed proposer, string description);
    event VoteCast(uint256 indexed posseId, uint256 indexed proposalId, address indexed voter, bool support);
    event ProposalExecuted(uint256 indexed posseId, uint256 indexed proposalId);
    event FeesDistributed(uint256 indexed posseId, uint256 toMembers, uint256 toPot);
    event FeesClaimed(uint256 indexed posseId, address indexed member, uint256 amount);

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
        uint256 _bronzeThreshold,
        uint256 _silverThreshold,
        uint256 _goldThreshold,
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
        bronzeThreshold = _bronzeThreshold;
        silverThreshold = _silverThreshold;
        goldThreshold = _goldThreshold;
        nextPosseId = 1;
        memberShareBps = 7500;
        flywheelFeeBps = 2000;
        treasuryFeeBps = 500;
        ownerTaxBps = 0;
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    // ============ Group Management ============

    /**
     * @notice Create a new Town Posse
     * @param name Posse name
     * @param maxMembers Maximum members (10-100)
     * @param openMembership Whether anyone can join (true) or approval needed (false)
     * @param minContribution Minimum contribution to join
     * @return posseId The ID of the newly created posse
     */
    function createTownPosse(
        string memory name,
        uint256 maxMembers,
        bool openMembership,
        uint256 minContribution
    ) external returns (uint256 posseId) {
        require(maxMembers >= MIN_MEMBERS && maxMembers <= MAX_MEMBERS, "Invalid max members");

        posseId = nextPosseId++;

        TownPosseGroup storage posse = posses[posseId];
        posse.posseId = posseId;
        posse.creator = msg.sender;
        posse.members.push(msg.sender);
        posse.maxMembers = maxMembers;
        posse.minContribution = minContribution;
        posse.openMembership = openMembership;
        posse.createdAt = block.timestamp;
        posse.active = true;
        posse.posseName = name;
        posse.tier[msg.sender] = 1; // Bronze by default
        posse.memberShares[msg.sender] = 0;

        userPosses[msg.sender].push(posseId);

        emit PosseCreated(posseId, msg.sender, name);
        return posseId;
    }

    /**
     * @notice Request to join a posse
     * @param posseId The ID of the posse to join
     */
    function requestJoinTownPosse(uint256 posseId) external {
        TownPosseGroup storage posse = posses[posseId];
        require(posse.active, "Posse not active");
        require(posse.members.length < posse.maxMembers, "Posse full");

        // Check if already a member
        bool isMember = false;
        for (uint256 i = 0; i < posse.members.length; i++) {
            if (posse.members[i] == msg.sender) {
                isMember = true;
                break;
            }
        }
        require(!isMember, "Already a member");

        if (posse.openMembership) {
            // Auto-approve for open membership
            posse.members.push(msg.sender);
            posse.tier[msg.sender] = 1; // Bronze by default
            posse.memberShares[msg.sender] = 0;
            userPosses[msg.sender].push(posseId);
            emit MemberJoined(posseId, msg.sender);
        } else {
            // Create join request for permissioned groups
            posse.joinRequests[msg.sender] = true;
            emit JoinRequested(posseId, msg.sender);
        }
    }

    /**
     * @notice Approve a join request
     * @param posseId The ID of the posse
     * @param member Member to approve
     */
    function approveTownPosseMember(uint256 posseId, address member) external {
        TownPosseGroup storage posse = posses[posseId];
        require(posse.active, "Posse not active");
        require(posse.members.length < posse.maxMembers, "Posse full");

        // Verify caller is creator or member (simplified - could add more permission logic)
        bool isAuthorized = false;
        if (posse.creator == msg.sender) {
            isAuthorized = true;
        } else {
            for (uint256 i = 0; i < posse.members.length; i++) {
                if (posse.members[i] == msg.sender) {
                    isAuthorized = true;
                    break;
                }
            }
        }
        require(isAuthorized, "Not authorized");
        require(posse.joinRequests[member], "No join request");

        posse.joinRequests[member] = false;
        posse.members.push(member);
        posse.tier[member] = 1; // Bronze by default
        posse.memberShares[member] = 0;
        userPosses[member].push(posseId);

        emit MemberApproved(posseId, member);
    }

    // ============ Tier Management ============

    /**
     * @notice Update member tier based on contribution
     * @param posseId The ID of the posse
     * @param member Member to update
     */
    function updateMemberTier(uint256 posseId, address member) public {
        TownPosseGroup storage posse = posses[posseId];
        require(posse.active, "Posse not active");

        uint256 contribution = posse.contributions[member];
        uint256 newTier;

        if (contribution >= goldThreshold) {
            newTier = 3; // Gold
        } else if (contribution >= silverThreshold) {
            newTier = 2; // Silver
        } else {
            newTier = 1; // Bronze
        }

        posse.tier[member] = newTier;
        emit TierUpdated(posseId, member, newTier);
    }

    // ============ Liquidity Management ============

    /**
     * @notice Contribute liquidity to a Town Posse
     * @param posseId The ID of the posse
     * @param amountMON Amount of MON to contribute
     * @param amountKEEP Amount of KEEP to contribute
     * @return lpTokensReceived Amount of LP tokens received
     */
    function contributeToTownPosse(
        uint256 posseId,
        uint256 amountMON,
        uint256 amountKEEP
    ) external payable nonReentrant returns (uint256 lpTokensReceived) {
        TownPosseGroup storage posse = posses[posseId];
        require(posse.active, "Posse not active");

        // Verify caller is a member
        bool isMember = false;
        for (uint256 i = 0; i < posse.members.length; i++) {
            if (posse.members[i] == msg.sender) {
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
            ICellarHook(cellarHook).contributeToPot{value: taxAmount}();
        } else {
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

        // Update posse state
        posse.totalContribution += contributionAmount;
        posse.contributions[msg.sender] += contributionAmount;
        posse.lpTokenBalance += lpTokensReceived;
        posse.memberShares[msg.sender] += lpTokensReceived;

        // Update tier if threshold crossed
        updateMemberTier(posseId, msg.sender);

        emit PosseContributed(posseId, msg.sender, contributionAmount, lpTokensReceived);
        return lpTokensReceived;
    }

    /**
     * @notice Withdraw liquidity from a Town Posse
     * @param posseId The ID of the posse
     * @param lpTokenAmount Amount of LP tokens to withdraw
     */
    function withdrawFromTownPosse(uint256 posseId, uint256 lpTokenAmount) external nonReentrant {
        TownPosseGroup storage posse = posses[posseId];
        require(posse.active, "Posse not active");
        require(posse.memberShares[msg.sender] >= lpTokenAmount, "Insufficient shares");

        // Update posse state
        posse.lpTokenBalance -= lpTokenAmount;
        posse.memberShares[msg.sender] -= lpTokenAmount;

        // Update tier if needed (contribution may have decreased)
        updateMemberTier(posseId, msg.sender);

        // Transfer LP tokens back to member
        IERC20(cellarHook).safeTransfer(msg.sender, lpTokenAmount);

        emit PosseWithdrawn(posseId, msg.sender, lpTokenAmount);
    }

    // ============ Governance ============

    /**
     * @notice Create a governance proposal
     * @param posseId The ID of the posse
     * @param description Proposal description
     * @param data Function call data (encoded)
     * @return proposalId The ID of the newly created proposal
     */
    function createTownPosseProposal(
        uint256 posseId,
        string memory description,
        bytes memory data
    ) external returns (uint256 proposalId) {
        TownPosseGroup storage posse = posses[posseId];
        require(posse.active, "Posse not active");

        // Verify caller is a member
        bool isMember = false;
        for (uint256 i = 0; i < posse.members.length; i++) {
            if (posse.members[i] == msg.sender) {
                isMember = true;
                break;
            }
        }
        require(isMember, "Not a member");

        proposalId = nextProposalId[posseId]++;

        Proposal storage proposal = proposals[posseId][proposalId];
        proposal.proposalId = proposalId;
        proposal.proposer = msg.sender;
        proposal.description = description;
        proposal.data = data;
        proposal.deadline = block.timestamp + VOTING_PERIOD;
        proposal.executed = false;

        emit ProposalCreated(posseId, proposalId, msg.sender, description);
        return proposalId;
    }

    /**
     * @notice Vote on a proposal
     * @param posseId The ID of the posse
     * @param proposalId The ID of the proposal
     * @param support true = for, false = against
     */
    function voteOnTownPosseProposal(uint256 posseId, uint256 proposalId, bool support) external {
        TownPosseGroup storage posse = posses[posseId];
        Proposal storage proposal = proposals[posseId][proposalId];

        require(posse.active, "Posse not active");
        require(block.timestamp <= proposal.deadline, "Voting ended");
        require(!proposal.executed, "Proposal executed");
        require(!proposal.voted[msg.sender], "Already voted");

        // Verify caller is a member
        bool isMember = false;
        for (uint256 i = 0; i < posse.members.length; i++) {
            if (posse.members[i] == msg.sender) {
                isMember = true;
                break;
            }
        }
        require(isMember, "Not a member");

        proposal.voted[msg.sender] = true;
        if (support) {
            proposal.votesFor++;
        } else {
            proposal.votesAgainst++;
        }

        emit VoteCast(posseId, proposalId, msg.sender, support);
    }

    /**
     * @notice Execute a passed proposal
     * @param posseId The ID of the posse
     * @param proposalId The ID of the proposal
     */
    function executeTownPosseProposal(uint256 posseId, uint256 proposalId) external {
        TownPosseGroup storage posse = posses[posseId];
        Proposal storage proposal = proposals[posseId][proposalId];

        require(posse.active, "Posse not active");
        require(block.timestamp > proposal.deadline, "Voting ongoing");
        require(!proposal.executed, "Already executed");
        require(proposal.votesFor > proposal.votesAgainst, "Proposal failed");

        // Check quorum
        uint256 totalVotes = proposal.votesFor + proposal.votesAgainst;
        uint256 quorum = (posse.members.length * QUORUM_BPS) / BPS_DENOMINATOR;
        require(totalVotes >= quorum, "Quorum not met");

        proposal.executed = true;

        // Execute proposal data (low-level call)
        (bool success, ) = address(this).call(proposal.data);
        require(success, "Proposal execution failed");

        emit ProposalExecuted(posseId, proposalId);
    }

    // ============ Fee Distribution ============

    /**
     * @notice Distribute fees earned by the posse's LP position
     * @param posseId The ID of the posse
     * @param totalFees Total fees earned (in MON)
     * @dev For native MON, send value with call. For ERC20 MON, transfer fees to contract first.
     */
    function distributeTownPosseFees(uint256 posseId, uint256 totalFees) external payable {
        TownPosseGroup storage posse = posses[posseId];
        require(posse.active, "Posse not active");
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
        uint256 totalShares = posse.lpTokenBalance;
        if (totalShares > 0) {
            for (uint256 i = 0; i < posse.members.length; i++) {
                address member = posse.members[i];
                uint256 memberShare = posse.memberShares[member];
                if (memberShare > 0) {
                    uint256 memberFee = (toMembers * memberShare) / totalShares;
                    posse.pendingFees[member] += memberFee;
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

        emit FeesDistributed(posseId, toMembers, toPot);
    }

    /**
     * @notice Claim pending fees for a member
     * @param posseId The ID of the posse
     */
    function claimTownPosseFees(uint256 posseId) external nonReentrant {
        TownPosseGroup storage posse = posses[posseId];
        uint256 amount = posse.pendingFees[msg.sender];
        require(amount > 0, "No fees to claim");

        posse.pendingFees[msg.sender] = 0;

        if (Currency.unwrap(MON) == address(0)) {
            (bool success, ) = msg.sender.call{value: amount}("");
            require(success, "Transfer failed");
        } else {
            IERC20(Currency.unwrap(MON)).safeTransfer(msg.sender, amount);
        }

        emit FeesClaimed(posseId, msg.sender, amount);
    }

    // ============ View Functions ============

    /**
     * @notice Get posse members
     * @param posseId The ID of the posse
     * @return Array of member addresses
     */
    function getPosseMembers(uint256 posseId) external view returns (address[] memory) {
        return posses[posseId].members;
    }

    /**
     * @notice Get member's tier in a posse
     * @param posseId The ID of the posse
     * @param member Member address
     * @return Tier (1=Bronze, 2=Silver, 3=Gold)
     */
    function getMemberTier(uint256 posseId, address member) external view returns (uint256) {
        return posses[posseId].tier[member];
    }

    /**
     * @notice Get member's share in a posse
     * @param posseId The ID of the posse
     * @param member Member address
     * @return Share amount
     */
    function getMemberShare(uint256 posseId, address member) external view returns (uint256) {
        return posses[posseId].memberShares[member];
    }

    /**
     * @notice Get member's pending fees
     * @param posseId The ID of the posse
     * @param member Member address
     * @return Pending fee amount
     */
    function getPendingFees(uint256 posseId, address member) external view returns (uint256) {
        return posses[posseId].pendingFees[member];
    }

    /**
     * @notice Get user's posses
     * @param user User address
     * @return Array of posse IDs
     */
    function getUserPosses(address user) external view returns (uint256[] memory) {
        return userPosses[user];
    }

    /**
     * @notice Get proposal details
     * @param posseId The ID of the posse
     * @param proposalId The ID of the proposal
     * @return proposer Proposer address
     * @return description Proposal description
     * @return votesFor Votes for
     * @return votesAgainst Votes against
     * @return deadline Voting deadline
     * @return executed Whether executed
     */
    function getProposal(uint256 posseId, uint256 proposalId)
        external
        view
        returns (
            address proposer,
            string memory description,
            uint256 votesFor,
            uint256 votesAgainst,
            uint256 deadline,
            bool executed
        )
    {
        Proposal storage proposal = proposals[posseId][proposalId];
        return (
            proposal.proposer,
            proposal.description,
            proposal.votesFor,
            proposal.votesAgainst,
            proposal.deadline,
            proposal.executed
        );
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
