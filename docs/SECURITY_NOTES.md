# Security Notes

This document describes the security boundaries and limitations of the eGP Trust Layer MVP.

## Security Goals

- Prevent proposal submission outside the `OPEN` window.
- Prevent proposal viewing before the deadline and before `EVALUATION`.
- Prevent unauthorized roles from performing restricted actions.
- Prevent evaluators and board members from signing or voting more than once.
- Prevent award declaration before board voting is complete.
- Keep confidential proposal files off-chain.
- Store identity hashes on-chain instead of raw identities.
- Make critical events auditable through immutable proof events.

## Identity And RBAC

The MVP uses mock Bhutan NDI identities in `shared/src/mockBhutanNdiRbac.ts`.

Each mock user has:

- employment ID
- holder DID
- identity hash
- mapped role
- permissions

Backend APIs validate that the supplied mock session matches the seeded identity. The session must match user ID, holder DID, identity hash, mapped role, and proof validation flag.

This is not production Bhutan NDI integration. Production integration should validate real proof presentations server-side.

## Proposal Confidentiality

Proposal sections are encrypted in the browser with AES-GCM before storage. Each section has:

- encrypted blob reference
- IV
- encrypted hash
- key reference
- locked flag

The backend rejects known plaintext fields in proposal envelope payloads.

The public audit API returns encrypted section hashes and proposal manifest hashes. It does not return encrypted blob references, IVs, key references, decrypted content, or plaintext proposal content.

## KMS Limitation

The MVP uses a simulated KMS module for demo decryption control. This is acceptable for the hackathon MVP, but production should use a real KMS or HSM-backed envelope encryption design with:

- per-section data keys
- key wrapping
- strict evaluator access grants
- audit records for key release
- server-side policy enforcement

## Blockchain Boundary

The Solidity contract stores no arrays of procurement records and no proposal content. It emits event-only proofs.

Allowed on-chain:

- tender hash
- proposal manifest hash
- stage change hash
- evaluation signature hash
- board vote hash
- award decision hash
- actor identity hash
- block timestamp

Not allowed on-chain:

- proposal files
- plaintext proposal sections
- evaluator comments
- raw employment IDs
- encryption keys
- commercial pricing details

## Relayer Security

Users do not connect MetaMask. The frontend calls backend APIs. The backend validates role, permission, actor hash, and request payload before signing a transaction.

Real mode requires:

```env
RELAYER_PRIVATE_KEY=0x...
RPC_URL=https://...
EGP_AUDIT_CONTRACT_ADDRESS=0x...
```

Security requirements for production:

- Store `RELAYER_PRIVATE_KEY` only in a secret manager.
- Use a dedicated low-balance relayer wallet.
- Authorize only that wallet in the contract.
- Rotate the relayer key if leaked.
- Monitor failed relayer calls.
- Add nonce handling and retry policy.

## State Machine Controls

The state machine validates:

- `DRAFT` to `OPEN`
- `OPEN` to `CLOSED` only after deadline
- `CLOSED` to `EVALUATION`
- evaluator access only during `EVALUATION`
- 4 of 4 evaluator signatures before `BOARD_VOTING`
- board votes only during `BOARD_VOTING`
- one vote per board member
- award only after all board members vote

The UI disables blocked actions, but backend validation remains the source of truth.

## Current MVP Limitations

- Mock NDI is not production identity verification.
- Demo data uses local JSON files and browser localStorage.
- Proposal storage is local demo storage, not production object storage.
- Simulated KMS is not a production key management system.
- Contract has not received a formal third-party audit.
- Testnet deployment requires external RPC and funded relayer wallets.
- Public audit proof verification is display-oriented, not a full indexer.

## Recommended Production Hardening

- Integrate real Bhutan NDI verification.
- Use a production database with migrations and row-level audit records.
- Use object storage with server-side access policies for encrypted blobs.
- Add real KMS key release policies.
- Add contract deployment verification and monitoring.
- Add event indexing service for audit search.
- Add rate limiting and replay protection on API endpoints.
- Add formal smart contract audit and threat model review.
- Add end-to-end tests for browser workflows.
