---
title: eGP Trust Layer MVP Workflow
description: Step-by-step guide for the tender lifecycle, proposal locking, evaluation, board voting, award declaration, and public audit proof.
nav_title: MVP Workflow
---

This guide explains the core MVP workflow. It shows which actor performs each action, which state is required, what data is recorded, and what judges should see in the UI.

The workflow proves one thing: confidential procurement content stays off-chain and locked while critical actions are enforced by identity, role, state, and audit proof.

## Example

As an example, use tender `TT-2026-001` for evaluation, tender `TT-2026-002` for vendor submission, tender `TT-2026-004` for board voting, and tender `TT-2026-003` for an awarded record.

Start at `/dashboard`, seed demo data, then use the demo user switcher to move through roles.

### Step 1: Create and publish a tender

Login as `Karma Dorji`, the procurement officer.

The officer can create a tender because the mock NDI session maps employment identity to `PROCUREMENT_OFFICER`. The tender starts in `DRAFT`.

```text
Role: PROCUREMENT_OFFICER
Action: create tender
From state: none
To state: DRAFT
Proof: tender hash and actor identity hash
```

The next requirement is vendor submission. Vendors cannot submit while the tender is still `DRAFT`, so the officer publishes it to `OPEN`.

```text
Action: publish tender
From state: DRAFT
To state: OPEN
Proof: stage change hash
```

Observable proof: the tender detail page shows the `OPEN` badge and an Ethereum proof card.

### Step 2: Submit encrypted proposals before the deadline

Switch to `Tashi Construction` or `Druk Builders`.

The vendor can submit only when the tender is `OPEN` and the deadline has not passed. The proposal form has four sections:

- `eligibility`
- `technical`
- `financial`
- `supporting`

Each section is encrypted separately with browser Web Crypto AES-GCM. The UI shows:

- `Encrypted before storage`
- `Hash generated`
- `Submission proof ready`
- `Ethereum proof recorded`

The backend receives encrypted envelope references and hashes. It must not receive plaintext proposal content.

Observable proof: proposal cards show `Encrypted before storage` and `Locked until deadline`.

### Step 3: Close the tender and unlock evaluation

Switch back to the procurement officer after the deadline.

Before the deadline, `Close Tender` is blocked. After the deadline, the officer can move the tender from `OPEN` to `CLOSED`, then from `CLOSED` to `EVALUATION`.

```text
Action: close tender
Required role: PROCUREMENT_OFFICER
Required state: OPEN
Deadline rule: now must be after tender.deadline
```

```text
Action: start evaluation
Required role: PROCUREMENT_OFFICER
Required state: CLOSED
Required team: four assigned evaluators
```

Observable proof: the deadline panel changes from `Proposal locked until deadline` to `Evaluation unlocked`.

### Step 4: Four evaluators sign recommendations

Switch through `Evaluator 1`, `Evaluator 2`, `Evaluator 3`, and `Evaluator 4`.

Evaluators can view decrypted proposal sections only while the tender is `EVALUATION`. Each evaluator selects one recommended proposal, adds a short comment, and signs once.

Each signature creates:

```text
evaluatorIdentityHash
tenderId
proposalId
recommendation
commentHash
timestamp
evaluationSignatureHash
```

Only `evaluationSignatureHash` and proof metadata go to the Ethereum audit log.

Observable proof: the evaluation panel moves from `0/4 signed` to `4/4 signed`.

### Step 5: Forward complete evaluation to board voting

Switch to the procurement officer.

The officer can forward only after all four evaluator signatures exist.

```text
Required state: EVALUATION
Required signatures: 4 of 4
Next state: BOARD_VOTING
Proof: stage change hash
```

If only three evaluators have signed, the UI keeps `Forward to Board Voting` disabled and shows the missing progress.

Observable proof: the tender lifecycle timeline moves to `BOARD_VOTING`.

### Step 6: Board members vote once

Switch through the three board members.

Each board member can vote once during `BOARD_VOTING`.

Each vote creates:

```text
boardMemberIdentityHash
tenderId
proposalId
voteHash
timestamp
```

The UI shows live vote counts, such as:

```text
P-004: 2 votes
P-005: 1 vote
```

Observable proof: board member cards show `Board vote recorded`.

### Step 7: Declare the majority winner

Switch to the procurement officer.

The award section stays locked until every assigned board member has voted. The system calculates the majority winner. The officer declares the award.

Award declaration creates:

```text
tenderId
winningProposalId
winnerVendorHash
finalVoteSummaryHash
awardDecisionHash
timestamp
```

Observable proof: the award panel highlights `Winner declared by majority vote` and shows the proof transaction.

### Step 8: Verify public audit without proposal content

Switch to the auditor and open `/audit`.

The public audit portal shows:

- tender hashes
- proposal manifest hashes
- encrypted section hashes
- lifecycle stage changes
- evaluator signatures
- board vote hashes
- award proof
- timestamps
- actor identity hashes

It does not show:

- plaintext proposal content
- decrypted sections
- encryption keys
- raw confidential files
- private identity fields

Observable proof: the public audit page shows a clean proof trail and no proposal file content.

## Next Steps

You now know how the MVP workflow proves confidential proposal locking, role enforcement, majority award declaration, and public auditability.

Next, read:

- [Architecture overview](ARCHITECTURE_OVERVIEW.md)
- [API reference](API_REFERENCE.md)
- [Demo script](DEMO_SCRIPT.md)
