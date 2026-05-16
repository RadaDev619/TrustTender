# eGP Trust Layer Testing

Run the practical MVP suite from the frontend package:

```powershell
cd D:\2026\TenderTrust\frontend
npm run test:mvp
```

The suite uses Node's built-in test runner with `tsx`, so it does not need a browser, a database server, MetaMask, or a live blockchain. It isolates demo storage in a temporary directory and uses the mock backend relayer by default.

Recommended pre-demo checks:

```powershell
npm run test:mvp
npm run typecheck
npm run build
```

Covered MVP risks:

- Vendors can submit only while a tender is `OPEN` and before the deadline.
- Proposal content stays locked before the deadline.
- Evaluators can view and sign only during `EVALUATION`, and only once.
- Board voting cannot start until all four evaluator signatures are complete.
- Board members can vote only once.
- Awards require complete board voting and use the majority winner.
- Public audit output exposes hashes and proof metadata, not confidential proposal content.
- The gasless relayer returns either a transaction hash or a clean configuration error.
- RBAC blocks restricted pages and actions for unauthorized roles.
