# Demo Script

Target time: 5 minutes.

## Opening

Procurement systems depend heavily on trust. If a privileged actor can secretly edit records, open proposals early, or bypass approvals, the audit trail becomes weak.

The eGP Trust Layer does not replace Bhutan e-GP. It adds a blockchain-backed trust and audit layer. It verifies who is acting through mock Bhutan NDI, maps employment identity to a procurement role, enforces the tender workflow, and records critical actions as gasless Ethereum proofs.

## Setup Before Judges Arrive

1. Start the app:

   ```powershell
   cd D:\2026\TenderTrust\frontend
   npm run dev
   ```

2. Open `http://localhost:3000/dashboard`.
3. Click `Seed demo data`.
4. Keep `BLOCKCHAIN_MODE=mock` unless the deployed relayer and contract are already verified.

## Talk Track

### 1. Show Identity And Role Mapping

Page: `/dashboard`

User: `Karma Dorji`

Say:

> This role is not selected manually by the user. It comes from a mock Bhutan NDI employment identity. The app maps that identity to `PROCUREMENT_OFFICER` and derives allowed actions from the role.

Point to:

- mock NDI identity card
- mapped role badge
- allowed actions
- demo user switcher

### 2. Show Tender Lifecycle

Page: `/tenders/TT-2026-001`

Say:

> The tender lifecycle is explicit. A tender moves through draft, open submission, closed, evaluation, board voting, awarded, and archived. Stage changes are recorded as proof events.

Point to:

- tender status badge
- lifecycle timeline
- Ethereum proof card

### 3. Show Proposal Locking

Page: `/tenders/TT-2026-002/submit`

User: `Tashi Construction`

Say:

> Vendors submit proposals only while the tender is open and before the deadline. Each proposal section is encrypted in the browser before storage. The chain receives hashes only.

Point to:

- `Encrypted before storage`
- `Locked until deadline`
- four proposal sections
- submission proof status

### 4. Show Evaluation Signatures

Page: `/tenders/TT-2026-001/evaluation`

User: `Evaluator 1`, then mention the four evaluators.

Say:

> After the deadline and evaluation start, assigned evaluators can view the decrypted proposal sections. Each evaluator signs one recommendation. They cannot sign twice.

Point to:

- `Evaluation unlocked`
- proposal cards
- progress from `0/4 signed` to `4/4 signed`
- `Evaluator signed`

### 5. Show Board Voting

Page: `/tenders/TT-2026-004/board`

User: `Board Member 1`

Say:

> Board voting starts only after all evaluator signatures are complete. Each board member votes once, and each vote is recorded as an audit proof.

Point to:

- vote progress
- proposal vote counts
- evaluator recommendation summary
- `Board vote recorded`

### 6. Show Award Declaration

Page: `/tenders/TT-2026-004/award`

User: `Karma Dorji`

Say:

> The award section stays locked until board voting is complete. The system calculates the majority winner, and the procurement officer records the award proof.

Point to:

- majority winner
- vote count
- evaluation recommendation summary
- `Winner declared by majority vote`
- proof transaction

### 7. Show Public Audit

Page: `/audit`

User: `Auditor`

Say:

> The auditor and public portal can verify hashes, timestamps, stage changes, signatures, votes, and award proof. They cannot see confidential proposal files.

Point to:

- clean proof trail
- blocked attempt row
- actor identity hash
- proof hashes
- no proposal content

## Negative Path To Emphasize

Show or mention:

- Vendor cannot submit after the deadline.
- No user can view proposals while tender is `OPEN`.
- Evaluator cannot sign twice.
- Tender cannot move to board voting before 4 of 4 signatures.
- Board member cannot vote twice.
- Award cannot be declared before board voting is complete.

Say:

> The blocked path is the strongest proof. The system does not just record valid actions. It prevents workflow bypass.

## Closing

This is not a crypto app. Users do not connect wallets, mint tokens, or pay gas. It is procurement trust middleware that uses identity, role permissions, state-machine validation, and Ethereum proofs to make procurement history harder to rewrite silently.
