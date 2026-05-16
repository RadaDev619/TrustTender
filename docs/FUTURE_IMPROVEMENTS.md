# Future Improvements

The MVP proves the trust-layer concept. These improvements would move it toward a production pilot.

## Identity And Access

- Replace mock Bhutan NDI with real Bhutan NDI proof verification.
- Add an agency-managed role registry.
- Support tender-specific evaluator and board assignments from a backend database.
- Add multi-agency permissions and approval delegation.
- Add session expiry refresh and server-side session storage.

## Procurement Workflow

- Add tender amendments with append-only version history.
- Add formal bid opening ceremony records.
- Add configurable evaluation criteria and scoring rubrics.
- Add chairperson tie-break workflow.
- Add grievance and clarification stages.
- Add contract signing and contract management stages.
- Add archive and retention policies.

## Proposal Security

- Replace local demo storage with encrypted object storage.
- Use envelope encryption with production KMS.
- Add per-section access grants for evaluators.
- Add audit records for every key release.
- Add virus scanning and file type validation.
- Add client-side and server-side file size limits.

## Blockchain And Relayer

- Add deployment scripts for Sepolia and production-like test networks.
- Add relayer nonce management and retry queues.
- Add transaction status polling and reconciliation.
- Add event indexer for public audit search.
- Add contract verification scripts.
- Add relayer wallet monitoring and alerting.
- Add upgrade path planning if contract changes are needed.

## Backend And Data

- Replace JSON stores with PostgreSQL.
- Add Prisma or another migration-managed data layer.
- Add API authentication middleware around every route.
- Add request schemas with Zod or similar validation.
- Add API rate limiting.
- Add structured logs and audit log export.
- Add admin tooling for seed and reset in non-production environments only.

## Frontend And Demo

- Add guided demo mode with next-step prompts.
- Add role-specific home pages.
- Add route-level public/role guards for every page.
- Add visual proof verification on audit cards.
- Add downloadable audit report export.
- Add responsive screenshots for README and pitch deck.

## Testing

- Add Playwright end-to-end tests for the full role-switching workflow.
- Add API integration tests for every route handler.
- Add property tests for state-machine invalid transitions.
- Add contract fuzzing for zero values and unauthorized callers.
- Add visual regression checks for dashboard and audit pages.

## Security And Compliance

- Complete a formal threat model.
- Perform a smart contract audit.
- Add dependency scanning in CI.
- Add secret scanning.
- Add audit log tamper-evidence tests.
- Add privacy review for identity hash and metadata exposure.
