// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721URIStorageUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

contract TavernKeeper is Initializable, ERC721Upgradeable, ERC721URIStorageUpgradeable, OwnableUpgradeable, UUPSUpgradeable {
    using ECDSA for bytes32;

    uint256 private _nextTokenId;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize() public initializer {
        __ERC721_init("InnKeeper TavernKeeper", "KEEPER");
        __ERC721URIStorage_init();
        __Ownable_init(msg.sender);
        __UUPSUpgradeable_init();
    }

    // KEEP Token Integration
    address public keepToken;
    mapping(uint256 => uint256) public lastClaimTime;
    mapping(uint256 => uint256) public mintingRate; // Tokens per second
    uint256 public constant DEFAULT_RATE = 1e16; // 0.01 KEEP per second

    event TokensClaimed(uint256 indexed tokenId, uint256 amount);
    event KeepTokenUpdated(address indexed oldToken, address indexed newToken);

    function setKeepTokenContract(address _keepToken) public onlyOwner {
        require(_keepToken != address(0), "Invalid address");
        emit KeepTokenUpdated(keepToken, _keepToken);
        keepToken = _keepToken;
    }

    // Pricing Tiers (in wei/MON)


    // DEPRECATED: No longer initializes tier prices
    // Signature-based pricing is used instead
    // This function is kept for storage compatibility but does nothing
    function initializeRPG() public reinitializer(3) {
        // Tier prices deprecated - using signature-based pricing
        // Keeping function for storage layout compatibility
    }

    // Tier Thresholds
    uint256 public constant TIER1_MAX_ID = 100;
    uint256 public constant TIER2_MAX_ID = 1000;

    // Pricing Tiers (in wei/MON) - DEPRECATED but kept for storage compatibility
    uint256 public tier1Price;
    uint256 public tier2Price;
    uint256 public tier3Price;

    // Signature-based pricing
    address public signer; // Server address that signs prices
    mapping(address => uint256) public nonces; // Replay protection for signatures

    event TavernKeeperMinted(address indexed to, uint256 indexed tokenId, uint256 price);
    event TavernKeeperMintedWithSignature(address indexed to, uint256 indexed tokenId, uint256 price, uint256 nonce);
    event TierPricesUpdated(uint256 t1, uint256 t2, uint256 t3);
    event SignerUpdated(address newSigner);

    // DEPRECATED: No longer used - pricing is now signature-based
    function setTierPrices(uint256 _t1, uint256 _t2, uint256 _t3) external onlyOwner {
        tier1Price = _t1;
        tier2Price = _t2;
        tier3Price = _t3;
        emit TierPricesUpdated(_t1, _t2, _t3);
    }

    function setSigner(address _signer) external onlyOwner {
        require(_signer != address(0), "Invalid signer address");
        signer = _signer;
        emit SignerUpdated(_signer);
    }

    // DEPRECATED: Returns 0 - pricing is now signature-based
    // Kept for backward compatibility
    function getMintPrice(uint256 tokenId) public view returns (uint256) {
        return 0; // Signature-based pricing - use getPriceSignature API instead
    }

    /**
     * @dev Mint TavernKeeper with signature-based pricing
     * @param uri Metadata URI
     * @param amount MON amount in wei (from signed price)
     * @param deadline Signature expiration timestamp
     * @param signature Server signature authorizing this price
     */
    function mintTavernKeeper(
        string memory uri,
        uint256 amount,
        uint256 deadline,
        bytes calldata signature
    ) public payable returns (uint256) {
        require(signer != address(0), "Signer not set");
        require(block.timestamp <= deadline, "Signature expired");

        // Verify Signature
        bytes32 hash = keccak256(
            abi.encodePacked(
                msg.sender,
                amount,
                nonces[msg.sender],
                deadline,
                block.chainid,
                address(this)
            )
        );

        bytes32 ethSignedMessageHash = MessageHashUtils.toEthSignedMessageHash(hash);
        address recoveredSigner = ethSignedMessageHash.recover(signature);

        require(recoveredSigner == signer, "Invalid signature");

        // Increment nonce to prevent replay
        nonces[msg.sender]++;

        // Verify payment amount matches signed amount
        require(msg.value == amount, "Incorrect payment amount");

        uint256 tokenId = _nextTokenId;

        // Mint
        _safeMint(msg.sender, tokenId);
        _setTokenURI(tokenId, uri);

        // Initialize KEEP token data
        lastClaimTime[tokenId] = block.timestamp;
        mintingRate[tokenId] = DEFAULT_RATE;

        _nextTokenId++;

        emit TavernKeeperMintedWithSignature(msg.sender, tokenId, amount, nonces[msg.sender] - 1);
        return tokenId;
    }

    function safeMint(address to, string memory uri) public onlyOwner returns (uint256) {
        uint256 tokenId = _nextTokenId++;
        _safeMint(to, tokenId);
        _setTokenURI(tokenId, uri);

        // Initialize KEEP token data
        lastClaimTime[tokenId] = block.timestamp;
        mintingRate[tokenId] = DEFAULT_RATE;

        return tokenId;
    }

    function claimTokens(uint256 tokenId) public {
        require(ownerOf(tokenId) == msg.sender, "Not token owner");
        require(keepToken != address(0), "KeepToken not set");

        uint256 pending = calculatePendingTokens(tokenId);
        require(pending > 0, "No tokens pending");

        lastClaimTime[tokenId] = block.timestamp;

        // Call mint on KeepToken contract
        // We use a low-level call or interface here. Let's use interface.
        IKeepToken(keepToken).mint(msg.sender, pending);

        emit TokensClaimed(tokenId, pending);
    }

    function calculatePendingTokens(uint256 tokenId) public view returns (uint256) {
        if (lastClaimTime[tokenId] == 0) return 0;

        uint256 timeElapsed = block.timestamp - lastClaimTime[tokenId];
        return timeElapsed * mintingRate[tokenId];
    }

    // The following functions are overrides required by Solidity.

    // The following functions are overrides required by Solidity.

    function tokenURI(uint256 tokenId)
        public
        view
        override(ERC721Upgradeable, ERC721URIStorageUpgradeable)
        returns (string memory)
    {
        return super.tokenURI(tokenId);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721Upgradeable, ERC721URIStorageUpgradeable)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    // --- The Office (King of the Hill) Mechanics ---
    // Deprecated legacy storage (kept for slot alignment)
    // DO NOT REMOVE OR RENAME
    address private currentKing;
    uint256 private currentPrice;
    uint256 private kingSince;
    uint256 private officeRate;

    // New Storage (Donut Miner Port)
    struct Slot0 {
        uint8 locked;
        uint16 epochId;
        uint192 initPrice;
        uint40 startTime;
        uint256 dps;
        address miner; // The King
        string uri;    // The Message
    }

    Slot0 public slot0;
    address public treasury;

    // Constants
    uint256 public constant FEE = 2_000; // 20%
    uint256 public constant DIVISOR = 10_000;
    uint256 public constant PRECISION = 1e18;
    uint256 public constant EPOCH_PERIOD = 1 hours;
    uint256 public constant PRICE_MULTIPLIER = 2e18; // 2x (Matched reference)
    uint256 public constant NEW_PRICE_MULTIPLIER = 2e18; // Deprecated/Alias for clarity if needed, but using PRICE_MULTIPLIER in logic

    uint256 public constant MIN_INIT_PRICE = 1 ether; // 1 MON
    uint256 public constant ABS_MAX_INIT_PRICE = type(uint192).max;

    uint256 public constant INITIAL_DPS = 4 ether; // 4 KEEP per second (Matched reference)
    uint256 public constant HALVING_PERIOD = 30 days;
    uint256 public constant TAIL_DPS = 0.01 ether;

    event OfficeTaken(address indexed newKing, uint256 newPrice, uint256 paidAmount, string uri);
    event OfficeEarningsClaimed(address indexed king, uint256 amount);
    event TreasuryFee(address indexed treasury, uint256 amount);
    event PreviousKingPaid(address indexed prevKing, uint256 amount);

    error Reentrancy();
    error Expired();
    error EpochIdMismatch();
    error MaxPriceExceeded();
    error InvalidTreasury();

    modifier nonReentrant() {
        if (slot0.locked == 2) revert Reentrancy();
        slot0.locked = 2;
        _;
        slot0.locked = 1;
    }

    modifier nonReentrantView() {
        if (slot0.locked == 2) revert Reentrancy();
        _;
    }

    uint256 public v2StartTime;

    function initializeOfficeV2(address _treasury) public onlyOwner {
        require(treasury == address(0), "Already initialized V2");
        treasury = _treasury;
        v2StartTime = block.timestamp;

        slot0.initPrice = uint192(MIN_INIT_PRICE);
        slot0.startTime = uint40(block.timestamp);
        slot0.miner = msg.sender; // Initial king is owner
        slot0.dps = INITIAL_DPS;
        slot0.epochId = 1;
    }

    function setTreasury(address _treasury) external onlyOwner {
        require(_treasury != address(0), "Invalid treasury");
        treasury = _treasury;
        emit TreasuryFee(_treasury, 0); // Emit event to log change (using 0 amount)
    }

    // ... (takeOffice remains same) ...

    function _getDpsFromTime(uint256 time) internal view returns (uint256 dps) {
        if (v2StartTime == 0) return INITIAL_DPS;
        uint256 halvings = time <= v2StartTime ? 0 : (time - v2StartTime) / HALVING_PERIOD;
        dps = INITIAL_DPS >> halvings;
        if (dps < TAIL_DPS) dps = TAIL_DPS;
        return dps;
    }

    function takeOffice(
        uint256 epochId,
        uint256 deadline,
        uint256 maxPrice,
        string memory uri
    ) public payable nonReentrant returns (uint256 price) {
        if (block.timestamp > deadline) revert Expired();

        Slot0 memory slot0Cache = slot0;

        // Allow epochId 0 to match current if passed 0, otherwise check
        if (epochId != 0 && uint16(epochId) != slot0Cache.epochId) revert EpochIdMismatch();

        price = _getPriceFromCache(slot0Cache);
        if (price > maxPrice) revert MaxPriceExceeded();
        if (msg.value < price) revert("Insufficient payment");

        // Refund excess
        uint256 excess = msg.value - price;
        if (excess > 0) {
            (bool successRefund, ) = payable(msg.sender).call{value: excess}("");
            require(successRefund, "Refund failed");
        }

        if (price > 0) {
            uint256 totalFee = price * FEE / DIVISOR; // 20%
            uint256 minerFee = price - totalFee;      // 80%

            // Split totalFee (20%) into Dev (5%) and Cellar (15%)
            uint256 devFee = totalFee / 4;
            uint256 cellarFee = totalFee - devFee;

            // Pay Dev (Owner)
            (bool successDev, ) = payable(owner()).call{value: devFee}("");
            require(successDev, "Dev transfer failed");

            // Pay Cellar (Treasury)
            if (treasury != address(0)) {
                (bool successTreasury, ) = payable(treasury).call{value: cellarFee}("");
                require(successTreasury, "Treasury transfer failed");
                emit TreasuryFee(treasury, cellarFee);
            } else {
                (bool successOwner, ) = payable(owner()).call{value: cellarFee}("");
                require(successOwner, "Owner transfer failed");
            }

            // Pay Previous King
            if (slot0Cache.miner != address(0)) {
                (bool successMiner, ) = payable(slot0Cache.miner).call{value: minerFee}("");
                require(successMiner, "Miner transfer failed");
                emit PreviousKingPaid(slot0Cache.miner, minerFee);
            }
        }

        // Calculate new init price
        uint256 newInitPrice = price * NEW_PRICE_MULTIPLIER / PRECISION;

        if (newInitPrice > ABS_MAX_INIT_PRICE) {
            newInitPrice = ABS_MAX_INIT_PRICE;
        } else if (newInitPrice < MIN_INIT_PRICE) {
            newInitPrice = MIN_INIT_PRICE;
        }

        // Mint KEEP rewards for previous king
        uint256 mineTime = block.timestamp - slot0Cache.startTime;
        uint256 minedAmount = mineTime * slot0Cache.dps;

        if (keepToken != address(0) && slot0Cache.miner != address(0)) {
            IKeepToken(keepToken).mint(slot0Cache.miner, minedAmount);
            emit OfficeEarningsClaimed(slot0Cache.miner, minedAmount);
        }

        // Update State
        unchecked {
            slot0Cache.epochId++;
        }
        slot0Cache.initPrice = uint192(newInitPrice);
        slot0Cache.startTime = uint40(block.timestamp);
        slot0Cache.miner = msg.sender;
        slot0Cache.dps = _getDpsFromTime(block.timestamp);
        slot0Cache.uri = uri;

        slot0 = slot0Cache;

        emit OfficeTaken(msg.sender, price, price, uri);

        return price;
    }

    function _getPriceFromCache(Slot0 memory slot0Cache) internal view returns (uint256) {
        uint256 timePassed = block.timestamp - slot0Cache.startTime;

        if (timePassed > EPOCH_PERIOD) {
            return MIN_INIT_PRICE;
        }

        uint256 calculatedPrice = slot0Cache.initPrice - slot0Cache.initPrice * timePassed / EPOCH_PERIOD;
        return calculatedPrice < MIN_INIT_PRICE ? MIN_INIT_PRICE : calculatedPrice;
    }



    function getPrice() external view nonReentrantView returns (uint256) {
        return _getPriceFromCache(slot0);
    }

    function getDps() external view nonReentrantView returns (uint256) {
        return slot0.dps;
    }

    function getSlot0() external view nonReentrantView returns (Slot0 memory) {
        return slot0;
    }

    function claimOfficeRewards() public nonReentrant {
        Slot0 memory slot0Cache = slot0;
        require(msg.sender == slot0Cache.miner, "Not current king");
        require(keepToken != address(0), "KeepToken not set");

        uint256 mineTime = block.timestamp - slot0Cache.startTime;
        require(mineTime > 0, "No time passed");

        uint256 minedAmount = mineTime * slot0Cache.dps;
        require(minedAmount > 0, "No rewards");

        // Reset start time to now (claiming resets the timer)
        slot0Cache.startTime = uint40(block.timestamp);
        slot0 = slot0Cache;

        IKeepToken(keepToken).mint(msg.sender, minedAmount);
        emit OfficeEarningsClaimed(msg.sender, minedAmount);
    }

    function getPendingOfficeRewards() external view returns (uint256) {
        Slot0 memory slot0Cache = slot0;
        uint256 mineTime = block.timestamp - slot0Cache.startTime;

        if (mineTime <= 0) return 0;

        return mineTime * slot0Cache.dps;
    }

    function getTokensOfOwner(address owner) external view returns (uint256[] memory) {
        uint256 tokenCount = balanceOf(owner);
        uint256[] memory tokenIds = new uint256[](tokenCount);
        uint256 currentIndex = 0;
        uint256 currentId = 1;

        while (currentIndex < tokenCount && currentId < _nextTokenId) {
            if (_ownerOf(currentId) == owner) {
                tokenIds[currentIndex] = currentId;
                currentIndex++;
            }
            currentId++;
        }
        return tokenIds;
    }
}

interface IKeepToken {
    function mint(address to, uint256 amount) external;
}

