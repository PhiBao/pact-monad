// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title PactPot — threshold-conditional group escrow ("no tilt, no charge")
/// @notice One commit per address. Funds release to payee only when full.
///         Otherwise contributors pull refunds after the deadline.
/// @dev Deployed as EIP-1167 clone via PactFactory. No owner powers on the pot.
interface IPactFactory {
    function feeBps() external view returns (uint256);
    function feeRecipient() external view returns (address);
}

contract PactPot is ReentrancyGuard {
    using SafeERC20 for IERC20;

    enum State {
        Open,
        Tilted,
        Refunding
    }

    string public title;
    bool public isPrivate;
    bytes32 public secretHash; // keccak256(secret); zero for public pots
    address public factory;
    address public organizer;
    address public payee;
    address public token; // address(0) = native MON
    uint256 public perPerson;
    uint256 public partySize;
    uint256 public deadline;
    State public state;

    uint256 public commitCount;
    mapping(address => bool) public committed;
    mapping(address => bool) public refunded;
    address[] private _contributors;

    event Committed(address indexed pot, address indexed user, uint256 index);
    event Tilted(address indexed pot, uint256 total);
    event RefundingOpened(address indexed pot);
    event Refunded(address indexed pot, address indexed user, uint256 amount);
    event SecretRotated(address indexed pot);

    error AlreadyInitialized();
    error NotFactory();
    error NotOpen();
    error Expired();
    error NotExpired();
    error AlreadyCommitted();
    error WrongValue();
    error NotFull();
    error NotRefunding();
    error NothingToRefund();
    error TransferFailed();
    error PrivateUseSecret();
    error BadSecret();
    error NotOrganizer();
    error NotPrivate();

    bool private _initialized;

    /// @dev Locks the implementation contract itself; clones get fresh storage.
    constructor() {
        _initialized = true;
    }

    /// @dev Called once by the factory clone. Payee receives funds on tilt.
    function initialize(
        address organizer_,
        address payee_,
        address token_,
        uint256 perPerson_,
        uint256 partySize_,
        uint256 deadline_,
        string calldata title_,
        bool isPrivate_,
        bytes32 secretHash_
    ) external {
        if (_initialized) revert AlreadyInitialized();
        _initialized = true;
        title = title_;
        isPrivate = isPrivate_;
        secretHash = secretHash_;
        factory = msg.sender;
        organizer = organizer_;
        payee = payee_;
        token = token_;
        perPerson = perPerson_;
        partySize = partySize_;
        deadline = deadline_;
        state = State.Open;
    }

    /// @notice Commit one share. Native: send exact perPerson. ERC20: approve first.
    /// @dev Reverts on private pots — join via commitWithSecret instead.
    function commit() external payable nonReentrant {
        if (isPrivate) revert PrivateUseSecret();
        _commit();
    }

    /// @notice Join a private pot by proving the invite secret (in the share link).
    function commitWithSecret(bytes calldata secret) external payable nonReentrant {
        if (!isPrivate) {
            _commit();
            return;
        }
        if (secret.length == 0 || keccak256(secret) != secretHash) revert BadSecret();
        _commit();
    }

    function _commit() internal {
        if (state != State.Open) revert NotOpen();
        if (block.timestamp >= deadline) revert Expired();
        if (committed[msg.sender]) revert AlreadyCommitted();
        if (commitCount >= partySize) revert NotFull();

        if (token == address(0)) {
            if (msg.value != perPerson) revert WrongValue();
        } else {
            if (msg.value != 0) revert WrongValue();
            IERC20(token).safeTransferFrom(msg.sender, address(this), perPerson);
        }

        committed[msg.sender] = true;
        _contributors.push(msg.sender);
        uint256 index = commitCount;
        commitCount = index + 1;

        emit Committed(address(this), msg.sender, index);
    }

    /// @notice Replace the invite secret (organizer only). Committed funds are
    ///         untouched; only future joins use the new key. Recovery path when
    ///         the old link is lost or leaked.
    function rotateSecret(bytes32 newHash) external {
        if (msg.sender != organizer) revert NotOrganizer();
        if (!isPrivate) revert NotPrivate();
        if (newHash == bytes32(0)) revert BadSecret();
        secretHash = newHash;
        emit SecretRotated(address(this));
    }

    /// @notice Release all funds to payee once full. Permissionless (anyone may trigger).
    /// @dev Fee is read from the factory onchain — callers cannot waive it.
    function release() external nonReentrant {
        if (state != State.Open) revert NotOpen();
        if (commitCount < partySize) revert NotFull();

        state = State.Tilted;
        uint256 feeBps = IPactFactory(factory).feeBps();
        address feeRecipient = IPactFactory(factory).feeRecipient();
        uint256 total = perPerson * partySize;
        uint256 fee = (total * feeBps) / 10_000;

        emit Tilted(address(this), total);

        if (token == address(0)) {
            if (fee > 0) {
                (bool okFee,) = feeRecipient.call{value: fee}("");
                if (!okFee) revert TransferFailed();
            }
            (bool ok,) = payee.call{value: total - fee}("");
            if (!ok) revert TransferFailed();
        } else {
            if (fee > 0) IERC20(token).safeTransfer(feeRecipient, fee);
            IERC20(token).safeTransfer(payee, total - fee);
        }
    }

    /// @notice Open the refund window after deadline when the pot never filled.
    function expire() external {
        if (state != State.Open) revert NotOpen();
        if (block.timestamp < deadline) revert NotExpired();
        if (commitCount >= partySize) revert NotFull();
        state = State.Refunding;
        emit RefundingOpened(address(this));
    }

    /// @notice Pull refund. Each contributor withdraws their own share.
    function refund() external nonReentrant {
        if (state != State.Refunding) revert NotRefunding();
        if (!committed[msg.sender]) revert NothingToRefund();
        if (refunded[msg.sender]) revert NothingToRefund();

        refunded[msg.sender] = true;
        emit Refunded(address(this), msg.sender, perPerson);

        if (token == address(0)) {
            (bool ok,) = msg.sender.call{value: perPerson}("");
            if (!ok) revert TransferFailed();
        } else {
            IERC20(token).safeTransfer(msg.sender, perPerson);
        }
    }

    function contributors() external view returns (address[] memory) {
        return _contributors;
    }

    function totalLocked() external view returns (uint256) {
        if (state == State.Tilted) return 0;
        return perPerson * commitCount;
    }
}
