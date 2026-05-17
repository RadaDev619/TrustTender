# vedio demo link:

https://drive.google.com/drive/folders/1CBYenWi0ZStnqYbn6Jdu5y7szV6onTaA?usp=sharing

# PPt link:

https://canva.link/2961ov9nr8rti9p

# eGP Trust Layer

Gasless blockchain procurement audit and verification middleware for a Bhutan e-GP hackathon MVP.

The eGP Trust Layer does not replace Bhutan's e-GP system. It adds a trust and audit layer that ties critical procurement actions to mock Bhutan NDI identity, mapped roles, workflow validation, and Ethereum proof events.

## Problem

Centralized procurement systems can suffer from hidden edits, approval bypass, weak auditability, and limited public verification. Database logs help, but the same system operators may control the application, database, and log history.

The MVP focuses on one procurement risk: confidential proposal handling and award decisions must follow the declared workflow, and the public audit trail must prove what happened without exposing proposal content.

## Solution

The project implements a procurement trust layer with:

- Mock Bhutan NDI login and employment role mapping.
- Role-based access control for procurement officer, vendor, evaluator, board member, and auditor.
- A tender lifecycle state machine from `DRAFT` to `ARCHIVED`.
- Browser-side proposal encryption with AES-GCM before storage.
- Backend API validation before every critical action.
- A gasless backend Ethereum relayer, so users do not connect MetaMask or pay gas.
- An event-only Solidity audit contract that stores hashes, timestamps, actor identity hashes, stage changes, signatures, votes, and award proof.
- A public audit portal that never exposes confidential proposal files.

## Tech Stack

| Layer              | Technology                                                     |
| ------------------ | -------------------------------------------------------------- |
| Frontend           | Next.js App Router, React, Tailwind CSS, lucide-react          |
| Mock identity      | Mock Bhutan NDI users in shared TypeScript                     |
| Workflow           | TypeScript procurement state machine                           |
| Encryption         | Browser Web Crypto API, AES-GCM, SHA-256                       |
| Backend APIs       | Next.js route handlers calling backend TypeScript services     |
| Local data         | JSON-backed demo stores and browser localStorage for MVP flows |
| Blockchain relayer | ethers.js backend signer                                       |
| Smart contract     | Solidity `^0.8.20`, Hardhat                                    |
| Tests              | Node test runner with `tsx`, Hardhat tests                     |

## User Roles

| Role                  | Demo user                         | Main permissions                                                          |
| --------------------- | --------------------------------- | ------------------------------------------------------------------------- |
| `PROCUREMENT_OFFICER` | Karma Dorji                       | Create, publish, close, start evaluation, forward to board, declare award |
| `VENDOR`              | Tashi Construction, Druk Builders | Submit encrypted proposals while tender is open                           |
| `EVALUATOR`           | Evaluator 1 to 4                  | View decrypted proposals during evaluation and sign once                  |
| `BOARD_MEMBER`        | Board Member 1 to 3               | Vote once during board voting                                             |
| `AUDITOR`             | Auditor                           | View public audit proofs without proposal content                         |

## MVP Workflow

1. Procurement officer creates a tender in `DRAFT`.
2. Procurement officer publishes it to `OPEN`.
3. Vendors submit encrypted proposals before the deadline.
4. Proposal content stays locked while the tender is `OPEN`.
5. After the deadline, the officer closes the tender and starts `EVALUATION`.
6. Four evaluators review proposals and sign one recommendation each.
7. After all four evaluator signatures are complete, the officer forwards the tender to `BOARD_VOTING`.
8. Board members vote once for the best proposal.
9. The majority winner is declared in `AWARDED`.
10. Public audit shows hashes, timestamps, stage changes, signatures, votes, and award proof, but not proposal content.

More detail: [MVP workflow guide](docs/MVP_WORKFLOW_GUIDE.md).

## How To Run Locally

Install dependencies for each package:

```powershell
cd D:\2026\TenderTrust\frontend
npm install

cd D:\2026\TenderTrust\contracts
npm install

cd D:\2026\TenderTrust\backend
npm install
```

Create `frontend/.env.local` for the reliable hackathon mode:

```env
BLOCKCHAIN_MODE=mock
```

Start the app:

```powershell
cd D:\2026\TenderTrust\frontend
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Useful checks:

```powershell
cd D:\2026\TenderTrust\frontend
npm run test:mvp
npm run typecheck
npm run build
```

Contract checks:

```powershell
cd D:\2026\TenderTrust\contracts
npm run compile
npm test
```

## How To Deploy The Contract

For local Hardhat deployment:

```powershell
cd D:\2026\TenderTrust\contracts
npx hardhat node
```

In a second terminal:

```powershell
cd D:\2026\TenderTrust\contracts
$env:RELAYER_ADDRESS="<relayer-account-address>"
npm run deploy:local
```

The deploy script prints the `EGPTrustAuditLog` address. Put that address in the frontend environment when using real relayer mode.

For testnet deployment, add a network to `contracts/hardhat.config.js`, fund the deployer wallet, set the relayer address, then run:

```powershell
cd D:\2026\TenderTrust\contracts
$env:RELAYER_ADDRESS="<backend-relayer-address>"
npm run deploy -- --network <network-name>
```

## How To Configure The Relayer

Mock mode is recommended for judging reliability:

```env
BLOCKCHAIN_MODE=mock
```

Real Ethereum mode requires:

```env
BLOCKCHAIN_MODE=real
RELAYER_PRIVATE_KEY=0x...
RPC_URL=https://...
EGP_AUDIT_CONTRACT_ADDRESS=0x...
ETHERSCAN_BASE_URL=https://sepolia.etherscan.io/tx
TX_CONFIRMATIONS=1
```

The relayer wallet must be authorized in `EGPTrustAuditLog` by constructor deployment or `setRelayer`.

## How To Run The Demo

1. Start the frontend.
2. Go to `/dashboard`.
3. Click `Seed demo data`.
4. Use the top-right `Demo user switcher`.
5. Show these labels across the workflow:
   - `Encrypted before storage`
   - `Locked until deadline`
   - `Evaluator signed`
   - `Board vote recorded`
   - `Ethereum proof recorded`
   - `Winner declared by majority vote`
6. End on `/audit` to show the proof trail without proposal content.

Demo script: [docs/DEMO_SCRIPT.md](docs/DEMO_SCRIPT.md).

## Documentation

- [MVP workflow guide](docs/MVP_WORKFLOW_GUIDE.md)
- [Architecture overview](docs/ARCHITECTURE_OVERVIEW.md)
- [API reference](docs/API_REFERENCE.md)
- [Smart contract reference](docs/SMART_CONTRACT_REFERENCE.md)
- [Demo script](docs/DEMO_SCRIPT.md)
- [Security notes](docs/SECURITY_NOTES.md)
- [Future improvements](docs/FUTURE_IMPROVEMENTS.md)
- [Testing](docs/TESTING.md)

## What This MVP Is Not

- Not a production-certified government system.
- Not a replacement for Bhutan e-GP.
- Not a wallet app.
- Not a token, NFT, DeFi, or DAO product.
- Not a full procurement ERP.

## License

Hackathon MVP. Add a production license before reuse outside the demo context.
