// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title EGPTrustAuditLog
/// @notice Event-only audit proof contract for the eGP Trust Layer MVP.
/// @dev Confidential proposal files and plaintext procurement data must stay off-chain.
contract EGPTrustAuditLog {
    address public owner;

    mapping(address relayer => bool authorized) public authorizedRelayers;

    error UnauthorizedOwner(address caller);
    error UnauthorizedRelayer(address caller);
    error ZeroAddress();
    error ZeroValue();

    event OwnershipTransferred(
        address indexed previousOwner,
        address indexed newOwner
    );

    event RelayerAuthorizationUpdated(
        address indexed relayer,
        bool authorized
    );

    event TenderCreated(
        bytes32 indexed tenderId,
        bytes32 tenderHash,
        bytes32 indexed actorHash,
        uint256 timestamp
    );

    event TenderPublished(
        bytes32 indexed tenderId,
        bytes32 approvalHash,
        bytes32 indexed actorHash,
        uint256 timestamp
    );

    event ProposalSubmitted(
        bytes32 indexed tenderId,
        bytes32 indexed proposalId,
        bytes32 proposalManifestHash,
        bytes32 indexed vendorHash,
        uint256 timestamp
    );

    event TenderStageChanged(
        bytes32 indexed tenderId,
        bytes32 stageHash,
        bytes32 indexed actorHash,
        uint256 timestamp
    );

    event EvaluationSigned(
        bytes32 indexed tenderId,
        bytes32 indexed proposalId,
        bytes32 evaluationHash,
        bytes32 indexed evaluatorHash,
        uint256 timestamp
    );

    event BoardVoteRecorded(
        bytes32 indexed tenderId,
        bytes32 indexed proposalId,
        bytes32 voteHash,
        bytes32 indexed boardMemberHash,
        uint256 timestamp
    );

    event AwardDeclared(
        bytes32 indexed tenderId,
        bytes32 indexed winningProposalId,
        bytes32 awardHash,
        bytes32 indexed actorHash,
        uint256 timestamp
    );

    modifier onlyOwner() {
        if (msg.sender != owner) revert UnauthorizedOwner(msg.sender);
        _;
    }

    modifier onlyAuthorizedRelayer() {
        if (!authorizedRelayers[msg.sender]) {
            revert UnauthorizedRelayer(msg.sender);
        }
        _;
    }

    constructor(address initialRelayer) {
        owner = msg.sender;
        emit OwnershipTransferred(address(0), msg.sender);

        if (initialRelayer != address(0)) {
            authorizedRelayers[initialRelayer] = true;
            emit RelayerAuthorizationUpdated(initialRelayer, true);
        }
    }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();

        address previousOwner = owner;
        owner = newOwner;
        emit OwnershipTransferred(previousOwner, newOwner);
    }

    function setRelayer(
        address relayer,
        bool authorized
    ) external onlyOwner {
        if (relayer == address(0)) revert ZeroAddress();

        authorizedRelayers[relayer] = authorized;
        emit RelayerAuthorizationUpdated(relayer, authorized);
    }

    function recordTenderCreated(
        bytes32 tenderId,
        bytes32 tenderHash,
        bytes32 actorHash
    ) external onlyAuthorizedRelayer {
        _requireNonZero(tenderId);
        _requireNonZero(tenderHash);
        _requireNonZero(actorHash);

        emit TenderCreated(tenderId, tenderHash, actorHash, block.timestamp);
    }

    function recordTenderPublished(
        bytes32 tenderId,
        bytes32 approvalHash,
        bytes32 actorHash
    ) external onlyAuthorizedRelayer {
        _requireNonZero(tenderId);
        _requireNonZero(approvalHash);
        _requireNonZero(actorHash);

        emit TenderPublished(tenderId, approvalHash, actorHash, block.timestamp);
    }

    function recordProposalSubmitted(
        bytes32 tenderId,
        bytes32 proposalId,
        bytes32 proposalManifestHash,
        bytes32 vendorHash
    ) external onlyAuthorizedRelayer {
        _requireNonZero(tenderId);
        _requireNonZero(proposalId);
        _requireNonZero(proposalManifestHash);
        _requireNonZero(vendorHash);

        emit ProposalSubmitted(
            tenderId,
            proposalId,
            proposalManifestHash,
            vendorHash,
            block.timestamp
        );
    }

    function recordStageChanged(
        bytes32 tenderId,
        bytes32 stageHash,
        bytes32 actorHash
    ) external onlyAuthorizedRelayer {
        _requireNonZero(tenderId);
        _requireNonZero(stageHash);
        _requireNonZero(actorHash);

        emit TenderStageChanged(tenderId, stageHash, actorHash, block.timestamp);
    }

    function recordEvaluationSigned(
        bytes32 tenderId,
        bytes32 proposalId,
        bytes32 evaluationHash,
        bytes32 evaluatorHash
    ) external onlyAuthorizedRelayer {
        _requireNonZero(tenderId);
        _requireNonZero(proposalId);
        _requireNonZero(evaluationHash);
        _requireNonZero(evaluatorHash);

        emit EvaluationSigned(
            tenderId,
            proposalId,
            evaluationHash,
            evaluatorHash,
            block.timestamp
        );
    }

    function recordBoardVote(
        bytes32 tenderId,
        bytes32 proposalId,
        bytes32 voteHash,
        bytes32 boardMemberHash
    ) external onlyAuthorizedRelayer {
        _requireNonZero(tenderId);
        _requireNonZero(proposalId);
        _requireNonZero(voteHash);
        _requireNonZero(boardMemberHash);

        emit BoardVoteRecorded(
            tenderId,
            proposalId,
            voteHash,
            boardMemberHash,
            block.timestamp
        );
    }

    function recordAwardDeclared(
        bytes32 tenderId,
        bytes32 winningProposalId,
        bytes32 awardHash,
        bytes32 actorHash
    ) external onlyAuthorizedRelayer {
        _requireNonZero(tenderId);
        _requireNonZero(winningProposalId);
        _requireNonZero(awardHash);
        _requireNonZero(actorHash);

        emit AwardDeclared(
            tenderId,
            winningProposalId,
            awardHash,
            actorHash,
            block.timestamp
        );
    }

    function _requireNonZero(bytes32 value) private pure {
        if (value == bytes32(0)) revert ZeroValue();
    }
}
