// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Clones} from "@openzeppelin/contracts/proxy/Clones.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {PactPot} from "./PactPot.sol";

/// @title PactFactory — deploys threshold-conditional group pots as EIP-1167 clones
/// @notice Cheap pot creation keeps micro-commits ($5–$50 shares) viable on Monad.
contract PactFactory is Ownable {
    using Clones for address;

    address public immutable implementation;

    uint256 public constant MAX_FEE_BPS = 500; // 5%
    uint256 public feeBps = 100; // 1% default
    address public feeRecipient;

    uint256 public constant MIN_PARTY = 2;
    uint256 public constant MAX_PARTY = 100;
    uint256 public constant MIN_DURATION = 1 hours;
    uint256 public constant MAX_DURATION = 90 days;
    uint256 public constant MAX_TITLE = 120;

    address[] public allPots;
    mapping(address => address[]) public potsByOrganizer;

    event PotCreated(
        address indexed pot,
        address indexed organizer,
        address indexed payee,
        address token,
        uint256 perPerson,
        uint256 partySize,
        uint256 deadline,
        string title,
        bool isPrivate
    );
    event FeeUpdated(uint256 feeBps, address feeRecipient);

    error BadParams();

    constructor(address feeRecipient_) Ownable(msg.sender) {
        implementation = address(new PactPot());
        feeRecipient = feeRecipient_ == address(0) ? msg.sender : feeRecipient_;
    }

    function setFee(uint256 feeBps_, address feeRecipient_) external onlyOwner {
        if (feeBps_ > MAX_FEE_BPS) revert BadParams();
        if (feeRecipient_ == address(0)) revert BadParams();
        feeBps = feeBps_;
        feeRecipient = feeRecipient_;
        emit FeeUpdated(feeBps_, feeRecipient_);
    }

    /// @notice Public pot (backwards compatible). Private pots use createPot with flags.
    function createPot(
        address token,
        uint256 perPerson,
        uint256 partySize,
        uint256 deadline,
        address payee,
        string calldata title
    ) external returns (address pot) {
        return _create(token, perPerson, partySize, deadline, payee, title, false, bytes32(0));
    }

    /// @notice Create a pot with visibility. Private pots require a secret hash;
    ///         joiners prove the preimage (carried in the share link fragment).
    function createPot(
        address token,
        uint256 perPerson,
        uint256 partySize,
        uint256 deadline,
        address payee,
        string calldata title,
        bool isPrivate,
        bytes32 secretHash
    ) external returns (address pot) {
        return _create(token, perPerson, partySize, deadline, payee, title, isPrivate, secretHash);
    }

    function _create(
        address token,
        uint256 perPerson,
        uint256 partySize,
        uint256 deadline,
        address payee,
        string calldata title,
        bool isPrivate,
        bytes32 secretHash
    ) internal returns (address pot) {
        if (perPerson == 0) revert BadParams();
        if (partySize < MIN_PARTY || partySize > MAX_PARTY) revert BadParams();
        if (deadline <= block.timestamp + MIN_DURATION) revert BadParams();
        if (deadline > block.timestamp + MAX_DURATION) revert BadParams();
        if (payee == address(0)) revert BadParams();
        if (bytes(title).length == 0 || bytes(title).length > MAX_TITLE) revert BadParams();
        if (isPrivate && secretHash == bytes32(0)) revert BadParams();
        if (!isPrivate && secretHash != bytes32(0)) revert BadParams();

        pot = implementation.clone();
        PactPot(pot).initialize(
            msg.sender, payee, token, perPerson, partySize, deadline, title, isPrivate, secretHash
        );

        allPots.push(pot);
        potsByOrganizer[msg.sender].push(pot);

        emit PotCreated(pot, msg.sender, payee, token, perPerson, partySize, deadline, title, isPrivate);
    }

    function potCount() external view returns (uint256) {
        return allPots.length;
    }
}
