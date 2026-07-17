// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

/// Arbor escrow vault (matches lib/blockchain/abi/arborVault.ts exactly).
/// - deposit(): user pays USDC for a time package; orderId links the on-chain
///   payment to the DB purchase row (bytes32 from a UUID).
/// - releaseBatch(): owner (server settlement signer) pays filmmakers their
///   accrued USDC share in one batch.
/// Custom error names mirror OpenZeppelin v5 so the frontend ABI decodes them.
contract ArborSettlement {
    IERC20 public immutable USDC;

    address public owner;
    bool public paused;
    uint256 private _reentrancy; // 0 = unlocked, 1 = locked

    uint256 public totalDeposited;
    uint256 public totalReleased;

    struct ReleaseItem {
        address wallet;
        uint256 amount;
    }

    event PaymentReceived(address indexed payer, uint256 amount, bytes32 indexed orderId);
    event CreatorPaid(bytes32 indexed settlementId, address indexed creator, uint256 amount);
    event BatchReleased(bytes32 indexed settlementId, uint256 totalAmount, uint256 totalRecipients);
    event EmergencyWithdraw(address indexed to, uint256 amount);
    event Paused(address account);
    event Unpaused(address account);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    error OwnableInvalidOwner(address owner);
    error OwnableUnauthorizedAccount(address account);
    error EnforcedPause();
    error ExpectedPause();
    error ReentrancyGuardReentrantCall();

    modifier onlyOwner() {
        if (msg.sender != owner) revert OwnableUnauthorizedAccount(msg.sender);
        _;
    }

    modifier whenNotPaused() {
        if (paused) revert EnforcedPause();
        _;
    }

    modifier nonReentrant() {
        if (_reentrancy == 1) revert ReentrancyGuardReentrantCall();
        _reentrancy = 1;
        _;
        _reentrancy = 0;
    }

    constructor(address usdc) {
        USDC = IERC20(usdc);
        owner = msg.sender;
        emit OwnershipTransferred(address(0), msg.sender);
    }

    // ── User purchase ────────────────────────────────────────────────────
    function deposit(uint256 amount, bytes32 orderId) external whenNotPaused nonReentrant {
        require(amount > 0, "zero amount");
        require(USDC.transferFrom(msg.sender, address(this), amount), "transfer failed");
        totalDeposited += amount;
        emit PaymentReceived(msg.sender, amount, orderId);
    }

    // ── Filmmaker settlement (server-signed) ─────────────────────────────
    function releaseBatch(bytes32 settlementId, ReleaseItem[] calldata items)
        external
        onlyOwner
        nonReentrant
    {
        uint256 total = 0;
        for (uint256 i = 0; i < items.length; i++) {
            require(USDC.transfer(items[i].wallet, items[i].amount), "payout failed");
            total += items[i].amount;
            emit CreatorPaid(settlementId, items[i].wallet, items[i].amount);
        }
        totalReleased += total;
        emit BatchReleased(settlementId, total, items.length);
    }

    // ── Admin ────────────────────────────────────────────────────────────
    function emergencyWithdraw(address to, uint256 amount) external onlyOwner {
        require(USDC.transfer(to, amount), "withdraw failed");
        emit EmergencyWithdraw(to, amount);
    }

    function pause() external onlyOwner {
        if (paused) revert EnforcedPause();
        paused = true;
        emit Paused(msg.sender);
    }

    function unpause() external onlyOwner {
        if (!paused) revert ExpectedPause();
        paused = false;
        emit Unpaused(msg.sender);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert OwnableInvalidOwner(address(0));
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    function renounceOwnership() external onlyOwner {
        emit OwnershipTransferred(owner, address(0));
        owner = address(0);
    }

    function contractBalance() external view returns (uint256) {
        return USDC.balanceOf(address(this));
    }
}
