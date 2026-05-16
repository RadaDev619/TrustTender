# API Reference

The MVP uses Next.js route handlers as backend APIs. Most APIs call backend TypeScript services in `backend/src`.

All mutating procurement and audit endpoints expect a `mockNdiSession` object in the JSON body. The frontend adds this automatically through the demo user switcher.

## Common Response Shape

Successful responses include:

```json
{
  "ok": true,
  "message": "Action completed.",
  "receipt": {
    "txHash": "0x..."
  }
}
```

Failed responses include:

```json
{
  "ok": false,
  "code": "RBAC_FORBIDDEN",
  "message": "Action blocked: VENDOR does not have CREATE_TENDER.",
  "details": {}
}
```

Common error codes:

| Code | Meaning |
| --- | --- |
| `MOCK_NDI_SESSION_REQUIRED` | Request did not include a demo identity session |
| `MOCK_NDI_SESSION_INVALID` | Session does not match a known mock NDI user |
| `RBAC_FORBIDDEN` | Role does not have the required permission |
| `INVALID_TENDER_STATE` | Tender is not in the required lifecycle state |
| `PROPOSAL_DEADLINE_PASSED` | Vendor submitted after deadline |
| `EVALUATION_SIGNATURES_INCOMPLETE` | Forward to board attempted before 4 of 4 signatures |
| `BOARD_VOTES_INCOMPLETE` | Award declaration attempted before all board votes |
| `RELAYER_CONFIGURATION_ERROR` | Real relayer mode is missing required environment variables |

## Procurement Workflow APIs

### Create Tender

`POST /api/tenders`

Required role: `PROCUREMENT_OFFICER`

Body:

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `mockNdiSession` | object | yes | Current mock NDI session |
| `id` | string | no | If omitted, backend generates an ID |
| `title` | string | yes | Tender title |
| `description` | string | yes | Tender description |
| `deadline` | string | yes | ISO timestamp |
| `tenderHash` | string | no | If omitted, backend hashes canonical tender data |
| `evaluatorIds` | string[] | no | Defaults to four seeded evaluators |
| `boardMemberIds` | string[] | no | Defaults to three seeded board members |

Creates a `DRAFT` tender and records `TenderCreated`.

### Publish Tender

`POST /api/tenders/{tenderId}/publish`

Required role: `PROCUREMENT_OFFICER`

Required state: `DRAFT`

Body:

| Field | Type | Required |
| --- | --- | --- |
| `mockNdiSession` | object | yes |

Moves the tender to `OPEN` and records a stage change.

### Submit Proposal

`POST /api/tenders/{tenderId}/proposals`

Required role: `VENDOR`

Required state: `OPEN`

Deadline rule: current time must be before `tender.deadline`.

Body:

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `mockNdiSession` | object | yes | Vendor session |
| `proposalId` | string | no | If omitted, backend generates an ID |
| `proposalManifestHash` | string | yes | Hash of all encrypted section envelopes |
| `envelopes` | array | yes | Exactly four encrypted envelopes |

Envelope fields:

| Field | Type | Required |
| --- | --- | --- |
| `sectionType` | string | yes, one of `eligibility`, `technical`, `financial`, `supporting` |
| `encryptedBlobRef` | string | yes |
| `iv` | string | yes |
| `encryptedHash` | string | yes |
| `keyRef` | string | yes |
| `locked` | boolean | no, defaults to `true` |

Plaintext fields such as `plaintext`, `proposalContent`, `decryptedContent`, `rawContent`, and `fileContent` are rejected.

### Close Tender

`POST /api/tenders/{tenderId}/close`

Required role: `PROCUREMENT_OFFICER`

Required state: `OPEN`

Deadline rule: current time must be after `tender.deadline`.

Records a stage change and moves the tender to `CLOSED`.

### Start Evaluation

`POST /api/tenders/{tenderId}/evaluation/start`

Required role: `PROCUREMENT_OFFICER`

Required state: `CLOSED`

Requires exactly four assigned evaluators. Moves the tender to `EVALUATION`.

### Submit Evaluation Signature

`POST /api/tenders/{tenderId}/evaluation/signatures`

Required role: `EVALUATOR`

Required state: `EVALUATION`

Each evaluator can sign only once.

Body:

| Field | Type | Required |
| --- | --- | --- |
| `mockNdiSession` | object | yes |
| `proposalId` | string | yes |
| `recommendation` | string | yes |
| `commentHash` | string | yes |
| `signatureHash` | string | no |

Records `EvaluationSigned` through the relayer.

### Forward To Board

`POST /api/tenders/{tenderId}/board/forward`

Required role: `PROCUREMENT_OFFICER`

Required state: `EVALUATION`

Requires all four evaluator signatures. Moves the tender to `BOARD_VOTING`.

### Submit Board Vote

`POST /api/tenders/{tenderId}/board/votes`

Required role: `BOARD_MEMBER`

Required state: `BOARD_VOTING`

Each board member can vote only once.

Body:

| Field | Type | Required |
| --- | --- | --- |
| `mockNdiSession` | object | yes |
| `proposalId` | string | yes |
| `voteHash` | string | no |

Records `BoardVoteRecorded` through the relayer.

### Declare Award

`POST /api/tenders/{tenderId}/award`

Required role: `PROCUREMENT_OFFICER`

Required state: `BOARD_VOTING`

Requires all assigned board members to vote and a majority winner to exist.

Body:

| Field | Type | Required |
| --- | --- | --- |
| `mockNdiSession` | object | yes |
| `winningProposalId` | string | no, backend uses majority winner |
| `finalVoteSummaryHash` | string | no |
| `awardDecisionHash` | string | no |

Moves the tender to `AWARDED` and records `AwardDeclared`.

### Fetch Public Audit Trail

`GET /api/tenders/{tenderId}/audit`

No proposal plaintext is returned.

Response includes:

- tender hash and status
- proposal manifest hashes
- encrypted section hashes
- evaluation signature hashes
- board vote hashes
- award proof
- audit events

Response excludes:

- `encryptedBlobRef`
- `iv`
- `keyRef`
- plaintext proposal content

## Audit Relayer APIs

These endpoints validate mock NDI role and actor hash before calling the ethers.js relayer.

| Endpoint | Required permission | Required hashes |
| --- | --- | --- |
| `POST /api/audit/tender-created` | `CREATE_TENDER` | `tenderId`, `tenderHash`, `actorHash` |
| `POST /api/audit/proposal-submitted` | `SUBMIT_PROPOSAL` | `tenderId`, `proposalId`, `proposalManifestHash`, `vendorHash` |
| `POST /api/audit/stage-changed` | supplied `requiredPermission` | `tenderId`, `stageHash`, `actorHash` |
| `POST /api/audit/evaluation-signed` | `SIGN_EVALUATION` | `tenderId`, `proposalId`, `evaluationHash`, `evaluatorHash` |
| `POST /api/audit/board-vote` | `CAST_BOARD_VOTE` | `tenderId`, `proposalId`, `voteHash`, `boardMemberHash` |
| `POST /api/audit/award-declared` | `DECLARE_AWARD` | `tenderId`, `winningProposalId`, `awardHash`, `actorHash` |

Successful response:

```json
{
  "ok": true,
  "status": "MOCK_CONFIRMED",
  "txHash": "0x...",
  "contractAddress": "0x...",
  "relayerAddress": "0x...",
  "chain": "Mock backend relayer",
  "metadataHash": "0x...",
  "message": "Mock Ethereum proof recorded by backend relayer."
}
```

## UI Helper Relayer APIs

The app also contains helper endpoints under `/api/relayer/*` for local demo proof cards:

| Endpoint | Purpose |
| --- | --- |
| `POST /api/relayer/proposal-proof` | Returns deterministic mock proposal proof |
| `POST /api/relayer/evaluation-signature` | Returns deterministic mock evaluation proof |
| `POST /api/relayer/board-vote` | Returns deterministic mock board vote proof |
| `POST /api/relayer/award-decision` | Returns deterministic mock award proof |

For production hardening, consolidate these helper endpoints behind the same backend relayer validation path used by `/api/audit/*`.
