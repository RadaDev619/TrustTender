# Smart Contract Reference

Contract: `EGPTrustAuditLog`

Path: `contracts/contracts/EGPTrustAuditLog.sol`

Compiler: Solidity `^0.8.20`

The contract is an event-only audit proof log. It does not store confidential proposal files or plaintext procurement data.

## Deployment

Constructor:

```solidity
constructor(address initialRelayer)
```

If `initialRelayer` is not the zero address, it is authorized during deployment.

Local deployment:

```powershell
cd D:\2026\TenderTrust\contracts
npx hardhat node
```

In another terminal:

```powershell
cd D:\2026\TenderTrust\contracts
$env:RELAYER_ADDRESS="<relayer-account-address>"
npm run deploy:local
```

## Access Control

| Item | Description |
| --- | --- |
| `owner` | Account that can transfer ownership and authorize relayers |
| `authorizedRelayers` | Mapping of accounts allowed to write audit events |
| `onlyOwner` | Restricts owner functions |
| `onlyAuthorizedRelayer` | Restricts all proof recording functions |

Users never call this contract directly in the MVP. The backend relayer signs transactions.

## Owner Functions

### `transferOwnership`

```solidity
function transferOwnership(address newOwner) external onlyOwner
```

Transfers ownership. Reverts with `ZeroAddress` if `newOwner` is zero.

### `setRelayer`

```solidity
function setRelayer(address relayer, bool authorized) external onlyOwner
```

Adds or removes an authorized relayer. Emits `RelayerAuthorizationUpdated`.

## Proof Recording Functions

All proof functions:

- require an authorized relayer
- reject zero `bytes32` values
- emit an event with `block.timestamp`
- avoid arrays and long-term storage writes

### `recordTenderCreated`

```solidity
function recordTenderCreated(
    bytes32 tenderId,
    bytes32 tenderHash,
    bytes32 actorHash
) external onlyAuthorizedRelayer
```

Emits `TenderCreated`.

### `recordTenderPublished`

```solidity
function recordTenderPublished(
    bytes32 tenderId,
    bytes32 approvalHash,
    bytes32 actorHash
) external onlyAuthorizedRelayer
```

Emits `TenderPublished`.

### `recordProposalSubmitted`

```solidity
function recordProposalSubmitted(
    bytes32 tenderId,
    bytes32 proposalId,
    bytes32 proposalManifestHash,
    bytes32 vendorHash
) external onlyAuthorizedRelayer
```

Emits `ProposalSubmitted`.

### `recordStageChanged`

```solidity
function recordStageChanged(
    bytes32 tenderId,
    bytes32 stageHash,
    bytes32 actorHash
) external onlyAuthorizedRelayer
```

Emits `TenderStageChanged`.

### `recordEvaluationSigned`

```solidity
function recordEvaluationSigned(
    bytes32 tenderId,
    bytes32 proposalId,
    bytes32 evaluationHash,
    bytes32 evaluatorHash
) external onlyAuthorizedRelayer
```

Emits `EvaluationSigned`.

### `recordBoardVote`

```solidity
function recordBoardVote(
    bytes32 tenderId,
    bytes32 proposalId,
    bytes32 voteHash,
    bytes32 boardMemberHash
) external onlyAuthorizedRelayer
```

Emits `BoardVoteRecorded`.

### `recordAwardDeclared`

```solidity
function recordAwardDeclared(
    bytes32 tenderId,
    bytes32 winningProposalId,
    bytes32 awardHash,
    bytes32 actorHash
) external onlyAuthorizedRelayer
```

Emits `AwardDeclared`.

## Events

| Event | Indexed fields | Purpose |
| --- | --- | --- |
| `OwnershipTransferred` | `previousOwner`, `newOwner` | Owner audit |
| `RelayerAuthorizationUpdated` | `relayer` | Relayer access audit |
| `TenderCreated` | `tenderId`, `actorHash` | Tender creation proof |
| `TenderPublished` | `tenderId`, `actorHash` | Publish proof |
| `ProposalSubmitted` | `tenderId`, `proposalId`, `vendorHash` | Proposal manifest proof |
| `TenderStageChanged` | `tenderId`, `actorHash` | Lifecycle transition proof |
| `EvaluationSigned` | `tenderId`, `proposalId`, `evaluatorHash` | Evaluator signature proof |
| `BoardVoteRecorded` | `tenderId`, `proposalId`, `boardMemberHash` | Board vote proof |
| `AwardDeclared` | `tenderId`, `winningProposalId`, `actorHash` | Award decision proof |

## Custom Errors

| Error | Trigger |
| --- | --- |
| `UnauthorizedOwner(address caller)` | Non-owner calls owner-only function |
| `UnauthorizedRelayer(address caller)` | Non-relayer calls proof function |
| `ZeroAddress()` | Owner or relayer address is zero |
| `ZeroValue()` | Required `bytes32` proof field is zero |

## Test Coverage

Hardhat tests cover:

- initial relayer authorization
- owner-managed relayer authorization
- blocked writes from non-relayer accounts
- tender and proposal event emission
- lifecycle, evaluation, vote, and award event emission
- zero hash rejection

Run:

```powershell
cd D:\2026\TenderTrust\contracts
npm test
```

## On-Chain Data Policy

Allowed on-chain:

- hashes
- timestamps
- proposal IDs
- tender IDs
- stage proof hashes
- actor identity hashes
- vote and award proof hashes

Not allowed on-chain:

- plaintext proposal content
- encrypted files or blobs
- encryption keys
- raw employment IDs
- evaluator comments in plaintext
- vendor commercial details
